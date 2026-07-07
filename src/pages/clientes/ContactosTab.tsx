import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  listContactos,
  createContacto,
  updateContacto,
  deleteContacto,
} from '../../data/contactos'
import type { Contacto } from '../../data/contactos'

interface FormState {
  nombre: string
  cargo: string
  telefono: string
  email: string
  es_principal: boolean
}

const VACIO: FormState = { nombre: '', cargo: '', telefono: '', email: '', es_principal: false }

export function ContactosTab({ clienteId }: { clienteId: string }) {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(VACIO)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    setLoading(true)
    listContactos(clienteId)
      .then(setContactos)
      .catch(() => setError('No se pudieron cargar los contactos.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [clienteId])

  const abrirNuevo = () => {
    setForm(VACIO)
    setEditId('new')
  }
  const abrirEdicion = (c: Contacto) => {
    setForm({
      nombre: c.nombre,
      cargo: c.cargo ?? '',
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      es_principal: c.es_principal ?? false,
    })
    setEditId(c.id)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre del contacto es obligatorio.')
      return
    }
    setError(null)
    const payload = {
      nombre: form.nombre.trim(),
      cargo: form.cargo.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      es_principal: form.es_principal,
    }
    try {
      if (editId === 'new') {
        await createContacto({ cliente_id: clienteId, ...payload })
      } else if (editId) {
        await updateContacto(editId, clienteId, payload)
      }
      setEditId(null)
      cargar()
    } catch {
      setError('No se pudo guardar el contacto.')
    }
  }

  const borrar = async (c: Contacto) => {
    if (!confirm(`¿Borrar el contacto "${c.nombre}"?`)) return
    await deleteContacto(c.id)
    cargar()
  }

  return (
    <div className="stack stack-4" style={{ maxWidth: 720 }}>
      {loading && <p className="t-body-sm">Cargando…</p>}

      <div className="stack stack-3">
        {contactos.map((c) => (
          <div key={c.id} className="card-accent contacto-card">
            <div className="stack stack-1">
              <div className="cluster cluster-2">
                <span className="t-sub">{c.nombre}</span>
                {c.es_principal && <span className="badge badge-filled">Principal</span>}
              </div>
              <span className="t-body-sm">
                {[c.cargo, c.telefono, c.email].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
            <div className="cluster cluster-2">
              <button className="btn btn-sm btn-outline" onClick={() => abrirEdicion(c)}>Editar</button>
              <button className="btn btn-sm btn-outline" onClick={() => borrar(c)}>Borrar</button>
            </div>
          </div>
        ))}
        {!loading && contactos.length === 0 && <p className="t-body-sm">Aún no hay contactos.</p>}
      </div>

      {editId === null ? (
        <div>
          <button className="btn btn-primary" onClick={abrirNuevo}>Añadir contacto</button>
        </div>
      ) : (
        <form className="card form-grid" onSubmit={guardar}>
          <label className="field field--full">
            <span className="field__label">Nombre</span>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field__label">Cargo</span>
            <input className="input" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">Teléfono</span>
            <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </label>
          <label className="field field--full">
            <span className="field__label">Email</span>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="cluster cluster-2 field--full" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={form.es_principal} onChange={(e) => setForm({ ...form, es_principal: e.target.checked })} />
            <span className="t-body-sm">Marcar como contacto principal</span>
          </label>
          {error && <p className="login-error field--full">{error}</p>}
          <div className="cluster cluster-3 field--full">
            <button className="btn btn-primary" type="submit">Guardar</button>
            <button className="btn btn-outline" type="button" onClick={() => setEditId(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}
