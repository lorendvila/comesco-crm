import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type Cliente = Tables<'clientes'>

// Fila resumida para la lista
export interface ClienteResumen {
  id: string
  codigo_interno: string
  nombre: string
  canal: string | null
  estado: string
  ciudad: string | null
  direccion_entrega: string | null
  comercial_asignado_id: string | null
  deleted_at: string | null
}

// Por defecto solo los operativos (no archivados). `incluirArchivados` los trae
// todos, para la vista de gestión con el toggle "mostrar archivados".
export async function listClientes(incluirArchivados = false): Promise<ClienteResumen[]> {
  let q = supabase
    .from('clientes')
    .select('id, codigo_interno, nombre, canal, estado, ciudad, direccion_entrega, comercial_asignado_id, deleted_at')
    .order('codigo_interno')
  if (!incluirArchivados) q = q.is('deleted_at', null)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// Archivar (soft-delete) / restaurar. La BD (mig 0029) solo lo permite a
// Backoffice/Superadmin; un comercial recibe error aunque llame la API directa.
export async function archivarCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
export async function restaurarCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export async function getCliente(id: string): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCliente(input: TablesInsert<'clientes'>): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateCliente(
  id: string,
  patch: TablesUpdate<'clientes'>,
): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
