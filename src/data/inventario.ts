import { supabase } from '../lib/supabase'
import { listAlmacenes } from './almacenes'
import type { Almacen } from './almacenes'

// Una fila = una referencia EN un almacén. El stock se lleva en UNIDADES.
export interface InventarioFila {
  referencia_id: string
  codigo_interno: string
  sku: string | null
  nombre_producto: string
  formato: string
  categoria: string | null
  coste_almacen_cop: number | null // del maestro (referencias)
  precio_food_service_cop: number | null // tarifa neta por canal
  precio_retail_cop: number | null
  precio_industria_cop: number | null
  almacen: Almacen
  // Registro de stock en ese almacén (null si aún no existe → cantidad 0)
  inv_id: string | null
  cantidad_disponible: number
  ubicacion: string | null
  contenedor: string | null
  notas: string | null
  actualizado_at: string | null
}

interface ReferenciaRaw {
  id: string
  codigo_interno: string
  sku: string | null
  nombre_producto: string
  formato: string
  categoria: string | null
  coste_almacen_cop: number | null
  precio_food_service_cop: number | null
  precio_retail_cop: number | null
  precio_industria_cop: number | null
}

interface InventarioRecord {
  id: string
  referencia_id: string
  almacen_id: string
  cantidad_disponible: number
  ubicacion: string | null
  contenedor: string | null
  notas: string | null
  actualizado_at: string | null
}

// Cruce referencia × almacén: una fila por cada combinación, con su stock si
// existe (0 si no). Así se ve qué hay —y qué falta— en cada ciudad.
export async function listInventario(): Promise<InventarioFila[]> {
  const [refsRes, invRes, almacenes] = await Promise.all([
    supabase
      .from('referencias')
      .select('id, codigo_interno, sku, nombre_producto, formato, categoria, coste_almacen_cop, precio_food_service_cop, precio_retail_cop, precio_industria_cop')
      .is('deleted_at', null)
      .order('nombre_producto')
      .returns<ReferenciaRaw[]>(),
    supabase
      .from('inventario')
      .select('id, referencia_id, almacen_id, cantidad_disponible, ubicacion, contenedor, notas, actualizado_at')
      .returns<InventarioRecord[]>(),
    listAlmacenes(),
  ])
  if (refsRes.error) throw refsRes.error
  if (invRes.error) throw invRes.error

  const porClave = new Map<string, InventarioRecord>()
  for (const r of invRes.data ?? []) porClave.set(`${r.referencia_id}|${r.almacen_id}`, r)

  const filas: InventarioFila[] = []
  for (const r of refsRes.data ?? []) {
    for (const a of almacenes) {
      const rec = porClave.get(`${r.id}|${a.id}`) ?? null
      filas.push({
        referencia_id: r.id,
        codigo_interno: r.codigo_interno,
        sku: r.sku,
        nombre_producto: r.nombre_producto,
        formato: r.formato,
        categoria: r.categoria,
        coste_almacen_cop: r.coste_almacen_cop,
        precio_food_service_cop: r.precio_food_service_cop,
        precio_retail_cop: r.precio_retail_cop,
        precio_industria_cop: r.precio_industria_cop,
        almacen: a,
        inv_id: rec?.id ?? null,
        cantidad_disponible: rec?.cantidad_disponible ?? 0,
        ubicacion: rec?.ubicacion ?? null,
        contenedor: rec?.contenedor ?? null,
        notas: rec?.notas ?? null,
        actualizado_at: rec?.actualizado_at ?? null,
      })
    }
  }
  return filas
}

export interface TarifasPatch {
  precio_food_service_cop: number | null
  precio_retail_cop: number | null
  precio_industria_cop: number | null
}

// Tarifas base (netas) por canal — atributo del producto (maestro). Solo admin.
export async function updateTarifasReferencia(referenciaId: string, tarifas: TarifasPatch): Promise<void> {
  const { error } = await supabase.from('referencias').update(tarifas).eq('id', referenciaId)
  if (error) throw error
}

export interface InventarioPatch {
  cantidad_disponible: number
  ubicacion: string | null
  contenedor: string | null
  notas: string | null
}

// Crea o actualiza el stock de una referencia EN un almacén (clave ref+almacén).
export async function upsertInventario(referenciaId: string, almacenId: string, patch: InventarioPatch): Promise<void> {
  const { error } = await supabase
    .from('inventario')
    .upsert(
      { referencia_id: referenciaId, almacen_id: almacenId, ...patch, actualizado_at: new Date().toISOString() },
      { onConflict: 'referencia_id,almacen_id' },
    )
  if (error) throw error
}

// El coste hasta almacén es un atributo del producto (maestro). Solo admin.
export async function updateCosteReferencia(referenciaId: string, coste: number | null): Promise<void> {
  const { error } = await supabase
    .from('referencias')
    .update({ coste_almacen_cop: coste })
    .eq('id', referenciaId)
  if (error) throw error
}

// Stock por referencia y almacén (en unidades): { referencia_id: { almacen_id: unidades } }.
// Lo usa el formulario de pedido para avisar de stock según la ciudad elegida.
export type StockMap = Record<string, Record<string, number>>
export async function getStockMap(): Promise<StockMap> {
  const { data, error } = await supabase.from('inventario').select('referencia_id, almacen_id, cantidad_disponible')
  if (error) throw error
  const map: StockMap = {}
  for (const r of data ?? []) {
    ;(map[r.referencia_id] ??= {})[r.almacen_id] = r.cantidad_disponible
  }
  return map
}
