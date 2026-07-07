import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type Contacto = Tables<'contactos_cliente'>

export async function listContactos(clienteId: string): Promise<Contacto[]> {
  const { data, error } = await supabase
    .from('contactos_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('es_principal', { ascending: false })
    .order('nombre')
  if (error) throw error
  return data ?? []
}

// Solo puede haber un principal por cliente: al marcar uno, se desmarcan los demás.
async function desmarcarPrincipales(clienteId: string): Promise<void> {
  const { error } = await supabase
    .from('contactos_cliente')
    .update({ es_principal: false })
    .eq('cliente_id', clienteId)
    .eq('es_principal', true)
  if (error) throw error
}

export async function createContacto(input: TablesInsert<'contactos_cliente'>): Promise<Contacto> {
  if (input.es_principal) await desmarcarPrincipales(input.cliente_id)
  const { data, error } = await supabase
    .from('contactos_cliente')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContacto(
  id: string,
  clienteId: string,
  patch: TablesUpdate<'contactos_cliente'>,
): Promise<Contacto> {
  if (patch.es_principal) await desmarcarPrincipales(clienteId)
  const { data, error } = await supabase
    .from('contactos_cliente')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteContacto(id: string): Promise<void> {
  const { error } = await supabase.from('contactos_cliente').delete().eq('id', id)
  if (error) throw error
}
