import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Oportunidad = Tables<'oportunidades'>
export type OportunidadLinea = Tables<'oportunidad_lineas'>

export interface OportunidadConCliente extends Oportunidad {
  clientes: { nombre: string; codigo_interno: string } | null
}

export interface LineaOportunidadConRef extends OportunidadLinea {
  referencias: { nombre_producto: string; formato: string; codigo_interno: string } | null
}

export interface OportunidadConLineas extends Oportunidad {
  clientes: { nombre: string; codigo_interno: string } | null
  oportunidad_lineas: LineaOportunidadConRef[]
}

// Línea de oportunidad tal como la construye el formulario (todo NETO, sin IVA).
export interface LineaOportunidadInput {
  referencia_id: string
  cantidad: number
  precio_estimado_cop: number | null // precio unitario base neto (antes de descuento)
  descuento_pct: number | null // % de descuento de la línea
  subtotal_cop: number | null // valor mensual neto de la línea (cantidad × precio neto)
}

// Por defecto solo las operativas (no archivadas). `incluirArchivadas` las trae
// todas para la vista con el toggle "mostrar archivadas". Recuerda la distinción:
// etapa='cierre_perdido' es resultado comercial (permanece en histórico);
// deleted_at es archivada (retirada de la operativa).
export async function listOportunidades(incluirArchivadas = false): Promise<OportunidadConCliente[]> {
  let q = supabase
    .from('oportunidades')
    .select('*, clientes(nombre, codigo_interno)')
    .order('created_at', { ascending: false })
  if (!incluirArchivadas) q = q.is('deleted_at', null)
  const { data, error } = await q.returns<OportunidadConCliente[]>()
  if (error) throw error
  return data ?? []
}

export async function getOportunidad(id: string): Promise<OportunidadConLineas> {
  const { data, error } = await supabase
    .from('oportunidades')
    .select('*, clientes(nombre, codigo_interno), oportunidad_lineas(*, referencias(nombre_producto, formato, codigo_interno))')
    .eq('id', id)
    .single()
    .returns<OportunidadConLineas>()
  if (error) throw error
  return data
}

async function insertarLineas(oportunidadId: string, lineas: LineaOportunidadInput[]): Promise<void> {
  if (lineas.length === 0) return
  const rows = lineas.map((l) => ({
    oportunidad_id: oportunidadId,
    referencia_id: l.referencia_id,
    cantidad: l.cantidad,
    unidad: 'unidades',
    precio_estimado_cop: l.precio_estimado_cop,
    descuento_pct: l.descuento_pct,
    subtotal_cop: l.subtotal_cop,
  }))
  const { error } = await supabase.from('oportunidad_lineas').insert(rows)
  if (error) throw error
}

// El formulario ya calcula `valor_estimado` en la cabecera (= Σ subtotales, o el
// valor heredado si aún no hay líneas). Aquí solo se persiste y se reemplazan
// las líneas. La tabla oportunidad_lineas no tiene FKs entrantes ni triggers de
// histórico (comprobado), por eso el patrón "borrar e insertar" es seguro.
export async function createOportunidad(
  cabecera: TablesInsert<'oportunidades'>,
  lineas: LineaOportunidadInput[],
): Promise<void> {
  const { data, error } = await supabase
    .from('oportunidades')
    .insert(cabecera)
    .select('id')
    .single()
  if (error) throw error
  await insertarLineas(data.id, lineas)
}

export async function updateOportunidad(
  id: string,
  cabecera: TablesInsert<'oportunidades'>,
  lineas: LineaOportunidadInput[],
): Promise<void> {
  const { error } = await supabase.from('oportunidades').update(cabecera).eq('id', id)
  if (error) throw error
  const { error: eDel } = await supabase.from('oportunidad_lineas').delete().eq('oportunidad_id', id)
  if (eDel) throw eDel
  await insertarLineas(id, lineas)
}

// Cambio de etapa (drag & drop): NO toca líneas ni valor, solo la etapa.
export async function moverOportunidadEtapa(id: string, etapa: string): Promise<void> {
  const { error } = await supabase.from('oportunidades').update({ etapa }).eq('id', id)
  if (error) throw error
}

// Archivar (soft-delete) / restaurar. NO borra físicamente (la BD lo impide).
// Solo Backoffice/Superadmin (mig 0029). Conserva la oportunidad y sus líneas.
export async function archivarOportunidad(id: string): Promise<void> {
  const { error } = await supabase.from('oportunidades').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restaurarOportunidad(id: string): Promise<void> {
  const { error } = await supabase.from('oportunidades').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}
