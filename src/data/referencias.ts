import { supabase } from '../lib/supabase'

export interface ReferenciaResumen {
  id: string
  codigo_interno: string
  nombre_producto: string
  formato: string
  categoria: string | null
  unidad: string
  unidades_por_caja: number | null // informativo (el pedido y el stock van en unidades)
  es_servicio: boolean // Transporte/Otros: concepto de coste, sin stock
  iva_pct: number
  coste_almacen_cop: number | null // PROTEGIDO: de referencia_costes; null si el rol no ve costes
  precio_food_service_cop: number | null
  precio_retail_cop: number | null
  precio_industria_cop: number | null
}

// Mapa { referencia_id: coste } desde la tabla PROTEGIDA referencia_costes.
// Por RLS, un comercial recibe [] (no puede ver costes) -> mapa vacío -> los
// consumidores obtienen coste null y no pueden reconstruir márgenes.
export async function getCostesMap(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('referencia_costes').select('referencia_id, coste_almacen_cop')
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of data ?? []) if (r.coste_almacen_cop != null) map[r.referencia_id] = r.coste_almacen_cop
  return map
}

export async function listReferencias(): Promise<ReferenciaResumen[]> {
  const [refsRes, costes] = await Promise.all([
    supabase
      .from('referencias')
      .select('id, codigo_interno, nombre_producto, formato, categoria, unidad, unidades_por_caja, es_servicio, iva_pct, precio_food_service_cop, precio_retail_cop, precio_industria_cop')
      .is('deleted_at', null)
      .order('nombre_producto'),
    getCostesMap(),
  ])
  if (refsRes.error) throw refsRes.error
  return (refsRes.data ?? []).map((r) => ({ ...r, coste_almacen_cop: costes[r.id] ?? null })) as ReferenciaResumen[]
}

// Precio base (neto) de una referencia según el canal del cliente.
// Tarifa base NETA (columna J del maestro) para el canal del cliente. Si el
// cliente no tiene canal definido —o ese canal no tiene precio cargado— se cae
// a la tarifa RETAIL por defecto, para que el pedido siempre sugiera un precio.
export function precioBaseCanal(ref: ReferenciaResumen, canal: string | null): number | null {
  switch (canal) {
    case 'food_service': return ref.precio_food_service_cop ?? ref.precio_retail_cop
    case 'industria': return ref.precio_industria_cop ?? ref.precio_retail_cop
    case 'retail': return ref.precio_retail_cop
    default: return ref.precio_retail_cop // sin canal → retail por defecto
  }
}
