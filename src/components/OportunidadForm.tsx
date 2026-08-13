import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ETAPAS, pacPorCanal, formatCOP } from '../data/constants'
import type { ClienteResumen } from '../data/clientes'
import type { ReferenciaResumen } from '../data/referencias'
import { precioBaseCanal } from '../data/referencias'
import { getCondiciones } from '../data/condiciones'
import type { OportunidadConLineas, LineaOportunidadInput } from '../data/oportunidades'
import type { TablesInsert } from '../types/database'

// Cabecera de la oportunidad (todo lo que no son líneas). El "valor estimado"
// ya no se teclea: se calcula como Σ de las líneas (NETO, sin IVA).
export interface CabeceraOportunidadState {
  cliente_id: string
  etapa: string
  probabilidad_cierre: string
  fecha_cierre: string
  fecha_inicio_suministro: string
  comision_pct: string
  pac_descuento_pct: string
  plazo_pago_dias: string
}

// Línea = consumo mensual estimado de una referencia. Precio y descuento NETOS.
export interface LineaOportunidadState {
  referencia_id: string
  cantidad: string // cantidad mensual estimada (unidades)
  precio: string // precio unitario base neto (antes de descuento)
  descuento: string // % de descuento de la línea
}

export const CAB_OPORTUNIDAD_VACIA: CabeceraOportunidadState = {
  cliente_id: '',
  etapa: 'prospeccion',
  probabilidad_cierre: '',
  fecha_cierre: '',
  fecha_inicio_suministro: '',
  comision_pct: '',
  pac_descuento_pct: '',
  plazo_pago_dias: '',
}

export const LINEA_OPORTUNIDAD_VACIA: LineaOportunidadState = {
  referencia_id: '',
  cantidad: '',
  precio: '',
  descuento: '',
}

const s = (n: number | null) => (n == null ? '' : String(n))

export function oportunidadToCab(o: OportunidadConLineas): CabeceraOportunidadState {
  return {
    cliente_id: o.cliente_id,
    etapa: o.etapa,
    probabilidad_cierre: s(o.probabilidad_cierre),
    fecha_cierre: o.fecha_cierre ?? '',
    fecha_inicio_suministro: o.fecha_inicio_suministro ?? '',
    comision_pct: s(o.comision_pct),
    pac_descuento_pct: s(o.pac_descuento_pct),
    plazo_pago_dias: s(o.plazo_pago_dias),
  }
}

export function oportunidadToLineas(o: OportunidadConLineas): LineaOportunidadState[] {
  return o.oportunidad_lineas.map((l) => ({
    referencia_id: l.referencia_id,
    cantidad: String(l.cantidad),
    precio: l.precio_estimado_cop == null ? '' : String(l.precio_estimado_cop),
    descuento: l.descuento_pct == null ? '0' : String(l.descuento_pct),
  }))
}

const num = (str: string) => {
  const n = Number(str)
  return Number.isFinite(n) ? n : 0
}

