import { supabase } from '../lib/supabase'

export interface Almacen {
  id: string
  nombre: string
  ciudad: string
  activo: boolean
}

// Almacenes activos (Medellín, Bogotá; ampliable). Orden por ciudad.
export async function listAlmacenes(): Promise<Almacen[]> {
  const { data, error } = await supabase
    .from('almacenes')
    .select('id, nombre, ciudad, activo')
    .eq('activo', true)
    .order('ciudad')
    .returns<Almacen[]>()
  if (error) throw error
  return data ?? []
}
