import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type Tarea = Tables<'tareas'>

export interface TareaConCliente extends Tarea {
  clientes: { nombre: string } | null
}

export async function listTareas(clienteId?: string): Promise<TareaConCliente[]> {
  let query = supabase
    .from('tareas')
    .select('*, clientes(nombre)')
    .order('estado', { ascending: true }) // pendiente antes que completada
    .order('fecha_limite', { ascending: true, nullsFirst: false })
  if (clienteId) query = query.eq('cliente_id', clienteId)
  const { data, error } = await query.returns<TareaConCliente[]>()
  if (error) throw error
  return data ?? []
}

export async function createTarea(input: TablesInsert<'tareas'>): Promise<void> {
  const { error } = await supabase.from('tareas').insert(input)
  if (error) throw error
}

export async function updateTarea(id: string, patch: TablesUpdate<'tareas'>): Promise<void> {
  const { error } = await supabase.from('tareas').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTarea(id: string): Promise<void> {
  const { error } = await supabase.from('tareas').delete().eq('id', id)
  if (error) throw error
}