// Cálculo de una línea, siempre NETO (sin IVA): el IVA no entra en el potencial
// comercial. neto ud = precio × (1 − dto). valor mensual = neto ud × cantidad.
function calcLineaOp(l: LineaOportunidadState) {
  const cant = num(l.cantidad)
  const netoUd = num(l.precio) * (1 - num(l.descuento) / 100)
  return { netoUd, valorLinea: netoUd * cant }
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

interface Props {
  clientes: ClienteResumen[]
  referencias: ReferenciaResumen[]
  initialCab: CabeceraOportunidadState
  initialLineas: LineaOportunidadState[]
  valorHeredado: number | null // valor_estimado previo (se conserva si aún no hay líneas)
  submitLabel: string
  onSubmit: (data: { cabecera: TablesInsert<'oportunidades'>; lineas: LineaOportunidadInput[] }) => Promise<void>
  onCancel: () => void
  onArchive?: () => Promise<void>
}

export function OportunidadForm({
  clientes,
  referencias,
  initialCab,
  initialLineas,
  valorHeredado,
  submitLabel,
  onSubmit,
  onCancel,
  onArchive,
}: Props) {
  const [cab, setCab] = useState<CabeceraOportunidadState>(initialCab)
  const [lineas, setLineas] = useState<LineaOportunidadState[]>(
    initialLineas.length ? initialLineas : [{ ...LINEA_OPORTUNIDAD_VACIA }],
  )
  const [descuentoCliente, setDescuentoCliente] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setC = (patch: Partial<CabeceraOportunidadState>) => setCab((p) => ({ ...p, ...patch }))
  const setLinea = (i: number, patch: Partial<LineaOportunidadState>) =>
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const clienteSel = clientes.find((c) => c.id === cab.cliente_id) ?? null
  const refById = (id: string) => referencias.find((r) => r.id === id)

  // Descuento por defecto del cliente: el pactado en condiciones, o el del canal
  // (pacPorCanal). Mismo criterio que el pedido. Solo prefija líneas nuevas.
  useEffect(() => {
    if (!cab.cliente_id) {
      setDescuentoCliente(null)
      return
    }
    const canal = clientes.find((c) => c.id === cab.cliente_id)?.canal ?? null
    let vivo = true
    getCondiciones(cab.cliente_id)
      .then((c) => { if (vivo) setDescuentoCliente(c?.pac_descuento_pct ?? pacPorCanal(canal)) })
      .catch(() => { if (vivo) setDescuentoCliente(pacPorCanal(canal)) })
    return () => { vivo = false }
  }, [cab.cliente_id, clientes])

  // Al elegir referencia: trae la tarifa base del canal del cliente y, si la
  // línea aún no tiene descuento, aplica el del cliente por defecto.
  const onRef = (i: number, referencia_id: string) => {
    const ref = refById(referencia_id)
    const base = ref ? precioBaseCanal(ref, clienteSel?.canal ?? null) : null
    setLineas((ls) =>
      ls.map((l, idx) =>
        idx === i
          ? {
              ...l,
              referencia_id,
              precio: l.precio || (base != null ? String(base) : ''),
              descuento: l.descuento || (descuentoCliente != null ? String(descuentoCliente) : ''),
            }
          : l,
      ),
    )
  }

  const totalMensual = useMemo(
    () => lineas.reduce((sm, l) => sm + calcLineaOp(l).valorLinea, 0),
    [lineas],
  )
  const hayLineas = lineas.some((l) => l.referencia_id && num(l.cantidad) > 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cab.cliente_id) {
      setError('Elige un cliente.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const lineasInput: LineaOportunidadInput[] = lineas
        .filter((l) => l.referencia_id && num(l.cantidad) > 0)
        .map((l) => {
          const c = calcLineaOp(l)
          return {
            referencia_id: l.referencia_id,
            cantidad: num(l.cantidad),
            precio_estimado_cop: l.precio === '' ? null : num(l.precio),
            descuento_pct: l.descuento === '' ? null : num(l.descuento),
            subtotal_cop: Math.round(c.valorLinea * 100) / 100,
          }
        })
      const total = lineasInput.reduce((sm, l) => sm + (l.subtotal_cop ?? 0), 0)
      // Con líneas → valor mensual = Σ subtotales. Sin líneas → conserva el heredado.
      const valor_estimado = lineasInput.length ? Math.round(total) : valorHeredado
      const cabecera: TablesInsert<'oportunidades'> = {
        cliente_id: cab.cliente_id,
        etapa: cab.etapa,
        probabilidad_cierre: numOrNull(cab.probabilidad_cierre),
        fecha_cierre: cab.fecha_cierre || null,
        fecha_inicio_suministro: cab.fecha_inicio_suministro || null,
        comision_pct: numOrNull(cab.comision_pct),
        pac_descuento_pct: numOrNull(cab.pac_descuento_pct),
        plazo_pago_dias: numOrNull(cab.plazo_pago_dias),
        valor_estimado,
      }
      await onSubmit({ cabecera, lineas: lineasInput })
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
        <select className="input" value={cab.cliente_id} onChange={(e) => setC({ cliente_id: e.target.value })} required>
          <option value="">Elige un cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.codigo_interno} · {c.nombre}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Etapa</span>
        <select className="input" value={cab.etapa} onChange={(e) => setC({ etapa: e.target.value })}>
          {ETAPAS.map((et) => (
            <option key={et.value} value={et.value}>{et.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Probabilidad de cierre (%)</span>
        <input className="input" type="number" min="0" max="100" value={cab.probabilidad_cierre}
          onChange={(e) => setC({ probabilidad_cierre: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Fecha de cierre</span>
        <input className="input" type="date" value={cab.fecha_cierre}
          onChange={(e) => setC({ fecha_cierre: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Inicio previsto de suministro</span>
        <input className="input" type="date" value={cab.fecha_inicio_suministro}
          onChange={(e) => setC({ fecha_inicio_suministro: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Comisión (%)</span>
        <input className="input" type="number" step="0.01" value={cab.comision_pct}
          onChange={(e) => setC({ comision_pct: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">PAC descuento (%)</span>
        <input className="input" type="number" step="0.01" value={cab.pac_descuento_pct}
          onChange={(e) => setC({ pac_descuento_pct: e.target.value })} />
      </label>

      <label className="field">
        <span className="field__label">Plazo de pago (días)</span>
        <input className="input" type="number" min="0" value={cab.plazo_pago_dias}
          onChange={(e) => setC({ plazo_pago_dias: e.target.value })} />
      </label>

      <div className="stack stack-2 field--full">
        <span className="t-label">Consumo mensual estimado (líneas)</span>
        <div className="linea-row t-caption" style={{ color: 'var(--text-4)' }}>
          <span>Referencia</span><span>Uds./mes</span><span>Precio unitario (neto)</span><span>Desc. %</span>
          <span style={{ textAlign: 'right' }}>Valor mensual (neto)</span><span />
        </div>
        {lineas.map((l, i) => {
          const c = calcLineaOp(l)
          const sinTarifa = !!l.referencia_id && l.precio === ''
          return (
            <div key={i} className="linea-wrap">
              <div className="linea-row">
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Referencia</span>
                  <select className="input" value={l.referencia_id} onChange={(e) => onRef(i, e.target.value)}>
                    <option value="">Referencia…</option>
                    {referencias.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre_producto} · {r.formato}</option>
                    ))}
                  </select>
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Uds./mes</span>
                  <input className="input" type="number" min="0" step="any" placeholder="Uds./mes" value={l.cantidad}
                    onChange={(e) => setLinea(i, { cantidad: e.target.value })} />
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Precio unitario (neto)</span>
                  <input className="input" type="number" min="0" step="any" placeholder="Neto" value={l.precio}
                    onChange={(e) => setLinea(i, { precio: e.target.value })} />
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">% de descuento</span>
                  <input className="input" type="number" min="0" max="100" step="0.01" placeholder="% dto" value={l.descuento}
                    onChange={(e) => setLinea(i, { descuento: e.target.value })} />
                </label>
                <span className="linea-row__sub t-body-sm">{formatCOP(c.valorLinea)}</span>
                <button className="btn btn-sm btn-outline" type="button"
                  onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} title="Quitar línea">✕</button>
              </div>
              <span className="t-caption linea-stock">
                {l.precio !== '' && <>Precio neto ud: {formatCOP(c.netoUd)} · </>}
                {sinTarifa && <span className="stock-bajo">Sin tarifa para este canal — pon el precio a mano</span>}
              </span>
            </div>
          )
        })}
        <div>
          <button className="btn btn-sm btn-outline" type="button"
            onClick={() => setLineas((ls) => [...ls, { ...LINEA_OPORTUNIDAD_VACIA }])}>
            + Añadir línea
          </button>
        </div>
        <div className="stack stack-1" style={{ alignItems: 'flex-end' }}>
          {!hayLineas && valorHeredado != null && (
            <span className="t-caption stock-bajo">
              Sin líneas — valor heredado: {formatCOP(valorHeredado)}. Añade productos para recalcular.
            </span>
          )}
          <div className="cluster cluster-2">
            <span className="t-label">Valor estimado mensual (neto)</span>
            <span className="t-heading">{formatCOP(hayLineas ? totalMensual : valorHeredado)}</span>
          </div>
          <span className="t-caption">Proyección: valor mensual × probabilidad de cierre</span>
        </div>
      </div>

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
        {onArchive && (
          <button
            className="btn btn-outline btn-sm"
            type="button"
            disabled={saving}
            onClick={async () => {
              if (confirm('¿Archivar esta oportunidad? Se retira de la operativa; podrás restaurarla después.')) await onArchive()
            }}
          >
            Archivar
          </button>
        )}
      </div>
    </form>
  )
}
