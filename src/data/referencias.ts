import { supabase } from '../lib/supabase'

export interface ReferenciaResumen {
  id: string
  codigo_interno: string
  nombre_producto: string
  formato: string
  categoria: string | null
  unidad: string
  iva_pct: number
  coste_almacen_cop: number | null // OJO: viene del maestro CON IVA incluido
  precio_food_service_cop: number | null
  precio_retail_cop: number | null
  precio_industria_cop: number | null
}

export async function listReferencias(): Promise<ReferenciaResumen[]> {
  const { data, error } = await supabase
    .from('referencias')
    .select('id, codigo_interno, nombre_producto, formato, categoria, unidad, iva_pct, coste_almacen_cop, precio_food_service_cop, precio_retail_cop, precio_industria_cop')
    .is('deleted_at', null)
    .order('nombre_producto')
  if (error) throw error
  return data ?? []
}

// Precio base (neto) de una referencia según el canal del cliente.
export function precioBaseCanal(ref: ReferenciaResumen, canal: string | null): number | null {
  switch (canal) {
    case 'food_service': return ref.precio_food_service_cop
    case 'retail': return ref.precio_retail_cop
    case 'industria': return ref.precio_industria_cop
    default: return null
  }
}
