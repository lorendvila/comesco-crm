import { useState } from 'react'
import type { FormEvent } from 'react'
import { CANALES, ESTADOS } from '../data/constants'
import type { UsuarioResumen } from '../data/users'
import type { Cliente } from '../data/clientes'
import type { TablesInsert } from '../types/database'

export interface ClienteFormValues {
  nombre: string
  razon_social: string
  nit: string
  email_facturacion: string
  canal: string
  estado: string
  ciudad: string
  pais: string
  direccion_entrega: string
  notas: string
  comercial_asignado_id: string
}

export const VALORES_VACIOS: ClienteFormValues = {
  nombre: '',
  razon_social: '',
  nit: '',
  email_facturacion: '',
  canal: '',
  estado: 'lead',
  ciudad: '',
  pais: 'Colombia',
  direccion_entrega: '',
  notas: '',
  comercial_asignado_id: '',
}

export function clienteToValues(c: Cliente): ClienteFormValues {
  return {
    nombre: c.nombre,
    razon_social: c.razon_social ?? '',
    nit: c.nit ?? '',
    email_facturacion: c.email_facturacion ?? '',
    canal: c.canal ?? '',
    estado: c.estado,
    ciudad: c.ciudad ?? '',
    pais: c.pais ?? '',
    direccion_entrega: c.direccion_entrega ?? '',
    notas: c.notas ?? '',
    comercial_asignado_id: c.comercial_asignado_id ?? '',
  }
}

export function valuesToPayload(v: ClienteFormValues): TablesInsert<'clientes'> {
  return {
    nombre: v.nombre.trim(),
    razon_social: v.razon_social.trim() || null,
    nit: v.nit.trim() || null,
    email_facturacion: v.email_facturacion.trim() || null,
    canal: v.canal || null,
    estado: v.estado,
    ciudad: v.ciudad.trim() || null,
    pais: v.pais.trim() || null,
    direccion_entrega: v.direccion_entrega.trim() || null,
    notas: v.notas.trim() || null,
    comercial_asignado_id: v.comercial_asignado_id || null,
  }
}

interface Props {
  initial: ClienteFormValues
  isAdmin: boolean
  usuarios: UsuarioResumen[]
  submitLabel: string
  onSubmit: (values: ClienteFormValues) => Promise<void>
  onCancel: () => void
}

export function ClienteForm({ initial, isAdmin, usuarios, submitLabel, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<ClienteFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<ClienteFormValues>) => setV((prev) => ({ ...prev, ...patch }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!v.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    const email = v.email_facturacion.trim()
    if (!email) {
      setError('El email de facturación electrónica es obligatorio.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('El email de facturación no tiene un formato válido.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit(v)
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field field--full">
        <span className="field__label">Nombre (comercial / marca)</span>
        <input className="input" value={v.nombre} onChange={(e) => set({ nombre: e.target.value })} required />
      </label>

      <label className="field field--full">
        <span className="field__label">Razón social (facturación)</span>
        <input className="input" value={v.razon_social} onChange={(e) => set({ razon_social: e.target.value })} />
      </label>

      <label className="field field--full">
        <span className="field__label">NIT (facturación / cobranza)</span>
        <input className="input" value={v.nit} onChange={(e) => set({ nit: e.target.value })} />
      </label>

      <label className="field field--full">
        <span className="field__label">Email de facturación electrónica *</span>
        <input
          className="input"
          type="email"
          placeholder="facturas@cliente.com"
          value={v.email_facturacion}
          onChange={(e) => set({ email_facturacion: e.target.value })}
          required
        />
      </label>

      <label className="field">
        <span className="field__label">Canal</span>
        <select className="input" value={v.canal} onChange={(e) => set({ canal: e.target.value })}>
          <option value="">Sin definir</option>
          {CANALES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Estado</span>
        <select className="input" value={v.estado} onChange={(e) => set({ estado: e.target.value })}>
          {ESTADOS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Ciudad</span>
        <input className="input" value={v.ciudad} onChange={(e) => set({ ciudad: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">País</span>
        <input className="input" value={v.pais} onChange={(e) => set({ pais: e.target.value })} />
      </label>

      {isAdmin && (
        <label className="field field--full">
          <span className="field__label">Comercial asignado</span>
          <select
            className="input"
            value={v.comercial_asignado_id}
            onChange={(e) => set({ comercial_asignado_id: e.target.value })}
          >
            <option value="">Sin asignar</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
            ))}
          </select>
        </label>
      )}

      <label className="field field--full">
        <span className="field__label">Dirección de entrega</span>
        <textarea
          className="textarea"
          value={v.direccion_entrega}
          onChange={(e) => set({ direccion_entrega: e.target.value })}
        />
      </label>

      <label className="field field--full">
        <span className="field__label">Notas</span>
        <textarea className="textarea" value={v.notas} onChange={(e) => set({ notas: e.target.value })} />
      </label>

      {error && <p className="login-error field--full">{error}</p>}

      <div className="cluster cluster-3 field--full">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
        <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
