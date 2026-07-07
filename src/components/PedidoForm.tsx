import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP } from '../data/constants'
import type { ClienteResumen } from '../data/clientes'
import type { ReferenciaResumen } from '../data/referencias'
import { getCondiciones } from '../data/condiciones'
import type { LineaInput } from '../data/pedidos'
import type { TablesInsert } from '../types/database'

export interface CabeceraState {
  cliente_id: string
  fecha_pedido: string
  fecha_entrega: string
  fecha_factura: string
  canal_origen: string
  estado: string
  notas: string
}

export interface LineaState {
  referencia_id: string
  cantidad: string
  unidad: string
  precio: string
}

export function cabeceraVacia(): CabeceraState {
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    cliente_id: '',
    fecha_pedido: hoy,
    fecha_entrega: '',
    fecha_factura: '',
    canal_origen: 'whatsapp',
    estado: 'recibido',
    notas: '',
  }
}

export const LINEA_VACIA: LineaState = { referencia_id: '', cantidad: '', unidad: 'cajas', precio: '' }

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

interface Props {
  clientes: ClienteResumen[]
  referencias: ReferenciaResumen[]
  initialCab: CabeceraState
  initialLineas: LineaState[]
  submitLabel: string
  onSubmit: (data: { cabecera: TablesInsert<'pedidos'>; lineas: LineaInput[] }) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function PedidoForm({ clientes, referencias, initialCab, initialLineas, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [cab, setCab] = useState<CabeceraState>(initialCab)
  const [lineas, setLineas] = useState<LineaState[]>(initialLineas.length ? initialLineas : [{ ...LINEA_VACIA }])
  const [plazo, setPlazo] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setC = (patch: Partial<CabeceraState>) => setCab((p) => ({ ...p, ...patch }))

  // Plazo de pago del cliente (para la fecha de pago prevista)
  useEffect(() => {
    if (!cab.cliente_id) {
      setPlazo(null)
      return
    }
    getCondiciones(cab.cliente_id).then((c) => setPlazo(c?.plazo_pago_dias ?? null)).catch(() => setPlazo(null))
  }, [cab.cliente_id])

  const total = useMemo(() => lineas.reduce((s, l) => s + num(l.cantidad) * num(l.precio), 0), [lineas])

  const pagoPrevisto = useMemo(() => {
    if (!cab.fecha_factura || plazo == null) return null
    const d = new Date(cab.fecha_factura + 'T00:00:00')
    d.setDate(d.getDate() + plazo)
    return d.toLocaleDateString('es-CO', { dateStyle: 'medium' })
  }, [cab.fecha_factura, plazo])

  const setLinea = (i: number, patch: Partial<LineaState>) =>
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const onRef = (i: number, referencia_id: string) => {
    const ref = referencias.find((r) => r.id === referencia_id)
    setLinea(i, { referencia_id, unidad: ref?.unidad ?? 'cajas' })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cab.cliente_id) {
      setError('Elige un cliente.')
      return
    }
    const validas = lineas.filter((l) => l.referencia_id && num(l.cantidad) > 0)
    if (validas.length === 0) {
      setError('Añade al menos una línea con referencia y cantidad.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        cabecera: {
          cliente_id: cab.cliente_id,
          fecha_pedido: cab.fecha_pedido,
          fecha_entrega: cab.fecha_entrega || null,
          fecha_factura: cab.fecha_factura || null,
          canal_origen: cab.canal_origen,
          estado: cab.estado,
          notas: cab.notas.trim() || null,
        },
        lineas: validas.map((l) => ({
          referencia_id: l.referencia_id,
          cantidad: num(l.cantidad),
          unidad: l.unidad,
          precio_unitario_cop: l.precio === '' ? null : num(l.precio),
        })),
      })
    } catch {
      setError('No se pudo guardar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack stack-4" onSubmit={submit}>
      <div className="form-grid">
        <label className="field field--full">
          <span className="field__label">Cliente</span>
          <select className="input" value={cab.cliente_id} onChange={(e) => setC({ cliente_id: e.target.value })} required>
            <option value="">Elige un cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.codigo_interno} · {c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Canal de origen</span>
          <select className="input" value={cab.canal_origen} onChange={(e) => setC({ canal_origen: e.target.value })}>
            {CANALES_ORIGEN.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="input" value={cab.estado} onChange={(e) => setC({ estado: e.target.value })}>
            {ESTADOS_PEDIDO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Recepción</span>
          <input className="input" type="date" value={cab.fecha_pedido} onChange={(e) => setC({ fecha_pedido: e.target.value })} required />
        </label>
        <label className="field">
          <span className="field__label">Entrega (opcional)</span>
          <input className="input" type="date" value={cab.fecha_entrega} onChange={(e) => setC({ fecha_entrega: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Factura (opcional)</span>
          <input className="input" type="date" value={cab.fecha_factura} onChange={(e) => setC({ fecha_factura: e.target.value })} />
        </label>
        {pagoPrevisto && (
          <div className="field">
            <span className="field__label">Pago previsto</span>
            <span className="t-body">{pagoPrevisto} <span className="t-caption">(factura + {plazo} días)</span></span>
          </div>
        )}
        <label className="field field--full">
          <span className="field__label">Notas</span>
          <textarea className="textarea" value={cab.notas} onChange={(e) => setC({ notas: e.target.value })} />
        </label>
      </div>

      <div className="stack stack-2">
        <span className="t-label">Líneas del pedido</span>
        {lineas.map((l, i) => (
          <div key={i} className="linea-row">
            <select className="input" value={l.referencia_id} onChange={(e) => onRef(i, e.target.value)}>
              <option value="">Referencia…</option>
              {referencias.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre_producto} · {r.formato}</option>
              ))}
            </select>
            <input className="input" type="number" min="0" placeholder="Cant." value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} />
            <input className="input" placeholder="Unidad" value={l.unidad} onChange={(e) => setLinea(i, { unidad: e.target.value })} />
            <input className="input" type="number" min="0" placeholder="Precio ud." value={l.precio} onChange={(e) => setLinea(i, { precio: e.target.value })} />
            <span className="linea-row__sub t-body-sm">{formatCOP(num(l.cantidad) * num(l.precio))}</span>
            <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} title="Quitar línea">✕</button>
          </div>
        ))}
        <div>
          <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => [...ls, { ...LINEA_VACIA }])}>
            + Añadir línea
          </button>
        </div>
        <div className="cluster cluster-2" style={{ justifyContent: 'flex-end' }}>
          <span className="t-label">Total</span>
          <span className="t-heading">{formatCOP(total)}</span>
        </div>
      </div>

      {error && <p className="login-error">{error}</p>}

      <div className="cluster cluster-3" style={{ justifyContent: 'space-between' }}>
        <div className="cluster cluster-3">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</button>
          <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
        {onDelete && (
          <button className="btn btn-outline btn-sm" type="button" disabled={saving}
            onClick={async () => { if (confirm('¿Borrar este pedido?')) await onDelete() }}>
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
