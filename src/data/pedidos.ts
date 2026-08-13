import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Pedido = Tables<'pedidos'>
export type PedidoLinea = Tables<'pedido_lineas'>

export interface PedidoResumen {
  id: string
  numero_pedido: string | null
  fecha_pedido: string
  estado: string
  canal_origen: string
  total_cop: number | null
  numero_factura: string | null
  fecha_vencimiento: string | null
  valor_factura: number | null
  pagado: number | null
  clientes: { nombre: string } | null
}

export interface LineaConRef extends PedidoLinea {
  referencias: { nombre_producto: string; formato: string; codigo_interno: string } | null
}

export interface PedidoConLineas extends Pedido {
  numero_pedido: string | null
  clientes: { nombre: string } | null
  pedido_lineas: LineaConRef[]
}

// El número OC lo asigna la base de datos (trigger). Este RPC devuelve el
// siguiente número para mostrarlo en el formulario antes de guardar.
export async function siguienteNumeroPedido(): Promise<string> {
  const { data, error } = await supabase.rpc('siguiente_numero_pedido')
  if (error) throw error
  return (data as string) ?? ''
}

export interface LineaInput {
  referencia_id: string
  cantidad: number
  unidad: string
  precio_unitario_cop: number | null // final unitario CON IVA (calculado)
  precio_base_cop: number | null // tarifa neta del canal (antes de descuento)
  descuento_pct: number | null // % descuento aplicado en la línea
}

function totalDe(lineas: LineaInput[]): number {
  return lineas.reduce((s, l) => s + l.cantidad * (l.precio_unitario_cop ?? 0), 0)
}

export interface FiltroPedidos {
  desde?: string
  hasta?: string
  clienteId?: string
  estado?: string
}

export async function listPedidos(f: FiltroPedidos = {}): Promise<PedidoResumen[]> {
  let q = supabase
    .from('pedidos')
    .select('id, numero_pedido, fecha_pedido, estado, canal_origen, total_cop, numero_factura, fecha_vencimiento, valor_factura, pagado, clientes(nombre)')
    .order('numero_pedido', { ascending: false })
  if (f.desde) q = q.gte('fecha_pedido', f.desde)
  if (f.hasta) q = q.lte('fecha_pedido', f.hasta)
  if (f.clienteId) q = q.eq('cliente_id', f.clienteId)
  if (f.estado) q = q.eq('estado', f.estado)
  const { data, error } = await q.returns<PedidoResumen[]>()
  if (error) throw error
  return data ?? []
}

// ---- Export ----

interface PedidoExport {
  fecha_pedido: string
  fecha_entrega: string | null
  fecha_factura: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
  numero_factura: string | null
  valor_factura: number | null
  pagado: number | null
  canal_origen: string
  estado: string
  total_cop: number | null
  clientes: { nombre: string; razon_social: string | null } | null
}

export interface LineaExportRow {
  fecha_pedido: string
  fecha_entrega: string | null
  fecha_factura: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
  cliente: string
  razon_social: string
  canal_origen: string
  estado: string
  numero_factura: string | null
  valor_factura: number | null
  pagado: number | null
  referencia: string
  formato: string
  categoria: string
  cantidad: number
  unidad: string
  precio: number | null
  subtotal: number | null
}

function aplicarFiltros<T>(q: T & { gte: Function; lte: Function; eq: Function }, f: FiltroPedidos): T {
  let r = q
  if (f.desde) r = r.gte('fecha_pedido', f.desde)
  if (f.hasta) r = r.lte('fecha_pedido', f.hasta)
  if (f.clienteId) r = r.eq('cliente_id', f.clienteId)
  if (f.estado) r = r.eq('estado', f.estado)
  return r
}

export async function listPedidosExport(f: FiltroPedidos): Promise<PedidoExport[]> {
  const base = supabase
    .from('pedidos')
    .select('fecha_pedido, fecha_entrega, fecha_factura, fecha_vencimiento, fecha_pago, numero_factura, valor_factura, pagado, canal_origen, estado, total_cop, clientes(nombre, razon_social)')
    .order('fecha_pedido', { ascending: false })
  const { data, error } = await aplicarFiltros(base, f).returns<PedidoExport[]>()
  if (error) throw error
  return data ?? []
}

interface PedidoConLineasExport {
  fecha_pedido: string
  fecha_entrega: string | null
  fecha_factura: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
  canal_origen: string
  estado: string
  numero_factura: string | null
  valor_factura: number | null
  pagado: number | null
  clientes: { nombre: string; razon_social: string | null } | null
  pedido_lineas: {
    cantidad: number
    unidad: string
    precio_unitario_cop: number | null
    subtotal_cop: number | null
    referencias: { nombre_producto: string; formato: string; categoria: string | null } | null
  }[]
}

