import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { listTareas, createTarea, updateTarea, deleteTarea } from '../data/tareas'
import type { TareaConCliente } from '../data/tareas'
import { listClientes } from '../data/clientes'
import type { ClienteResumen } from '../data/clientes'
import { formatFecha } from '../data/constants'

interface FormState {
  cliente_id: string
  descripcion: string
  fecha_limite: string
}

function vacio(clienteId?: string): FormState {
  return { cliente_id: clienteId ?? '', descripcion: '', fecha_limite: '' }
}

export function TareasPanel({ clienteId }: { clienteId?: string }) {
  const [items, setItems] = useState<TareaConCliente[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(vacio(clienteId))

  const cargar = () => {
    setLoading(true)
    Promise.all([
      listTareas(clienteId),
      clienteId ? Promise.resolve<ClienteResumen[]>([]) : listClientes(),
    ])
      .then(([t, c]) => {
        setItems(t)
        setClientes(c)
      })
      .catch(() => setError('No se pudieron cargar las tareas.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [clienteId])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    const cid = clienteId ?? form.cliente_id
    if (!cid) {
      setError('Elige un cliente.')
      return
    }
    if (!form.descripcion.trim()) {
      setError('Describe la tarea.')
      return
    }
    setError(null)
    try {
      await createTarea({
        cliente_id: cid,
        descripcion: form.descripcion.trim(),
        fecha_limite: form.fecha_limite || null,
      })
      setForm(vacio(clienteId))
      setOpen(false)
      cargar()
    } catch {
      setError('No se pudo guardar la tarea.')
    }
  }

  const toggle = async (t: TareaConCliente) => {
    await updateTarea(t.id, { estado: t.estado === 'completada' ? 'pendiente' : 'completada' })
    cargar()
  }

  const borrar = async (t: TareaConCliente) => {
    if (!confirm('¿Borrar esta tarea?')) return
    await deleteTarea(t.id)
    cargar()
  }

  return (
    <div className="stack stack-4">
      {!open && (
        <div>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Nueva tarea</button>
        </div>
      )}

      {open && (
        <form className="card form-grid" onSubmit={guardar}>
          {!clienteId && (
            <label className="field field--full">
              <span className="field__label">Cliente</span>
              <select className="input" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} required>
                <option value="">Elige un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.codigo_interno} · {c.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field field--full">
            <span className="field__label">Descripción</span>
            <input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field__label">Fecha límite</span>
            <input className="input" type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
          </label>
          {error && <p className="login-error field--full">{error}</p>}
          <div className="cluster cluster-3 field--full">
            <button className="btn btn-primary" type="submit">Guardar</button>
            <button className="btn btn-outline" type="button" onClick={() => { setOpen(false); setError(null) }}>Cancelar</button>
          </div>
        </form>
      )}

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && !open && <p className="login-error">{error}</p>}

      <div className="stack">
        {items.map((t) => (
          <div key={t.id} className={'tarea-row' + (t.estado === 'completada' ? ' tarea-row--done' : '')}>
            <input type="checkbox" checked={t.estado === 'completada'} onChange={() => toggle(t)} />
            <div className="tarea-row__desc stack stack-1">
              <span className="t-body">{t.descripcion}</span>
              <span className="t-caption">
                {t.fecha_limite ? `Límite: ${formatFecha(t.fecha_limite)}` : 'Sin fecha'}
                {!clienteId && t.clientes ? ` · ${t.clientes.nombre}` : ''}
              </span>
            </div>
            <button className="btn btn-sm btn-outline" onClick={() => borrar(t)}>Borrar</button>
          </div>
        ))}
        {!loading && items.length === 0 && <p className="t-body-sm">No hay tareas.</p>}
      </div>
    </div>
  )
}
