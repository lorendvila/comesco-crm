import { supabase } from '../lib/supabase'

export interface ReferenciaResumen {
  id: string
  codigo_interno: string
  nombre_producto: string
  formato: string
  categoria: string | null
  unidad: string
  iva_pct: number
}

export async function listReferencias(): Promise<ReferenciaResumen[]> {
  const { data, error } = await supabase
    .from('referencias')
    .select('id, codigo_interno, nombre_producto, formato, categoria, unidad, iva_pct')
    .is('deleted_at', null)
    .order('nombre_producto')
  if (error) throw error
  return data ?? []
}