export async function listLineasExport(f: FiltroPedidos): Promise<LineaExportRow[]> {
  const base = supabase
    .from('pedidos')
    .select('fecha_pedido, fecha_entrega, fecha_factura, fecha_vencimiento, fecha_pago, canal_origen, estado, numero_factura, valor_factura, pagado, clientes(nombre, razon_social), pedido_lineas(cantidad, unidad, precio_unitario_cop, subtotal_cop, referencias(nombre_producto, formato, categoria))')
    .order('fecha_pedido', { ascending: false })
  const { data, error } = await aplicarFiltros(base, f).returns<PedidoConLineasExport[]>()
  if (error) throw error
  const rows: LineaExportRow[] = []
  for (const p of data ?? []) {
    for (const l of p.pedido_lineas) {
      rows.push({
        fecha_pedido: p.fecha_pedido,
        fecha_entrega: p.fecha_entrega,
        fecha_factura: p.fecha_factura,
        fecha_vencimiento: p.fecha_vencimiento,
        fecha_pago: p.fecha_pago,
        cliente: p.clientes?.nombre ?? '',
        razon_social: p.clientes?.razon_social ?? '',
        canal_origen: p.canal_origen,
        estado: p.estado,
        numero_factura: p.numero_factura,
        valor_factura: p.valor_factura,
        pagado: p.pagado,
        referencia: l.referencias?.nombre_producto ?? '',
        formato: l.referencias?.formato ?? '',
        categoria: l.referencias?.categoria ?? '',
        cantidad: l.cantidad,
        unidad: l.unidad,
        precio: l.precio_unitario_cop,
        subtotal: l.subtotal_cop,
      })
    }
  }
  return rows
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
    precio_base_cop: l.precio_base_cop,
    descuento_pct: l.descuento_pct,
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

// ---- Ciclo de vida (solo cabecera; NO reescribe líneas) ----
// La BD (mig 0027) hace el trabajo pesado: al cambiar `estado` a/desde
// anulado/cancelado, el trigger de frontera repone o descuenta stock de forma
// atómica y valida disponibilidad. Aquí solo emitimos el UPDATE mínimo.

// Pedido no facturado -> Cancelar (repone stock).
export async function cancelarPedido(id: string): Promise<void> {
  const { error } = await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', id)
  if (error) throw error
}

// Pedido facturado -> Anular con nota de crédito (repone stock + guarda NC).
// Va en un único UPDATE: OLD.estado aún consume, así que el freeze de cabecera
// no aplica y el NC entra junto con el cambio de estado.
export async function anularPedido(
  id: string,
  nc: { numero: string; fecha: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'anulado', nota_credito_numero: nc.numero, nota_credito_fecha: nc.fecha })
    .eq('id', id)
  if (error) throw error
}

// Pedido cancelado/anulado -> Reactivar. La BD valida stock (error atómico si
// falta) y descuenta. `estadoDestino` es el estado consumidor al que vuelve.
export async function reactivarPedido(id: string, estadoDestino: string): Promise<void> {
  const { error } = await supabase.from('pedidos').update({ estado: estadoDestino }).eq('id', id)
  if (error) throw error
}

// Guardado limitado para pedidos anulados/cancelados: solo campos que el freeze
// de la BD permite (notas, documentación, NC). Nunca toca líneas ni económicos.
export async function updateNotasDoc(
  id: string,
  patch: { notas: string | null; nota_credito_numero?: string | null; nota_credito_fecha?: string | null },
): Promise<void> {
  const { error } = await supabase.from('pedidos').update(patch).eq('id', id)
  if (error) throw error
}

// Traduce el mensaje de error de la BD a algo legible para el usuario: los
// triggers de stock devuelven UUIDs de referencia/almacén; los sustituimos por
// nombres. Si no reconocemos el error, devolvemos el propio mensaje (mejor que
// un genérico); solo caemos al genérico si no hay mensaje.
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
export function mensajeErrorPedido(
  err: unknown,
  referencias: { id: string; nombre_producto: string; formato: string }[],
  almacenes: { id: string; ciudad: string }[],
): string {
  const raw =
    (err as { message?: string } | null)?.message ?? (typeof err === 'string' ? err : '')
  if (!raw) return 'No se pudo completar la operación. Inténtalo de nuevo.'
  const map = new Map<string, string>()
  for (const r of referencias) map.set(r.id.toLowerCase(), `${r.nombre_producto} · ${r.formato}`)
  for (const a of almacenes) map.set(a.id.toLowerCase(), a.ciudad)
  return raw.replace(RE_UUID, (u) => map.get(u.toLowerCase()) ?? u)
}
