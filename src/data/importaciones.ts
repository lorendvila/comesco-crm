import { supabase } from '../lib/supabase'

// ============================================================
// Capa de datos del módulo Importaciones (Fases I-0 + I-1).
// referencias sigue siendo el maestro; aquí no se duplica SKU.
// ============================================================

// ---------- Catálogos (I-0) ----------
export interface TipoCoste {
  codigo: string
  nombre: string
  capitalizable: boolean
  naturaleza: string
  criterio_reparto_default: string
  activo: boolean
  orden: number | null
}
export interface TipoRolOperador {
  codigo: string
  nombre: string
  activo: boolean
  orden: number | null
}
export interface TipoDocumento {
  codigo: string
  nombre: string
  activo: boolean
  orden: number | null
}

export async function listTiposCoste(): Promise<TipoCoste[]> {
  const { data, error } = await supabase
    .from('importacion_tipos_coste')
    .select('codigo, nombre, capitalizable, naturaleza, criterio_reparto_default, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .returns<TipoCoste[]>()
  if (error) throw error
  return data ?? []
}
export async function listTiposRolOperador(): Promise<TipoRolOperador[]> {
  const { data, error } = await supabase
    .from('operador_tipos_rol')
    .select('codigo, nombre, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .returns<TipoRolOperador[]>()
  if (error) throw error
  return data ?? []
}
export async function listTiposDocumento(): Promise<TipoDocumento[]> {
  const { data, error } = await supabase
    .from('importacion_tipos_documento')
    .select('codigo, nombre, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .returns<TipoDocumento[]>()
  if (error) throw error
  return data ?? []
}

// ---------- Operadores (maestro de terceros de importación) ----------
export interface Operador {
  id: string
  nombre: string
  nit: string | null
  pais: string | null
  email: string | null
  telefono: string | null
  web: string | null
  notas: string | null
  activo: boolean
}

export async function listOperadores(incluirInactivos = false): Promise<Operador[]> {
  let q = supabase
    .from('operadores')
    .select('id, nombre, nit, pais, email, telefono, web, notas, activo')
    .order('nombre', { ascending: true })
  if (!incluirInactivos) q = q.eq('activo', true)
  const { data, error } = await q.returns<Operador[]>()
  if (error) throw error
  return data ?? []
}

export async function getOperador(id: string): Promise<Operador | null> {
  const { data, error } = await supabase
    .from('operadores')
    .select('id, nombre, nit, pais, email, telefono, web, notas, activo')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Operador) ?? null
}

export async function createOperador(payload: {
  nombre: string
  nit?: string | null
  pais?: string | null
  email?: string | null
  telefono?: string | null
  web?: string | null
  notas?: string | null
}): Promise<string> {
  const { data, error } = await supabase.from('operadores').insert(payload).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function updateOperador(id: string, patch: Partial<Operador>): Promise<void> {
  const { error } = await supabase.from('operadores').update(patch).eq('id', id)
  if (error) throw error
}

// Roles globales del operador (N:M con el catálogo)
export async function listRolesDeOperador(operadorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('operador_roles')
    .select('rol_codigo')
    .eq('operador_id', operadorId)
  if (error) throw error
  return (data ?? []).map((r) => (r as { rol_codigo: string }).rol_codigo)
}
export async function addRolOperador(operadorId: string, rolCodigo: string): Promise<void> {
  const { error } = await supabase.from('operador_roles').insert({ operador_id: operadorId, rol_codigo: rolCodigo })
  if (error) throw error
}
export async function removeRolOperador(operadorId: string, rolCodigo: string): Promise<void> {
  const { error } = await supabase
    .from('operador_roles')
    .delete()
    .eq('operador_id', operadorId)
    .eq('rol_codigo', rolCodigo)
  if (error) throw error
}

// ---------- Importaciones (cabecera) ----------
export interface Importacion {
  id: string
  codigo: string | null
  estado_logistico: string
  estado_coste: string
  origen: string | null
  destino: string | null
  incoterm: string | null
  modalidad_transporte: string | null
  booking: string | null
  bl: string | null
  contenedor: string | null
  etd_prevista: string | null
  etd_real: string | null
  eta_prevista: string | null
  eta_real: string | null
  almacen_destino_id: string | null
  moneda: string
  tc_presupuestado: number | null
  observaciones: string | null
  deleted_at: string | null
  created_at: string | null
}

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const
export const MODALIDADES = ['maritimo', 'aereo', 'terrestre', 'multimodal'] as const

export const ESTADO_LOG_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  en_transito: 'En tránsito',
  recepcion_parcial: 'Recepción parcial',
  recibida: 'Recibida',
  anulada: 'Anulada',
}
export const ESTADO_COSTE_LABEL: Record<string, string> = {
  estimado: 'Estimado',
  provisional: 'Provisional',
  definitivo: 'Definitivo',
}

// Transiciones manuales permitidas en I-1 (recepción es I-4).
export function transicionesLogisticas(actual: string): string[] {
  switch (actual) {
    case 'borrador':
      return ['confirmada', 'anulada']
    case 'confirmada':
      return ['en_transito', 'anulada']
    case 'en_transito':
      return ['anulada']
    default:
      return []
  }
}

export interface ImportacionListItem extends Importacion {
  almacen_nombre: string | null
  n_lineas: number
}

export async function listImportaciones(incluirArchivadas = false): Promise<ImportacionListItem[]> {
  let q = supabase
    .from('importaciones')
    .select('*, almacenes(nombre), importacion_lineas(count)')
    .order('created_at', { ascending: false })
  if (!incluirArchivadas) q = q.is('deleted_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const alm = row.almacenes as { nombre: string } | null
    const cnt = row.importacion_lineas as { count: number }[] | null
    return {
      ...(row as unknown as Importacion),
      almacen_nombre: alm?.nombre ?? null,
      n_lineas: cnt && cnt.length ? cnt[0].count : 0,
    }
  })
}

export async function getImportacion(id: string): Promise<Importacion | null> {
  const { data, error } = await supabase.from('importaciones').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Importacion) ?? null
}

