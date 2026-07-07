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
  comercial_asignado_id: string | null
}

export async function listClientes(): Promise<ClienteResumen[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, codigo_interno, nombre, canal, estado, ciudad, comercial_asignado_id')
    .is('deleted_at', null)
    .order('codigo_interno')
  if (error) throw error
  return data ?? []
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
