import { supabase } from '../lib/supabase'

export interface InventarioInv {
  id: string
  cantidad_disponible: number
  ubicacion: string | null
  contenedor: string | null
  valor_unitario_cop: number | null
  notas: string | null
  actualizado_at: string | null
}

export interface InventarioFila {
  referencia_id: string
  codigo_interno: string
  sku: string | null
  nombre_producto: string
  formato: string
  categoria: string | null
  inv: InventarioInv | null
}

interface InventarioRaw {
  id: string
  codigo_interno: string
  sku: string | null
  nombre_producto: string
  formato: string
  categoria: string | null
  // Relación 1-a-1 (índice único en referencia_id): objeto o null, no lista.
  inventario: InventarioInv | null
}

// Una fila por referencia (con su stock si existe).
export async function listInventario(): Promise<InventarioFila[]> {
  const { data, error } = await supabase
    .from('referencias')
    .select('id, codigo_interno, sku, nombre_producto, formato, categoria, inventario(id, cantidad_disponible, ubicacion, contenedor, valor_unitario_cop, notas, actualizado_at)')
    .is('deleted_at', null)
    .order('nombre_producto')
    .returns<InventarioRaw[]>()
  if (error) throw error
  return (data ?? []).map((r) => ({
    referencia_id: r.id,
    codigo_interno: r.codigo_interno,
    sku: r.sku,
    nombre_producto: r.nombre_producto,
    formato: r.formato,
    categoria: r.categoria,
    inv: r.inventario ?? null,
  }))
}

export interface InventarioPatch {
  cantidad_disponible: number
  ubicacion: string | null
  contenedor: string | null
  valor_unitario_cop: number | null
  notas: string | null
}

// Crea o actualiza el stock de una referencia (una fila por referencia).
export async function upsertInventario(referenciaId: string, patch: InventarioPatch): Promise<void> {
  const { error } = await supabase
    .from('inventario')
    .upsert(
      { referencia_id: referenciaId, ...patch, actualizado_at: new Date().toISOString() },
      { onConflict: 'referencia_id' },
    )
  if (error) throw error
}

// Mapa referencia_id -> cantidad disponible (para el aviso de stock en pedidos).
export async function getStockMap(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('inventario').select('referencia_id, cantidad_disponible')
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of data ?? []) map[r.referencia_id] = r.cantidad_disponible
  return map
}
