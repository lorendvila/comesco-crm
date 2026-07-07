import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Pedido = Tables<'pedidos'>
export type PedidoLinea = Tables<'pedido_lineas'>

export interface PedidoResumen {
  id: string
  fecha_pedido: string
  estado: string
  canal_origen: string
  total_cop: number | null
  clientes: { nombre: string } | null
}

export interface LineaConRef extends PedidoLinea {
  referencias: { nombre_producto: string; formato: string; codigo_interno: string } | null
}

export interface PedidoConLineas extends Pedido {
  clientes: { nombre: string } | null
  pedido_lineas: LineaConRef[]
}

export interface LineaInput {
  referencia_id: string
  cantidad: number
  unidad: string
  precio_unitario_cop: number | null
}

function totalDe(lineas: LineaInput[]): number {
  return lineas.reduce((s, l) => s + l.cantidad * (l.precio_unitario_cop ?? 0), 0)
}

export async function listPedidos(): Promise<PedidoResumen[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, fecha_pedido, estado, canal_origen, total_cop, clientes(nombre)')
    .order('fecha_pedido', { ascending: false })
    .returns<PedidoResumen[]>()
  if (error) throw error
  return data ?? []
}

export async function getPedido(id: string): Promise<PedidoConLineas> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, clientes(nombre), pedido_lineas(*, referencias(nombre_producto, formato, codigo_interno))')
    .eq('id', id)
    .single()
    .returns<PedidoConLineas>()
  if (error) throw error
  return data
}

async function insertarLineas(pedidoId: string, lineas: LineaInput[]): Promise<void> {
  if (lineas.length === 0) return
  const rows = lineas.map((l) => ({
    pedido_id: pedidoId,
    referencia_id: l.referencia_id,
    cantidad: l.cantidad,
    unidad: l.unidad,
    precio_unitario_cop: l.precio_unitario_cop,
    subtotal_cop: l.cantidad * (l.precio_unitario_cop ?? 0),
  }))
  const { error } = await supabase.from('pedido_lineas').insert(rows)
  if (error) throw error
}

export async function createPedido(
  cabecera: TablesInsert<'pedidos'>,
  lineas: LineaInput[],
): Promise<string> {
  const { data, error } = await supabase
    .from('pedidos')
    .insert({ ...cabecera, total_cop: totalDe(lineas) })
    .select('id')
    .single()
  if (error) throw error
  await insertarLineas(data.id, lineas)
  return data.id
}

export async function updatePedido(
  id: string,
  cabecera: TablesInsert<'pedidos'>,
  lineas: LineaInput[],
): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ ...cabecera, total_cop: totalDe(lineas) })
    .eq('id', id)
  if (error) throw error
  // Reemplaza las líneas: borra las anteriores e inserta las nuevas.
  const { error: eDel } = await supabase.from('pedido_lineas').delete().eq('pedido_id', id)
  if (eDel) throw eDel
  await insertarLineas(id, lineas)
}

export async function deletePedido(id: string): Promise<void> {
  const { error } = await supabase.from('pedidos').delete().eq('id', id)
  if (error) throw error
}
