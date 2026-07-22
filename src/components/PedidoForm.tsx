import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP, costeRealNeto, pacPorCanal } from '../data/constants'
import { useAuth } from '../auth/AuthProvider'
import type { ClienteResumen } from '../data/clientes'
import type { ReferenciaResumen } from '../data/referencias'
import { precioBaseCanal } from '../data/referencias'
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
  numero_factura: string
  valor_factura: string
  pagado: string
  fecha_vencimiento: string
  fecha_pago: string
}

export interface LineaState {
  referencia_id: string
  cantidad: string
  unidad: string
  precioBase: string // precio base NETO (sin IVA), tarifa del canal
  descuento: string // % de descuento de la línea
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
    numero_factura: '',
    valor_factura: '',
    pagado: '',
    fecha_vencimiento: '',
    fecha_pago: '',
  }
}

export const LINEA_VACIA: LineaState = { referencia_id: '', cantidad: '', unidad: 'cajas', precioBase: '', descuento: '' }

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// Cálculo de una línea a partir del precio base neto + descuento + IVA de la ref.
// El margen va neto contra neto y contra el coste REAL (landed sin IVA + la
// comisión del 5%). Cada punto de descuento se come margen.
export function calcLinea(l: LineaState, ref: ReferenciaResumen | undefined) {
  const iva = ref?.iva_pct ?? 0
  const cant = num(l.cantidad)
  const netoUd = num(l.precioBase) * (1 - num(l.descuento) / 100) // neto unitario tras descuento
  const conIvaUd = netoUd * (1 + iva / 100) // final unitario con IVA
  const costeNetoUd = costeRealNeto(ref?.coste_almacen_cop ?? null, iva)
  const margenUd = costeNetoUd == null ? null : netoUd - costeNetoUd
  return {
    netoUd,
    conIvaUd,
    netoSub: netoUd * cant,
    ivaSub: netoUd * cant * (iva / 100),
    totalSub: conIvaUd * cant,
    costeNetoUd,
    margenSub: margenUd == null ? null : margenUd * cant,
    margenPct: margenUd == null || netoUd <= 0 ? null : margenUd / netoUd,
  }
}

