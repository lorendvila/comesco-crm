import { supabase } from '../lib/supabase'

// ============================================================
// Capa de datos de la Fase I-2: costes, reparto, landed cost, anticipos.
// READ-ONLY respecto a inventario/referencia_costes/kardex/pedidos.
// ============================================================

export const CRITERIOS = ['valor', 'unidades', 'cajas', 'pallets', 'peso', 'volumen', 'directo', 'manual'] as const
export type Criterio = (typeof CRITERIOS)[number]

export const CRITERIO_LABEL: Record<string, string> = {
  valor: 'Valor mercancía', unidades: 'Unidades', cajas: 'Cajas', pallets: 'Pallets',
  peso: 'Peso', volumen: 'Volumen', directo: 'Directo', manual: 'Manual',
}

export interface Coste {
  id: string
  importacion_id: string
  tipo_coste_codigo: string
  capitalizable: boolean | null
  concepto: string | null
  operador_id: string | null
  criterio_reparto: string
  referencia_id: string | null
  linea_directa_id: string | null
  importe_estimado: number | null
  moneda_estimado: string | null
  tc_estimado: number | null
  importe_estimado_cop: number | null
  importe_real: number | null
  moneda_real: string | null
  tc_real: number | null
  importe_real_cop: number | null
  fecha_factura: string | null
  sin_coste_real: boolean
  fecha_devengo: string | null
  fecha_pago: string | null
  fecha_recuperacion_estimada: string | null
  fecha_recuperacion_real: string | null
  observaciones: string | null
  deleted_at: string | null
  // enriquecidos
  tipo_nombre?: string
  operador_nombre?: string
}

export async function listCostes(importacionId: string): Promise<Coste[]> {
  const { data, error } = await supabase
    .from('importacion_costes')
    .select('*, importacion_tipos_coste(nombre), operadores(nombre)')
    .eq('importacion_id', importacionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const tipo = row.importacion_tipos_coste as { nombre: string } | null
    const op = row.operadores as { nombre: string } | null
    return { ...(row as unknown as Coste), tipo_nombre: tipo?.nombre, operador_nombre: op?.nombre }
  })
}

export type CosteInput = {
  tipo_coste_codigo: string
  capitalizable?: boolean | null
  concepto?: string | null
  operador_id?: string | null
  criterio_reparto: string
  referencia_id?: string | null
  linea_directa_id?: string | null
  importe_estimado?: number | null
  moneda_estimado?: string | null
  tc_estimado?: number | null
  importe_real?: number | null
  moneda_real?: string | null
  tc_real?: number | null
  fecha_factura?: string | null
  sin_coste_real?: boolean
  fecha_devengo?: string | null
  fecha_pago?: string | null
  fecha_recuperacion_estimada?: string | null
  fecha_recuperacion_real?: string | null
  observaciones?: string | null
}

export async function crearCoste(importacionId: string, payload: CosteInput): Promise<string> {
  const { data, error } = await supabase
    .from('importacion_costes')
    .insert({ ...payload, importacion_id: importacionId })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function actualizarCoste(id: string, patch: Partial<CosteInput>): Promise<void> {
  const { error } = await supabase.from('importacion_costes').update(patch).eq('id', id)
  if (error) throw error
}
export async function borrarCoste(coste: Coste): Promise<void> {
  // Un coste con real es evidencia -> se archiva; si no, se puede borrar.
  if (coste.importe_real != null) {
    const { error } = await supabase.from('importacion_costes').update({ deleted_at: new Date().toISOString() }).eq('id', coste.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('importacion_costes').delete().eq('id', coste.id)
    if (error) throw error
  }
}

// ---- Reparto ----
export interface RepartoRow {
  coste_id: string
  importacion_linea_id: string
  base_reparto: number | null
  importe_estimado_cop: number | null
  importe_real_cop: number | null
  manual: boolean
}

export async function recalcularReparto(importacionId: string): Promise<void> {
  const { error } = await supabase.rpc('recalcular_reparto', { p_importacion_id: importacionId })
  if (error) throw error
}
export async function listReparto(importacionId: string): Promise<RepartoRow[]> {
  // Trae el reparto de todos los costes de la importación (join a costes para filtrar).
  const { data, error } = await supabase
    .from('importacion_coste_reparto')
    .select('coste_id, importacion_linea_id, base_reparto, importe_estimado_cop, importe_real_cop, manual, importacion_costes!inner(importacion_id)')
    .eq('importacion_costes.importacion_id', importacionId)
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      coste_id: row.coste_id as string,
      importacion_linea_id: row.importacion_linea_id as string,
      base_reparto: (row.base_reparto as number) ?? null,
      importe_estimado_cop: (row.importe_estimado_cop as number) ?? null,
      importe_real_cop: (row.importe_real_cop as number) ?? null,
      manual: row.manual as boolean,
    }
  })
}
// Reparto MANUAL de un coste (criterio 'manual'): reemplaza sus filas.
export async function guardarRepartoManual(costeId: string, filas: { linea_id: string; est: number | null; real: number | null }[]): Promise<void> {
  const del = await supabase.from('importacion_coste_reparto').delete().eq('coste_id', costeId)
  if (del.error) throw del.error
  if (filas.length) {
    const rows = filas.map((f) => ({ coste_id: costeId, importacion_linea_id: f.linea_id, importe_estimado_cop: f.est, importe_real_cop: f.real, manual: true }))
    const { error } = await supabase.from('importacion_coste_reparto').insert(rows)
    if (error) throw error
  }
}

