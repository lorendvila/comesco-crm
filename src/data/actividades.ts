import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Actividad = Tables<'actividades'>

export interface ActividadConCliente extends Actividad {
  clientes: { nombre: string } | null
}

export async function listActividades(clienteId?: string): Promise<ActividadConCliente[]> {
  let query = supabase
    .from('actividades')
    .select('*, clientes(nombre)')
    .order('fecha', { ascending: false })
  if (clienteId) query = query.eq('cliente_id', clienteId)
  const { data, error } = await query.returns<ActividadConCliente[]>()
  if (error) throw error
  return data ?? []
}

export async function createActividad(input: TablesInsert<'actividades'>): Promise<void> {
  const { error } = await supabase.from('actividades').insert(input)
  if (error) throw error
}
