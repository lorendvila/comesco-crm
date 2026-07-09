import { supabase } from '../lib/supabase'

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
  totalRevenue: number
  totalCogs: number
}

interface LineaRaw {
  cantidad: number
  subtotal_cop: number | null
  referencias: {
    nombre_producto: string
    formato: string
    categoria: string | null
    coste_almacen_cop: number | null
  } | null
}

// Agrega las líneas de pedido por familia y por referencia (RLS: el comercial
// solo ve las de sus clientes). Calcula ingresos y coste (COGS) para el margen.
export async function resumenProducto(): Promise<ResumenProducto> {
  const { data, error } = await supabase
    .from('pedido_lineas')
    .select('cantidad, subtotal_cop, referencias(nombre_producto, formato, categoria, coste_almacen_cop)')
    .returns<LineaRaw[]>()
  if (error) throw error

  const familias = new Map<string, number>()
  const refs = new Map<string, RefVenta>()
  let totalRevenue = 0
  let totalCogs = 0

  for (const l of data ?? []) {
    const r = l.referencias
    if (!r) continue
    const cat = r.categoria ?? 'Otros'
    const valor = l.subtotal_cop ?? 0
    totalRevenue += valor
    totalCogs += l.cantidad * (r.coste_almacen_cop ?? 0)
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