export async function siguienteCodigoImportacion(): Promise<string> {
  const { data, error } = await supabase.rpc('siguiente_codigo_importacion')
  if (error) throw error
  return (data as string) ?? ''
}

export type ImportacionInput = Partial<Omit<Importacion, 'id' | 'codigo' | 'created_at' | 'deleted_at'>>

export async function createImportacion(payload: ImportacionInput): Promise<string> {
  const { data, error } = await supabase.from('importaciones').insert(payload).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}
export async function updateImportacion(id: string, patch: ImportacionInput): Promise<void> {
  const { error } = await supabase.from('importaciones').update(patch).eq('id', id)
  if (error) throw error
}
export async function cambiarEstadoLogistico(id: string, estado: string): Promise<void> {
  const { error } = await supabase.from('importaciones').update({ estado_logistico: estado }).eq('id', id)
  if (error) throw error
}
export async function archivarImportacion(id: string): Promise<void> {
  const { error } = await supabase.from('importaciones').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restaurarImportacion(id: string): Promise<void> {
  const { error } = await supabase.from('importaciones').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

// ---------- Líneas (mercancía por referencia) ----------
export interface ImportacionLinea {
  id: string
  importacion_id: string
  referencia_id: string
  operador_proveedor_id: string | null
  cantidad_unidades: number
  cajas: number | null
  pallets: number | null
  peso_kg: number | null
  volumen_m3: number | null
  precio_compra: number
  moneda: string
  importe_mercancia: number | null
  notas: string | null
  // enriquecidos
  referencia_nombre?: string
  referencia_sku?: string | null
  proveedor_nombre?: string | null
}

export async function listLineas(importacionId: string): Promise<ImportacionLinea[]> {
  const { data, error } = await supabase
    .from('importacion_lineas')
    .select('*, referencias(nombre_producto, sku), operadores(nombre)')
    .eq('importacion_id', importacionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const ref = row.referencias as { nombre_producto: string; sku: string | null } | null
    const prov = row.operadores as { nombre: string } | null
    return {
      ...(row as unknown as ImportacionLinea),
      referencia_nombre: ref?.nombre_producto,
      referencia_sku: ref?.sku ?? null,
      proveedor_nombre: prov?.nombre ?? null,
    }
  })
}

export type LineaInput = {
  referencia_id: string
  operador_proveedor_id?: string | null
  cantidad_unidades: number
  cajas?: number | null
  pallets?: number | null
  peso_kg?: number | null
  volumen_m3?: number | null
  precio_compra: number
  moneda?: string
  notas?: string | null
}

export async function addLinea(importacionId: string, payload: LineaInput): Promise<void> {
  const { error } = await supabase.from('importacion_lineas').insert({ ...payload, importacion_id: importacionId })
  if (error) throw error
}
export async function updateLinea(id: string, patch: Partial<LineaInput>): Promise<void> {
  const { error } = await supabase.from('importacion_lineas').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteLinea(id: string): Promise<void> {
  const { error } = await supabase.from('importacion_lineas').delete().eq('id', id)
  if (error) throw error
}

// ---------- Operadores participantes en la importación ----------
export interface ImportacionOperador {
  operador_id: string
  rol_codigo: string
  notas: string | null
  operador_nombre?: string
  rol_nombre?: string
}

export async function listImportacionOperadores(importacionId: string): Promise<ImportacionOperador[]> {
  const { data, error } = await supabase
    .from('importacion_operadores')
    .select('operador_id, rol_codigo, notas, operadores(nombre), operador_tipos_rol(nombre)')
    .eq('importacion_id', importacionId)
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const op = row.operadores as { nombre: string } | null
    const rol = row.operador_tipos_rol as { nombre: string } | null
    return {
      operador_id: row.operador_id as string,
      rol_codigo: row.rol_codigo as string,
      notas: (row.notas as string) ?? null,
      operador_nombre: op?.nombre,
      rol_nombre: rol?.nombre,
    }
  })
}
export async function addImportacionOperador(importacionId: string, operadorId: string, rolCodigo: string): Promise<void> {
  const { error } = await supabase
    .from('importacion_operadores')
    .insert({ importacion_id: importacionId, operador_id: operadorId, rol_codigo: rolCodigo })
  if (error) throw error
}
export async function removeImportacionOperador(importacionId: string, operadorId: string, rolCodigo: string): Promise<void> {
  const { error } = await supabase
    .from('importacion_operadores')
    .delete()
    .eq('importacion_id', importacionId)
    .eq('operador_id', operadorId)
    .eq('rol_codigo', rolCodigo)
  if (error) throw error
}

