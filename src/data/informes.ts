import { supabase } from '../lib/supabase'
import { costeRealNeto } from './constants'
import { listInventario } from './inventario'

export interface FamiliaUnidades {
  categoria: string
  unidades: number
}

export interface RefVenta {
  nombre: string
  formato: string
  categoria: string | null
  unidades: number
  valor: number
}

export interface ResumenProducto {
  porFamilia: FamiliaUnidades[]
  topReferencias: RefVenta[]
  totalRevenue: number // venta NETA (sin IVA) — base del margen
  totalCogs: number // coste REAL neto (landed sin IVA + comisión del 5%)
}

interface LineaRaw {
  cantidad: number
  subtotal_cop: number | null
  pedidos: { estado: string } | null
  referencias: {
    nombre_producto: string
    formato: string
    categoria: string | null
    coste_almacen_cop: number | null
    iva_pct: number | null
  } | null
}

// Estados que NO cuentan como venta: cancelado y anulado (factura con NC).
const ESTADOS_NO_VENTA = ['cancelado', 'anulado']

// Agrega las líneas de pedido por familia y por referencia (RLS: el comercial
// solo ve las de sus clientes). Calcula ingresos y coste (COGS) para el margen.
export async function resumenProducto(): Promise<ResumenProducto> {
  const { data, error } = await supabase
    .from('pedido_lineas')
    .select('cantidad, subtotal_cop, pedidos(estado), referencias(nombre_producto, formato, categoria, coste_almacen_cop, iva_pct)')
    .returns<LineaRaw[]>()
  if (error) throw error

  const familias = new Map<string, number>()
  const refs = new Map<string, RefVenta>()
  let totalRevenue = 0
  let totalCogs = 0

  for (const l of data ?? []) {
    const r = l.referencias
    if (!r) continue
    if (l.pedidos && ESTADOS_NO_VENTA.includes(l.pedidos.estado)) continue
    const cat = r.categoria ?? 'Otros'
    const iva = r.iva_pct ?? 0
    const valor = l.subtotal_cop ?? 0 // importe facturado (con IVA), para las tablas de producto
    // Margen real = venta y coste AMBOS sin IVA, y contra el coste REAL: el del
    // maestro viene con IVA incluido y además hay que sumarle la comisión del 5%.
    totalRevenue += valor / (1 + iva / 100)
    totalCogs += l.cantidad * (costeRealNeto(r.coste_almacen_cop, iva) ?? 0)
    familias.set(cat, (familias.get(cat) ?? 0) + l.cantidad)
    const key = `${r.nombre_producto} ${r.formato}`
    const prev = refs.get(key)
    if (prev) {
      prev.unidades += l.cantidad
      prev.valor += valor
    } else {
      refs.set(key, { nombre: r.nombre_producto, formato: r.formato, categoria: r.categoria, unidades: l.cantidad, valor })
    }
  }

  return {
    porFamilia: [...familias.entries()].map(([categoria, unidades]) => ({ categoria, unidades })).sort((a, b) => b.unidades - a.unidades),
    topReferencias: [...refs.values()].sort((a, b) => b.valor - a.valor).slice(0, 6),
    totalRevenue,
    totalCogs,
  }
}

// ---- Facturación mensual ----

export interface MesFacturacion {
  mes: string // 'YYYY-MM'
  numPedidos: number
  facturado: number
  cobrado: number
  pendiente: number
}

interface PedidoMesRaw {
  fecha_pedido: string
  fecha_factura: string | null
  valor_factura: number | null
  pagado: number | null
  total_cop: number | null
}

