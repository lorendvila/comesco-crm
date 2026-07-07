import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { listActividades, createActividad } from '../data/actividades'
import type { ActividadConCliente } from '../data/actividades'
import { listClientes } from '../data/clientes'
import type { ClienteResumen } from '../data/clientes'
import { TIPOS_ACTIVIDAD, ESTADOS_ACTIVIDAD, labelDe, formatFechaHora } from '../data/constants'

interface FormState {
  cliente_id: string
  tipo: string
  estado: string
  fecha: string
  notas: string
}

function vacio(clienteId?: string): FormState {
  return { cliente_id: clienteId ?? '', tipo: 'llamada', estado: 'realizada', fecha: '', notas: '' }
}

export function ActividadPanel({ clienteId }: { clienteId?: string }) {
  const { profile } = useAuth()
  const [items, setItems] = useState<ActividadConCliente[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(vacio(clienteId))

  const cargar = () => {
    setLoading(true)
    Promise.all([
      listActividades(clienteId),
      clienteId ? Promise.resolve<ClienteResumen[]>([]) : listClientes(),
    ])
      .then(([a, c]) => {
        setItems(a)
        setClientes(c)
      })
      .catch(() => setError('No se pudo cargar la actividad.'))
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
    if (!profile) return
    setError(null)
    try {
      await createActividad({
        cliente_id: cid,
        user_id: profile.id,
        tipo: form.tipo,
        estado: form.estado,
        fecha: form.fecha ? new Date(form.fecha).toISOString() : undefined,
        notas: form.notas.trim() || null,
      })
      setForm(vacio(clienteId))
      setOpen(false)
      cargar()
    } catch {
      setError('No se pudo guardar la actividad.')
    }
  }

  return (
    <div className="stack stack-4">
      {!open && (
        <div>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Registrar actividad</button>
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
          <label className="field">
            <span className="field__label">Tipo</span>
            <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS_ACTIVIDAD.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Estado</span>
            <select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_ACTIVIDAD.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="field field--full">
            <span className="field__label">Fecha (dejar vacío = ahora; futura = programada)</span>
            <input className="input" type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </label>
          <label className="field field--full">
            <span className="field__label">Notas</span>
            <textarea className="textarea" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
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

      <div className="stack stack-2">
        {items.map((a) => (
          <div key={a.id} className={'activity-item' + (a.estado === 'programada' ? ' activity-item--programada' : '')}>
            <div className="cluster cluster-2">
              <span className="t-sub">{labelDe(TIPOS_ACTIVIDAD, a.tipo)}</span>
              {a.estado === 'programada' && <span className="badge">Programada</span>}
              <span className="t-caption">{formatFechaHora(a.fecha)}</span>
            </div>
            {!clienteId && <span className="t-body-sm">{a.clientes?.nombre ?? '—'}</span>}
            {a.notas && <span className="t-body-sm">{a.notas}</span>}
          </div>
        ))}
        {!loading && items.length === 0 && <p className="t-body-sm">Aún no hay actividad registrada.</p>}
      </div>
    </div>
  )
}