// ---------- Documentos + Storage ----------
export const BUCKET = 'importaciones'

export interface DocumentoImportacion {
  id: string
  importacion_id: string
  tipo_codigo: string | null
  estado: string
  nombre_archivo: string | null
  storage_path: string | null
  mime_type: string | null
  tamano_bytes: number | null
  operador_id: string | null
  fecha: string | null
  validado_at: string | null
  notas: string | null
  created_at: string | null
}

export const ESTADOS_DOC = ['sugerido', 'requerido', 'pendiente', 'recibido', 'validado', 'observado'] as const

export async function listDocumentos(importacionId: string): Promise<DocumentoImportacion[]> {
  const { data, error } = await supabase
    .from('importacion_documentos')
    .select('*')
    .eq('importacion_id', importacionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<DocumentoImportacion[]>()
  if (error) throw error
  return data ?? []
}

// Sube un fichero al bucket privado y devuelve su metadata.
export async function subirArchivo(prefijo: string, file: File): Promise<{ path: string; mime: string; size: number; nombre: string }> {
  const uid = (crypto as Crypto).randomUUID()
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${prefijo}/${uid}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return { path, mime: file.type || 'application/octet-stream', size: file.size, nombre: file.name }
}

export async function urlFirmada(path: string, segundos = 120): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos)
  if (error) throw error
  return data.signedUrl
}

export type DocumentoInput = {
  tipo_codigo?: string | null
  estado?: string
  operador_id?: string | null
  fecha?: string | null
  notas?: string | null
  nombre_archivo?: string | null
  storage_path?: string | null
  mime_type?: string | null
  tamano_bytes?: number | null
}

export async function crearDocumento(importacionId: string, payload: DocumentoInput): Promise<void> {
  const { error } = await supabase.from('importacion_documentos').insert({ ...payload, importacion_id: importacionId })
  if (error) throw error
}
export async function actualizarDocumento(id: string, patch: DocumentoInput): Promise<void> {
  const { error } = await supabase.from('importacion_documentos').update(patch).eq('id', id)
  if (error) throw error
}
export async function borrarDocumento(id: string): Promise<void> {
  // El guard de BD bloquea el borrado si está validado; entonces archivamos.
  const { error } = await supabase.from('importacion_documentos').delete().eq('id', id)
  if (error) throw error
}
export async function archivarDocumento(id: string): Promise<void> {
  const { error } = await supabase.from('importacion_documentos').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

// ---------- Documentos de operador (alta/relación) ----------
export interface DocumentoOperador {
  id: string
  operador_id: string
  tipo: string | null
  estado: string
  nombre_archivo: string | null
  storage_path: string | null
  mime_type: string | null
  tamano_bytes: number | null
  fecha_emision: string | null
  fecha_caducidad: string | null
  validado_at: string | null
  notas: string | null
  created_at: string | null
}

export async function listDocumentosOperador(operadorId: string): Promise<DocumentoOperador[]> {
  const { data, error } = await supabase
    .from('operador_documentos')
    .select('*')
    .eq('operador_id', operadorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .returns<DocumentoOperador[]>()
  if (error) throw error
  return data ?? []
}
export async function crearDocumentoOperador(operadorId: string, payload: {
  tipo?: string | null
  estado?: string
  fecha_emision?: string | null
  fecha_caducidad?: string | null
  notas?: string | null
  nombre_archivo?: string | null
  storage_path?: string | null
  mime_type?: string | null
  tamano_bytes?: number | null
}): Promise<void> {
  const { error } = await supabase.from('operador_documentos').insert({ ...payload, operador_id: operadorId })
  if (error) throw error
}