// Agrupa la facturación por mes (usa la fecha de factura; si no hay, la del
// pedido). Ignora los pedidos cancelados. RLS: cada comercial ve solo los suyos.
export async function facturacionMensual(): Promise<MesFacturacion[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('fecha_pedido, fecha_factura, valor_factura, pagado, total_cop')
    .not('estado', 'in', '(cancelado,anulado)')
    .returns<PedidoMesRaw[]>()
  if (error) throw error

  const map = new Map<string, MesFacturacion>()
  for (const p of data ?? []) {
    const base = p.fecha_factura ?? p.fecha_pedido
    if (!base) continue
    const mes = base.slice(0, 7)
    const valor = p.valor_factura ?? p.total_cop ?? 0
    const pagado = p.pagado ?? 0
    const row = map.get(mes) ?? { mes, numPedidos: 0, facturado: 0, cobrado: 0, pendiente: 0 }
    row.numPedidos += 1
    row.facturado += valor
    row.cobrado += pagado
    row.pendiente += Math.max(0, valor - pagado)
    map.set(mes, row)
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

// ---- Rotación (unidades/mes por referencia) + demanda estimada ----

export interface RefRotacion {
  referencia_id: string
  nombre: string
  formato: string
  categoria: string | null
  unidad: string
  porMes: Record<string, number> // 'YYYY-MM' -> unidades vendidas ese mes
  total: number // unidades vendidas en todo el periodo
  demandaMensual: number // media de unidades/mes en la ventana (últimos N meses)
  stock: number
  coberturaMeses: number | null // stock / demandaMensual (null si demanda 0)
}

export interface RotacionReferencias {
  meses: string[] // todos los meses del rango (columnas de la matriz), asc
  mesesVentana: string[] // los últimos N meses usados para la demanda
  refs: RefRotacion[]
}

interface LineaRotacionRaw {
  cantidad: number
  pedidos: { fecha_pedido: string; fecha_factura: string | null; estado: string } | null
  referencias: {
    id: string
    nombre_producto: string
    formato: string
    categoria: string | null
    unidad: string
  } | null
}

interface RefRotAcc {
  referencia_id: string
  nombre: string
  formato: string
  categoria: string | null
  unidad: string
  porMes: Map<string, number>
  total: number
}

// Enumera los meses contiguos entre dos 'YYYY-MM' (ambos incluidos).
function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [y, m] = desde.split('-').map(Number)
  const [hy, hm] = hasta.split('-').map(Number)
  while (y < hy || (y === hy && m <= hm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

// Unidades (cajas) vendidas por referencia y por mes, para ver la evolución.
// La demanda mensual estimada = media de los últimos `ventana` meses (incluyendo
// los meses a cero); al principio, con poco histórico, usa los meses que haya.
export async function rotacionReferencias(ventana = 6): Promise<RotacionReferencias> {
  const [lineasRes, inventario] = await Promise.all([
    supabase
      .from('pedido_lineas')
      .select('cantidad, pedidos(fecha_pedido, fecha_factura, estado), referencias(id, nombre_producto, formato, categoria, unidad)')
      .returns<LineaRotacionRaw[]>(),
    listInventario(),
  ])
  if (lineasRes.error) throw lineasRes.error

  const acc = new Map<string, RefRotAcc>()
  let minMes: string | null = null
  let maxMes: string | null = null
  for (const l of lineasRes.data ?? []) {
    const r = l.referencias
    if (!r) continue
    if (l.pedidos && ESTADOS_NO_VENTA.includes(l.pedidos.estado)) continue
    const base = l.pedidos?.fecha_factura ?? l.pedidos?.fecha_pedido
    if (!base) continue
    const mes = base.slice(0, 7)
    if (minMes === null || mes < minMes) minMes = mes
    if (maxMes === null || mes > maxMes) maxMes = mes
    const prev = acc.get(r.id) ?? {
      referencia_id: r.id,
      nombre: r.nombre_producto,
      formato: r.formato,
      categoria: r.categoria,
      unidad: r.unidad,
      porMes: new Map<string, number>(),
      total: 0,
    }
    prev.porMes.set(mes, (prev.porMes.get(mes) ?? 0) + l.cantidad)
    prev.total += l.cantidad
    acc.set(r.id, prev)
  }

  // Rango de columnas: del primer mes con ventas hasta el mes actual (así los
  // meses recientes sin ventas cuentan como 0 en la demanda).
  const hoyMes = new Date().toISOString().slice(0, 7)
  const meses = minMes ? mesesEntre(minMes, maxMes && maxMes > hoyMes ? maxMes : hoyMes) : []
  const mesesVentana = meses.slice(-ventana)

  // Stock por referencia = suma de todos los almacenes (una fila por ciudad).
  const stockPorRef = new Map<string, number>()
  for (const f of inventario) stockPorRef.set(f.referencia_id, (stockPorRef.get(f.referencia_id) ?? 0) + f.cantidad_disponible)

  const refs: RefRotacion[] = [...acc.values()].map((a) => {
    const porMes: Record<string, number> = {}
    for (const mes of meses) porMes[mes] = a.porMes.get(mes) ?? 0
    const enVentana = mesesVentana.reduce((s, mes) => s + (a.porMes.get(mes) ?? 0), 0)
    const demandaMensual = mesesVentana.length > 0 ? enVentana / mesesVentana.length : 0
    const stock = stockPorRef.get(a.referencia_id) ?? 0
    return {
      referencia_id: a.referencia_id,
      nombre: a.nombre,
      formato: a.formato,
      categoria: a.categoria,
      unidad: a.unidad,
      porMes,
      total: a.total,
      demandaMensual,
      stock,
      coberturaMeses: demandaMensual > 0 ? stock / demandaMensual : null,
    }
  })

  refs.sort((a, b) => b.total - a.total)
  return { meses, mesesVentana, refs }
}