export interface Reconciliacion {
  coste_id: string
  tipo: string
  esperado_est: number | null
  suma_est: number | null
  esperado_real: number | null
  suma_real: number | null
}
export async function reconciliar(importacionId: string): Promise<Reconciliacion[]> {
  const { data, error } = await supabase.rpc('reconciliar_costes', { p_importacion_id: importacionId })
  if (error) throw error
  return (data as Reconciliacion[]) ?? []
}

// ---- Landed cost (vista) ----
export interface LandedLinea {
  linea_id: string
  importacion_id: string
  referencia_id: string
  cantidad_unidades: number
  mercancia_est_cop: number | null
  mercancia_real_cop: number | null
  mercancia_prov_cop: number | null
  costes_est_cop: number
  costes_real_cop: number
  costes_prov_cop: number
  landed_est_cop: number | null
  landed_real_cop: number | null
  landed_prov_cop: number | null
  prov_desde_estimado_cop: number | null
  landed_prov_unitario: number | null
}
export async function listLanded(importacionId: string): Promise<LandedLinea[]> {
  const { data, error } = await supabase
    .from('v_importacion_landed')
    .select('*')
    .eq('importacion_id', importacionId)
    .returns<LandedLinea[]>()
  if (error) throw error
  return data ?? []
}

// ---- Anticipos ----
export interface Anticipo {
  id: string
  importacion_id: string
  operador_id: string | null
  coste_id: string | null
  concepto: string | null
  importe: number
  moneda: string
  tc: number | null
  importe_cop: number | null
  estado: string
  importe_utilizado: number
  fecha_solicitud: string | null
  fecha_pago: string | null
  saldo: number
  saldo_cop: number | null
}
export const ESTADOS_ANTICIPO = ['solicitado', 'pagado', 'aplicado', 'devuelto'] as const

export async function listAnticipos(importacionId: string): Promise<Anticipo[]> {
  const { data, error } = await supabase
    .from('v_importacion_anticipos')
    .select('id, importacion_id, operador_id, coste_id, concepto, importe, moneda, tc, importe_cop, estado, importe_utilizado, fecha_solicitud, fecha_pago, saldo, saldo_cop')
    .eq('importacion_id', importacionId)
    .order('created_at', { ascending: true })
    .returns<Anticipo[]>()
  if (error) throw error
  return data ?? []
}
export type AnticipoInput = {
  operador_id?: string | null
  concepto?: string | null
  importe: number
  moneda?: string
  tc?: number | null
  estado?: string
  importe_utilizado?: number
  fecha_solicitud?: string | null
  fecha_pago?: string | null
}
export async function crearAnticipo(importacionId: string, payload: AnticipoInput): Promise<void> {
  const { error } = await supabase.from('importacion_anticipos').insert({ ...payload, importacion_id: importacionId })
  if (error) throw error
}
export async function actualizarAnticipo(id: string, patch: Partial<AnticipoInput>): Promise<void> {
  const { error } = await supabase.from('importacion_anticipos').update(patch).eq('id', id)
  if (error) throw error
}

// ---- TC sugerido desde la serie de referencia (tipos_cambio); null si vacía ----
export async function tcSugerido(par = 'EUR/COP'): Promise<number | null> {
  const { data, error } = await supabase
    .from('tipos_cambio')
    .select('tipo')
    .eq('par', par)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as { tipo: number } | null)?.tipo ?? null
}