interface Props {
  clientes: ClienteResumen[]
  referencias: ReferenciaResumen[]
  stock: Record<string, number>
  initialCab: CabeceraState
  initialLineas: LineaState[]
  submitLabel: string
  onSubmit: (data: { cabecera: TablesInsert<'pedidos'>; lineas: LineaInput[] }) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function PedidoForm({ clientes, referencias, stock, initialCab, initialLineas, submitLabel, onSubmit, onCancel, onDelete }: Props) {
  const [cab, setCab] = useState<CabeceraState>(initialCab)
  const [lineas, setLineas] = useState<LineaState[]>(initialLineas.length ? initialLineas : [{ ...LINEA_VACIA }])
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin' // el margen solo lo ve el admin
  const [plazo, setPlazo] = useState<number | null>(null)
  const [descuentoCliente, setDescuentoCliente] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El valor de la factura se calcula solo (total con IVA) mientras no se edite a mano.
  const [valorFacturaTocado, setValorFacturaTocado] = useState(initialCab.valor_factura !== '')

  const setC = (patch: Partial<CabeceraState>) => setCab((p) => ({ ...p, ...patch }))

  // Cliente elegido: su canal fija la tarifa base y su dirección de entrega.
  const clienteSel = clientes.find((c) => c.id === cab.cliente_id)
  const refById = (id: string) => referencias.find((r) => r.id === id)

  // Condiciones del cliente: plazo de pago y % descuento por defecto.
  useEffect(() => {
    if (!cab.cliente_id) {
      setPlazo(null)
      setDescuentoCliente(null)
      return
    }
    // PAC por defecto: el pactado en condiciones si existe; si no, el del canal
    // del cliente (retail 10%, resto 0%).
    const canal = clientes.find((c) => c.id === cab.cliente_id)?.canal ?? null
    getCondiciones(cab.cliente_id)
      .then((c) => {
        setPlazo(c?.plazo_pago_dias ?? null)
        setDescuentoCliente(c?.pac_descuento_pct ?? pacPorCanal(canal))
      })
      .catch(() => {
        setPlazo(null)
        setDescuentoCliente(pacPorCanal(canal))
      })
  }, [cab.cliente_id, clientes])

  // Cálculo por línea (neto → con IVA) y totales del pedido.
  const lineTotals = useMemo(
    () => lineas.map((l) => calcLinea(l, refById(l.referencia_id))),
    [lineas, referencias],
  )
  const total = useMemo(() => lineTotals.reduce((s, t) => s + t.totalSub, 0), [lineTotals])

  // Autocompleta el valor de la factura con el total del pedido (CON IVA) mientras
  // no se haya editado a mano; así se factura por el total calculado sin teclearlo.
  useEffect(() => {
    if (valorFacturaTocado) return
    setCab((p) => ({ ...p, valor_factura: total > 0 ? String(Math.round(total)) : '' }))
  }, [total, valorFacturaTocado])
  const desglose = useMemo(() => {
    let iva = 0
    let base = 0
    for (const t of lineTotals) {
      iva += t.ivaSub
      base += t.netoSub
    }
    return { iva, base }
  }, [lineTotals])

  // Margen del pedido (solo admin): neto vendido − coste neto.
  const margen = useMemo(() => {
    let valor = 0
    let base = 0
    let hay = false
    for (const t of lineTotals) {
      if (t.margenSub != null) {
        valor += t.margenSub
        hay = true
      }
      base += t.netoSub
    }
    return hay ? { valor, pct: base > 0 ? valor / base : null } : null
  }, [lineTotals])

  // La factura debería cuadrar con el total del pedido (ambos con IVA).
  const facturaCuadra = useMemo(() => {
    if (cab.valor_factura === '') return true
    return Math.abs(num(cab.valor_factura) - total) < 1
  }, [cab.valor_factura, total])

  const vencSugerido = useMemo(() => {
    if (!cab.fecha_factura || plazo == null) return null
    const d = new Date(cab.fecha_factura + 'T00:00:00')
    d.setDate(d.getDate() + plazo)
    return d.toISOString().slice(0, 10)
  }, [cab.fecha_factura, plazo])

  const saldo = useMemo(() => {
    if (cab.valor_factura === '') return null
    return num(cab.valor_factura) - num(cab.pagado)
  }, [cab.valor_factura, cab.pagado])

  const setLinea = (i: number, patch: Partial<LineaState>) =>
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  // Al elegir referencia: trae la tarifa base del canal del cliente y, si la
  // línea aún no tiene descuento, aplica el del cliente por defecto.
  const onRef = (i: number, referencia_id: string) => {
    const ref = referencias.find((r) => r.id === referencia_id)
    const base = ref ? precioBaseCanal(ref, clienteSel?.canal ?? null) : null
    setLineas((ls) =>
      ls.map((l, idx) =>
        idx === i
          ? {
              ...l,
              referencia_id,
              unidad: ref?.unidad ?? l.unidad,
              precioBase: base != null ? String(base) : l.precioBase,
              descuento: l.descuento || (descuentoCliente != null ? String(descuentoCliente) : ''),
            }
          : l,
      ),
    )
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
          numero_factura: cab.numero_factura.trim() || null,
          valor_factura: cab.valor_factura === '' ? null : num(cab.valor_factura),
          pagado: cab.pagado === '' ? null : num(cab.pagado),
          fecha_vencimiento: cab.fecha_vencimiento || null,
          fecha_pago: cab.fecha_pago || null,
        },
        lineas: validas.map((l) => {
          const c = calcLinea(l, refById(l.referencia_id))
          return {
            referencia_id: l.referencia_id,
            cantidad: num(l.cantidad),
            unidad: l.unidad,
            precio_unitario_cop: Math.round(c.conIvaUd), // final unitario con IVA
            precio_base_cop: l.precioBase === '' ? null : num(l.precioBase),
            descuento_pct: l.descuento === '' ? null : num(l.descuento),
          }
        }),
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
        {clienteSel && (
          <div className="field field--full">
            <span className="field__label">Dirección de entrega</span>
            <span className="t-body">
              {clienteSel.direccion_entrega
                ? clienteSel.direccion_entrega + (clienteSel.ciudad ? ` · ${clienteSel.ciudad}` : '')
                : '— sin dirección en la ficha del cliente'}
            </span>
          </div>
        )}
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
        <label className="field field--full">
          <span className="field__label">Notas</span>
          <textarea className="textarea" value={cab.notas} onChange={(e) => setC({ notas: e.target.value })} />
        </label>
      </div>

      <div className="stack stack-2">
        <span className="t-label">Líneas del pedido</span>
        <div className="linea-row t-caption" style={{ color: 'var(--text-4)' }}>
          <span>Referencia</span><span>Cant.</span><span>Precio base (neto)</span><span>Desc. %</span>
          <span style={{ textAlign: 'right' }}>Subtotal c/IVA</span><span />
        </div>
        {lineas.map((l, i) => {
          const disp = l.referencia_id ? stock[l.referencia_id] : undefined
          const pide = num(l.cantidad)
          const c = calcLinea(l, refById(l.referencia_id))
          const sinTarifa = !!l.referencia_id && l.precioBase === ''
          return (
            <div key={i} className="linea-wrap">
              <div className="linea-row">
                <select className="input" value={l.referencia_id} onChange={(e) => onRef(i, e.target.value)}>
                  <option value="">Referencia…</option>
                  {referencias.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre_producto} · {r.formato}</option>
                  ))}
                </select>
                <input className="input" type="number" min="0" placeholder="Cant." value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} />
                <input className="input" type="number" min="0" placeholder="Neto" value={l.precioBase} onChange={(e) => setLinea(i, { precioBase: e.target.value })} />
                <input className="input" type="number" min="0" max="100" step="0.01" placeholder="0" value={l.descuento} onChange={(e) => setLinea(i, { descuento: e.target.value })} />
                <span className="linea-row__sub t-body-sm">{formatCOP(c.totalSub)}</span>
                <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} title="Quitar línea">✕</button>
              </div>
              <span className="t-caption linea-stock">
                {l.precioBase !== '' && <>Neto ud: {formatCOP(c.netoUd)} · con IVA: {formatCOP(c.conIvaUd)} · </>}
                {isAdmin && c.margenPct != null && (
                  <span className={c.margenPct < 0 ? 'stock-bajo' : 'margen-ok'}>Margen: {Math.round(c.margenPct * 100)}% · </span>
                )}
                {sinTarifa && <span className="stock-bajo">Sin tarifa para este canal — pon el precio a mano · </span>}
                {disp !== undefined && (
                  <span className={pide > disp ? 'stock-bajo' : undefined}>Disponible: {disp}{pide > disp ? ` (pides ${pide})` : ''}</span>
                )}
              </span>
            </div>
          )
        })}
        <div>
          <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => [...ls, { ...LINEA_VACIA }])}>
            + Añadir línea
          </button>
        </div>
        <div className="stack stack-1" style={{ alignItems: 'flex-end' }}>
          <span className="t-caption">Base imponible (est.): {formatCOP(desglose.base)}</span>
          <span className="t-caption">IVA (est.): {formatCOP(desglose.iva)}</span>
          {isAdmin && margen && (
            <span className={'t-caption margen-linea' + (margen.valor < 0 ? ' stock-bajo' : '')}>
              🔒 Margen del pedido: {margen.pct == null ? '—' : `${Math.round(margen.pct * 100)}%`} ({formatCOP(margen.valor)}) · solo admin
            </span>
          )}
          <div className="cluster cluster-2">
            <span className="t-label">Total con IVA</span>
            <span className="t-heading">{formatCOP(total)}</span>
          </div>
        </div>
      </div>

      <div className="stack stack-2">
        <span className="t-label">Cobro</span>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Nº de factura</span>
            <input className="input" value={cab.numero_factura} onChange={(e) => setC({ numero_factura: e.target.value })} />
          </label>
          <div className="field">
            <span className="field__label">Saldo</span>
            <span className="t-body">{saldo == null ? '—' : formatCOP(saldo)}</span>
          </div>
          <label className="field">
            <span className="field__label">Valor factura (con IVA)</span>
            <input className="input" type="number" min="0" value={cab.valor_factura}
              onChange={(e) => { setValorFacturaTocado(true); setC({ valor_factura: e.target.value }) }} />
            {!valorFacturaTocado
              ? total > 0 && (
                  <span className="t-caption" style={{ color: 'var(--text-4)', marginTop: 'var(--sp-1)' }}>
                    Calculado del total del pedido · editable
                  </span>
                )
              : !facturaCuadra && (
                  <div style={{ marginTop: 'var(--sp-1)' }}>
                    <span className="login-error" style={{ fontSize: 'var(--text-sm)' }}>
                      ⚠ No coincide con el total ({formatCOP(total)})
                    </span>
                    <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 'var(--sp-1)', display: 'block' }} onClick={() => setValorFacturaTocado(false)}>
                      Igualar al total
                    </button>
                  </div>
                )}
          </label>
          <label className="field">
            <span className="field__label">Pagado (COP)</span>
            <input className="input" type="number" min="0" value={cab.pagado} onChange={(e) => setC({ pagado: e.target.value })} />
          </label>
          <label className="field">
            <span className="field__label">Vencimiento</span>
            <input className="input" type="date" value={cab.fecha_vencimiento} onChange={(e) => setC({ fecha_vencimiento: e.target.value })} />
            {vencSugerido && cab.fecha_vencimiento !== vencSugerido && (
              <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 'var(--sp-1)' }} onClick={() => setC({ fecha_vencimiento: vencSugerido })}>
                Sugerir: factura + {plazo} días
              </button>
            )}
          </label>
          <label className="field">
            <span className="field__label">Fecha de pago</span>
            <input className="input" type="date" value={cab.fecha_pago} onChange={(e) => setC({ fecha_pago: e.target.value })} />
          </label>
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
