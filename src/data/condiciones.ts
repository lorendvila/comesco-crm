import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Condiciones = Tables<'condiciones_comerciales'>

export type CondicionesPatch = Omit<
  TablesInsert<'condiciones_comerciales'>,
  'cliente_id' | 'id' | 'created_at' | 'updated_at'
>

// Un cliente tiene, como mucho, un juego de condiciones.
export async function getCondiciones(clienteId: string): Promise<Condiciones | null> {
  const { data, error } = await supabase
    .from('condiciones_comerciales')
    .select('*')
    .eq('cliente_id', clienteId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveCondiciones(
  clienteId: string,
  existingId: string | null,
  patch: CondicionesPatch,
): Promise<void> {
  if (existingId) {
    const { error } = await supabase
      .from('condiciones_comerciales')
      .update(patch)
      .eq('id', existingId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('condiciones_comerciales')
      .insert({ cliente_id: clienteId, ...patch })
    if (error) throw error
  }
}
