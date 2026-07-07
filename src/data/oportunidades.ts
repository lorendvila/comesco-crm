import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type Oportunidad = Tables<'oportunidades'>

export interface OportunidadConCliente extends Oportunidad {
  clientes: { nombre: string; codigo_interno: string } | null
}

export async function listOportunidades(): Promise<OportunidadConCliente[]> {
  const { data, error } = await supabase
    .from('oportunidades')
    .select('*, clientes(nombre, codigo_interno)')
    .order('created_at', { ascending: false })
    .returns<OportunidadConCliente[]>()
  if (error) throw error
  return data ?? []
}

export async function createOportunidad(input: TablesInsert<'oportunidades'>): Promise<void> {
  const { error } = await supabase.from('oportunidades').insert(input)
  if (error) throw error
}

export async function updateOportunidad(
  id: string,
  patch: TablesUpdate<'oportunidades'>,
): Promise<void> {
  const { error } = await supabase.from('oportunidades').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteOportunidad(id: string): Promise<void> {
  const { error } = await supabase.from('oportunidades').delete().eq('id', id)
  if (error) throw error
}
