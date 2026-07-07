import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCondiciones, saveCondiciones } from '../../data/condiciones'
import type { Condiciones } from '../../data/condiciones'
import { formatCOP } from '../../data/constants'

interface FormState {
  plazo_pago_dias: string
  comision_pct: string
  pac_descuento_pct: string
  precio_especial: string
}

const VACIO: FormState = { plazo_pago_dias: '', comision_pct: '', pac_descuento_pct: '', precio_especial: '' }

function toForm(c: Condiciones): FormState {
  const s = (n: number | null) => (n == null ? '' : String(n))
  return {
    plazo_pago_dias: s(c.plazo_pago_dias),
    comision_pct: s(c.comision_pct),
    pac_descuento_pct: s(c.pac_descuento_pct),
    precio_especial: s(c.precio_especial),
  }
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="dato">
      <span className="field__label">{label}</span>
      <span className="t-body">{value}</span>
    </div>
  )
}

const pct = (n: number | null) => (n == null ? '—' : `${n} %`)
const dias = (n: number | null) => (n == null ? '—' : `${n} días`)

export function CondicionesTab({ clienteId }: { clienteId: string }) {
  const [cond, setCond] = useState<Condiciones | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<FormState>(VACIO)

  const cargar = () => {
    setLoading(true)
    getCondiciones(clienteId)
      .then(setCond)
      .catch(() => setError('No se pudieron cargar las condiciones.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [clienteId])

  const abrir = () => {
    setForm(cond ? toForm(cond) : VACIO)
    setEditando(true)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await saveCondiciones(clienteId, cond?.id ?? null, {
        plazo_pago_dias: numOrNull(form.plazo_pago_dias),
        comision_pct: numOrNull(form.comision_pct),
        pac_descuento_pct: numOrNull(form.pac_descuento_pct),
        precio_especial: numOrNull(form.precio_especial),
      })
      setEditando(false)
      cargar()
    } catch {
      setError('No se pudieron guardar las condiciones.')
    }
  }

  if (loading) return <p className="t-body-sm">Cargando…</p>

  if (editando) {
    return (
      <form className="card form-grid" style={{ maxWidth: 640 }} onSubmit={guardar}>
        <label className="field">
          <span className="field__label">Plazo de pago (días)</span>
          <input className="input" type="number" min="0" value={form.plazo_pago_dias} onChange={(e) => setForm({ ...form, plazo_pago_dias: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Comisión (%)</span>
          <input className="input" type="number" step="0.01" value={form.comision_pct} onChange={(e) => setForm({ ...form, comision_pct: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">PAC descuento (%)</span>
          <input className="input" type="number" step="0.01" value={form.pac_descuento_pct} onChange={(e) => setForm({ ...form, pac_descuento_pct: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Precio especial (COP)</span>
          <input className="input" type="number" min="0" value={form.precio_especial} onChange={(e) => setForm({ ...form, precio_especial: e.target.value })} />
        </label>
        {error && <p className="login-error field--full">{error}</p>}
        <div className="cluster cluster-3 field--full">
          <button className="btn btn-primary" type="submit">Guardar</button>
          <button className="btn btn-outline" type="button" onClick={() => { setEditando(false); setError(null) }}>Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <div className="stack stack-4" style={{ maxWidth: 640 }}>
      {error && <p className="login-error">{error}</p>}
      {!cond ? (
        <p className="t-body-sm">Este cliente aún no tiene condiciones definidas.</p>
      ) : (
        <div className="grid-2">
          <Dato label="Plazo de pago" value={dias(cond.plazo_pago_dias)} />
          <Dato label="Comisión" value={pct(cond.comision_pct)} />
          <Dato label="PAC descuento" value={pct(cond.pac_descuento_pct)} />
          <Dato label="Precio especial" value={formatCOP(cond.precio_especial)} />
        </div>
      )}
      <div>
        <button className="btn btn-outline" onClick={abrir}>
          {cond ? 'Editar condiciones' : 'Definir condiciones'}
        </button>
      </div>
    </div>
  )
}
