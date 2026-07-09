import { supabase } from '../lib/supabase'

export interface ItemSeguimiento {
  key: string
  origen: 'actividad' | 'tarea'
  id: string
  cliente: string
  clienteId: string
  tipo: string | null // tipo de actividad (llamada/email…) o null si es tarea
  accion: string
  fecha: string | null // YYYY-MM-DD
}

interface ActRaw {
  id: string
  tipo: string
  fecha: string | null
  notas: string | null
  cliente_id: string
  clientes: { nombre: string } | null
}
interface TareaRaw {
  id: string
  descripcion: string
  fecha_limite: string | null
  cliente_id: string
  clientes: { nombre: string } | null
}

// Pendientes = actividades PROGRAMADAS + tareas PENDIENTES (RLS: solo lo del rol).
export async function listSeguimiento(): Promise<ItemSeguimiento[]> {
  const [actsRes, tareasRes] = await Promise.all([
    supabase
      .from('actividades')
      .select('id, tipo, fecha, notas, cliente_id, clientes(nombre)')
      .eq('estado', 'programada')
      .returns<ActRaw[]>(),
    supabase
      .from('tareas')
      .select('id, descripcion, fecha_limite, cliente_id, clientes(nombre)')
      .eq('estado', 'pendiente')
      .returns<TareaRaw[]>(),
  ])
  if (actsRes.error) throw actsRes.error
  if (tareasRes.error) throw tareasRes.error

  const items: ItemSeguimiento[] = []
  for (const a of actsRes.data ?? []) {
    items.push({
      key: 'a' + a.id,
      origen: 'actividad',
      id: a.id,
      cliente: a.clientes?.nombre ?? '—',
      clienteId: a.cliente_id,
      tipo: a.tipo,
      accion: a.notas ?? '',
      fecha: a.fecha ? a.fecha.slice(0, 10) : null,
    })
  }
  for (const t of tareasRes.data ?? []) {
    items.push({
      key: 't' + t.id,
      origen: 'tarea',
      id: t.id,
      cliente: t.clientes?.nombre ?? '—',
      clienteId: t.cliente_id,
      tipo: null,
      accion: t.descripcion,
      fecha: t.fecha_limite,
    })
  }
  // Orden por fecha ascendente (lo más urgente primero); sin fecha, al final.
  items.sort((x, y) => {
    if (!x.fecha) return 1
    if (!y.fecha) return -1
    return x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0
  })
  return items
}

export async function marcarHecha(item: ItemSeguimiento): Promise<void> {
  if (item.origen === 'actividad') {
    const { error } = await supabase.from('actividades').update({ estado: 'realizada' }).eq('id', item.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('tareas').update({ estado: 'completada' }).eq('id', item.id)
    if (error) throw error
  }
}
