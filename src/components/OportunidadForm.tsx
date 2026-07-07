import { useState } from 'react'
import type { FormEvent } from 'react'
import { ETAPAS } from '../data/constants'
import type { ClienteResumen } from '../data/clientes'
import type { Oportunidad } from '../data/oportunidades'
import type { TablesInsert } from '../types/database'

export interface OportunidadFormValues {
  cliente_id: string
  etapa: string
  valor_estimado: string
  probabilidad_cierre: string
  fecha_cierre: string
  comision_pct: string
  pac_descuento_pct: string
  plazo_pago_dias: string
}

export const OPORTUNIDAD_VACIA: OportunidadFormValues = {
  cliente_id: '',
  etapa: 'prospeccion',
  valor_estimado: '',
  probabilidad_cierre: '',
  fecha_cierre: '',
  comision_pct: '',
  pac_descuento_pct: '',
  plazo_pago_dias: '',
}

const s = (n: number | null) => (n == null ? '' : String(n))

export function oportunidadToValues(o: Oportunidad): OportunidadFormValues {
  return {
    cliente_id: o.cliente_id,
    etapa: o.etapa,
    valor_estimado: s(o.valor_estimado),
    probabilidad_cierre: s(o.probabilidad_cierre),
    fecha_cierre: o.fecha_cierre ?? '',
    comision_pct: s(o.comision_pct),
    pac_descuento_pct: s(o.pac_descuento_pct),
    plazo_pago_dias: s(o.plazo_pago_dias),
  }
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function valuesToOportunidadPayload(v: OportunidadFormValues): TablesInsert<'oportunidades'> {
  return {
    cliente_id: v.cliente_id,
    etapa: v.etapa,
    valor_estimado: numOrNull(v.valor_estimado),
    probabilidad_cierre: numOrNull(v.probabilidad_cierre),
    fecha_cierre: v.fecha_cierre || null,
    comision_pct: numOrNull(v.comision_pct),
    pac_descuento_pct: numOrNull(v.pac_descuento_pct),
    plazo_pago_dias: numOrNull(v.plazo_pago_dias),
  }
}

interface Props {
  initial: OportunidadFormValues
  clientes: ClienteResumen[]
  submitLabel: string
  onSubmit: (values: OportunidadFormValues) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function OportunidadForm({ initial, clientes, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [v, setV] = useState<OportunidadFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<OportunidadFormValues>) => setV((p) => ({ ...p, ...patch }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!v.cliente_id) {
      setError('Elige un cliente.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit(v)
    } catch {
      setError('No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field field--full">
        <span className="field__label">Cliente</span>
        <select className="input" value={v.cliente_id} onChange={(e) => set({ cliente_id: e.target.value })} required>
          <option value="">Elige un cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.codigo_interno} · {c.nombre}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Etapa</span>
        <select className="input" value={v.etapa} onChange={(e) => set({ etapa: e.target.value })}>
          {ETAPAS.map((et) => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Probabilidad de cierre (%)</span>
        <input className="input" type="number" min="0" max="100" value={v.probabilidad_cierre}
          onChange={(e) => set({ probabilidad_cierre: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Valor estimado (COP)</span>
        <input className="input" type="number" min="0" value={v.valor_estimado}
          onChange={(e) => set({ valor_estimado: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Fecha de cierre</span>
        <input className="input" type="date" value={v.fecha_cierre}
          onChange={(e) => set({ fecha_cierre: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Comisión (%)</span>
        <input className="input" type="number" step="0.01" value={v.comision_pct}
          onChange={(e) => set({ comision_pct: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">PAC descuento (%)</span>
        <input className="input" type="number" step="0.01" value={v.pac_descuento_pct}
          onChange={(e) => set({ pac_descuento_pct: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Plazo de pago (días)</span>
        <input className="input" type="number" min="0" value={v.plazo_pago_dias}
          onChange={(e) => set({ plazo_pago_dias: e.target.value })} />
      </label>

      {error && <p className="login-error field--full">{error}</p>}

      <div className="cluster cluster-3 field--full" style={{ justifyContent: 'space-between' }}>
        <div className="cluster cluster-3">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : submitLabel}
          </button>
          <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
        {onDelete && (
          <button
            className="btn btn-outline btn-sm"
            type="button"
            disabled={saving}
            onClick={async () => {
              if (confirm('¿Borrar esta oportunidad?')) await onDelete()
            }}
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
