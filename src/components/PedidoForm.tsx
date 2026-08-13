import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP, costeRealNeto, pacPorCanal, labelDe } from '../data/constants'
import { useAuth } from '../auth/AuthProvider'
import { permisos } from '../auth/permisos'
import type { ClienteResumen } from '../data/clientes'
import type { ReferenciaResumen } from '../data/referencias'
import { precioBaseCanal } from '../data/referencias'
import { ClienteCombo } from './ClienteCombo'
import type { Almacen } from '../data/almacenes'
import type { StockMap } from '../data/inventario'
import { getCondiciones } from '../data/condiciones'
import { mensajeErrorPedido } from '../data/pedidos'
import type { LineaInput } from '../data/pedidos'
import type { TablesInsert } from '../types/database'

export interface CabeceraState {
  cliente_id: string
  almacen_id: string
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
  nota_credito_numero: string
  nota_credito_fecha: string
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
    almacen_id: '',
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
    nota_credito_numero: '',
    nota_credito_fecha: '',
  }
}

export const LINEA_VACIA: LineaState = { referencia_id: '', cantidad: '', unidad: 'unidades', precioBase: '', descuento: '' }

// Estados que un comercial puede fijar. Facturado/Cobrado/Cancelado son solo
// del admin (marcar la facturación es un acto de facturación). El backend lo
// refuerza con el trigger pedidos_proteger_facturacion.
const ESTADOS_COMERCIAL = ['recibido', 'entregado']

// Estados que se pueden elegir en el desplegable de estado. Anulado/Cancelado
// NO están aquí a propósito: esas transiciones van por las acciones dedicadas
// (Cancelar / Anular con NC / Reactivar), nunca por el Guardar normal — que
// reescribe líneas y la BD bloquearía en un pedido no consumidor.
const ESTADOS_SELECCIONABLES = ESTADOS_PEDIDO.filter(
  (s) => s.value !== 'anulado' && s.value !== 'cancelado',
)

// ¿El estado consume stock? (espejo de pedido_consume_stock en la BD)
const consumeStock = (estado: string) => estado !== 'anulado' && estado !== 'cancelado'

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
  almacenes: Almacen[]
  stock: StockMap // { referencia_id: { almacen_id: unidades } }
  esNuevo: boolean // solo los pedidos nuevos auto-asignan almacén por defecto
  initialCab: CabeceraState
  initialLineas: LineaState[]
  submitLabel: string
  onSubmit: (data: { cabecera: TablesInsert<'pedidos'>; lineas: LineaInput[] }) => Promise<void>
  onCancel: () => void
  // Acciones de ciclo de vida (solo en modo edición). Cada una hace únicamente
  // el UPDATE de cabecera necesario; la BD repone/descuenta stock y valida.
  onCancelar?: () => Promise<void>
  onAnular?: (nc: { numero: string; fecha: string | null }) => Promise<void>
  onReactivar?: () => Promise<void>
  // Guardado limitado (notas/documentación/NC) para pedidos anulados/cancelados.
  onGuardarNotas?: (patch: {
    notas: string | null
    nota_credito_numero: string | null
    nota_credito_fecha: string | null
  }) => Promise<void>
}

export function PedidoForm({ clientes, referencias, almacenes, stock, esNuevo, initialCab, initialLineas, submitLabel, onSubmit, onCancel, onCancelar, onAnular, onReactivar, onGuardarNotas }: Props) {
  const [cab, setCab] = useState<CabeceraState>(initialCab)
  const [lineas, setLineas] = useState<LineaState[]>(initialLineas.length ? initialLineas : [{ ...LINEA_VACIA }])
  const { profile } = useAuth()
  // El isAdmin único se divide en dos capacidades distintas:
  //  - ver costes/margen  -> seeCosts (dirección SÍ, comercial NO)
  //  - operar facturación/cobros y estados de factura -> manageFacturacion
  //    (dirección NO, backoffice/superadmin SÍ, comercial NO)
  const puedeVerCostes = permisos.seeCosts(profile)
  const puedeFacturar = permisos.manageFacturacion(profile)
  // Comercial: puede editar recibido/entregado de SUS pedidos (RLS lo acota).
  // Dirección no es comercial -> verá el estado en solo lectura.
  const esComercial = permisos.isComercial(profile)
  // Operar el ciclo de vida (cancelar/anular/reactivar) se reserva a
  // Backoffice/Superadmin. Comercial y Dirección no lo ven.
  const puedeCiclo = permisos.managePedidos(profile)
  // ¿Puede editar algo? Dirección solo consulta (todo en solo lectura).
  const puedeEditar = puedeCiclo || esComercial
  // Estado REAL guardado del pedido (no el del desplegable sin guardar): decide
  // el "congelado" y qué acción de ciclo corresponde.
  const estadoReal = initialCab.estado
  const congelado = !esNuevo && !consumeStock(estadoReal)
  const esAnulado = estadoReal === 'anulado'
  // "Facturado" a efectos de ciclo: hay factura emitida (por estado o por número).
  const tieneFactura =
    estadoReal === 'facturado' || estadoReal === 'cobrado' || !!initialCab.numero_factura
  // Campos del cuerpo editables: solo en pedido consumidor y con permiso.
  const editable = puedeEditar && !congelado
  const [plazo, setPlazo] = useState<number | null>(null)
  const [descuentoCliente, setDescuentoCliente] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Panel de anulación (pide Nº y fecha de nota de crédito).
  const [anulando, setAnulando] = useState(false)
  // El valor de la factura se calcula solo (total con IVA) mientras no se edite a mano.
  const [valorFacturaTocado, setValorFacturaTocado] = useState(initialCab.valor_factura !== '')
  // Si el usuario elige almacén a mano, dejamos de auto-asignarlo por la ciudad del cliente.
  const [almacenTocado, setAlmacenTocado] = useState(initialCab.almacen_id !== '')

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

  // Almacén por defecto: el de la ciudad del cliente si coincide; si no, el primero.
  // No se pisa si el usuario ya lo eligió a mano (o si el pedido ya lo traía).
  useEffect(() => {
    if (!esNuevo || almacenTocado || almacenes.length === 0) return
    // Normaliza (minúsculas y sin tildes) para que "Medellin" case con "Medellín".
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
    const ciudad = clientes.find((c) => c.id === cab.cliente_id)?.ciudad ?? null
    const match = ciudad ? almacenes.find((a) => norm(a.ciudad) === norm(ciudad)) : undefined
    setCab((p) => ({ ...p, almacen_id: (match ?? almacenes[0]).id }))
  }, [cab.cliente_id, almacenes, clientes, almacenTocado, esNuevo])

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
              unidad: 'unidades', // el pedido va siempre en unidades
              precioBase: base != null ? String(base) : l.precioBase,
              descuento: l.descuento || (descuentoCliente != null ? String(descuentoCliente) : ''),
            }
          : l,
      ),
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    // Guarda de seguridad: en un pedido congelado o en solo lectura el Guardar
    // normal (que reescribe líneas) no debe ejecutarse ni por Enter.
    if (congelado || !puedeEditar) return
    if (!cab.cliente_id) {
      setError('Elige un cliente.')
      return
    }
    // En un pedido nuevo es obligatorio indicar de qué almacén sale la mercancía
    // (es de donde se descuenta el stock).
    if (esNuevo && !cab.almacen_id) {
      setError('Elige el almacén del que sale la mercancía.')
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
          almacen_id: cab.almacen_id || null,
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
          nota_credito_numero: cab.nota_credito_numero.trim() || null,
          nota_credito_fecha: cab.nota_credito_fecha || null,
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
    } catch (e) {
      setError(mensajeErrorPedido(e, referencias, almacenes))
    } finally {
      setSaving(false)
    }
  }

  // Envuelve una acción de ciclo de vida: gestiona `saving`, limpia el error y
  // traduce el mensaje de la BD si algo falla (p. ej. stock al reactivar).
  const ejecutar = async (fn: () => Promise<void>) => {
    setError(null)
    setSaving(true)
    try {
      await fn()
    } catch (e) {
      setError(mensajeErrorPedido(e, referencias, almacenes))
    } finally {
      setSaving(false)
    }
  }

  // Guarda solo notas/documentación/NC (pedido congelado): no reescribe líneas.
  const guardarNotas = () =>
    ejecutar(async () => {
      if (!onGuardarNotas) return
      await onGuardarNotas({
        notas: cab.notas.trim() || null,
        nota_credito_numero: cab.nota_credito_numero.trim() || null,
        nota_credito_fecha: cab.nota_credito_fecha || null,
      })
    })

  // Confirma la anulación con NC. El número de NC es obligatorio.
  const confirmarAnulacion = () =>
    ejecutar(async () => {
      if (!onAnular) return
      if (!cab.nota_credito_numero.trim()) {
        setError('Indica el número de la nota de crédito para anular.')
        return
      }
      await onAnular({
        numero: cab.nota_credito_numero.trim(),
        fecha: cab.nota_credito_fecha || null,
      })
    })

  return (
    <form className="stack stack-4" onSubmit={submit}>
      <div className="form-grid">
        <div className="field field--full">
          <span className="field__label">Cliente</span>
          <ClienteCombo clientes={clientes} value={cab.cliente_id} onChange={(id) => setC({ cliente_id: id })} disabled={!editable} />
        </div>
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
          {editable ? (
            <select className="input" value={cab.canal_origen} onChange={(e) => setC({ canal_origen: e.target.value })}>
              {CANALES_ORIGEN.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <span className="t-body">{labelDe(CANALES_ORIGEN, cab.canal_origen)}</span>
          )}
        </label>
        <label className="field">
          <span className="field__label">Estado</span>
          {editable && puedeFacturar ? (
            <select className="input" value={cab.estado} onChange={(e) => setC({ estado: e.target.value })}>
              {ESTADOS_SELECCIONABLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          ) : editable && esComercial && ESTADOS_COMERCIAL.includes(cab.estado) ? (
            // El comercial mueve SUS pedidos entre Recibido y Entregado (la
            // propiedad la protege RLS). Dirección NO: cae a solo lectura.
            <select className="input" value={cab.estado} onChange={(e) => setC({ estado: e.target.value })}>
              {ESTADOS_SELECCIONABLES.filter((s) => ESTADOS_COMERCIAL.includes(s.value)).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          ) : (
            // Dirección, pedido congelado (anulado/cancelado) o ya facturado/cobrado.
            <span className="t-body">{labelDe(ESTADOS_PEDIDO, cab.estado)}</span>
          )}
        </label>
        <label className="field">
          <span className="field__label">Almacén (de dónde sale)</span>
          {editable ? (
            <select className="input" value={cab.almacen_id} onChange={(e) => { setAlmacenTocado(true); setC({ almacen_id: e.target.value }) }}>
              <option value="">— elige almacén</option>
              {almacenes.map((a) => <option key={a.id} value={a.id}>{a.ciudad}</option>)}
            </select>
          ) : (
            <span className="t-body">{almacenes.find((a) => a.id === cab.almacen_id)?.ciudad ?? '—'}</span>
          )}
        </label>
        <label className="field">
          <span className="field__label">Recepción</span>
          <input className="input" type="date" value={cab.fecha_pedido} onChange={(e) => setC({ fecha_pedido: e.target.value })} required disabled={!editable} />
        </label>
        <label className="field">
          <span className="field__label">Entrega (opcional)</span>
          <input className="input" type="date" value={cab.fecha_entrega} onChange={(e) => setC({ fecha_entrega: e.target.value })} disabled={!editable} />
        </label>
        <label className="field">
          <span className="field__label">Factura (opcional)</span>
          <input className="input" type="date" value={cab.fecha_factura} onChange={(e) => setC({ fecha_factura: e.target.value })} disabled={!editable} />
        </label>
        <label className="field field--full">
          <span className="field__label">Notas</span>
          <textarea className="textarea" value={cab.notas} onChange={(e) => setC({ notas: e.target.value })} disabled={!puedeEditar} />
        </label>
      </div>

      <div className="stack stack-2">
        <span className="t-label">Líneas del pedido</span>
        <div className="linea-row t-caption" style={{ color: 'var(--text-4)' }}>
          <span>Referencia</span><span>Uds.</span><span>Precio unitario (neto)</span><span>Desc. %</span>
          <span style={{ textAlign: 'right' }}>Subtotal c/IVA</span><span />
        </div>
        {lineas.map((l, i) => {
          const ref = refById(l.referencia_id)
          const esServicio = !!ref?.es_servicio
          // Stock en unidades del almacén elegido (los servicios no tienen stock).
          const disp = l.referencia_id && cab.almacen_id && !esServicio ? (stock[l.referencia_id]?.[cab.almacen_id] ?? 0) : undefined
          const pideUds = num(l.cantidad) // el pedido va en unidades
          const c = calcLinea(l, ref)
          const sinTarifa = !!l.referencia_id && !esServicio && l.precioBase === ''
          return (
            <div key={i} className="linea-wrap">
              <div className="linea-row">
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Referencia</span>
                  <select className="input" value={l.referencia_id} onChange={(e) => onRef(i, e.target.value)} disabled={!editable}>
                    <option value="">Referencia…</option>
                    {referencias.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre_producto} · {r.formato}</option>
                    ))}
                  </select>
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Unidades</span>
                  <input className="input" type="number" min="0" step="any" placeholder="Uds." value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} disabled={!editable} />
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">Precio unitario (neto)</span>
                  <input className="input" type="number" min="0" step="any" placeholder="Neto" value={l.precioBase} onChange={(e) => setLinea(i, { precioBase: e.target.value })} disabled={!editable} />
                </label>
                <label className="linea-cell">
                  <span className="linea-cell__lbl">% de descuento</span>
                  <input className="input" type="number" min="0" max="100" step="0.01" placeholder="% dto" value={l.descuento} onChange={(e) => setLinea(i, { descuento: e.target.value })} disabled={!editable} />
                </label>
                <span className="linea-row__sub t-body-sm">{formatCOP(c.totalSub)}</span>
                {editable
                  ? <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))} title="Quitar línea">✕</button>
                  : <span />}
              </div>
              <span className="t-caption linea-stock">
                {l.precioBase !== '' && <>Neto ud: {formatCOP(c.netoUd)} · con IVA: {formatCOP(c.conIvaUd)} · </>}
                {puedeVerCostes && c.margenPct != null && (
                  <span className={c.margenPct < 0 ? 'stock-bajo' : 'margen-ok'}>Margen: {Math.round(c.margenPct * 100)}% · </span>
                )}
                {sinTarifa && <span className="stock-bajo">Sin tarifa para este canal — pon el precio a mano · </span>}
                {disp !== undefined && (
                  <span className={pideUds > disp ? 'stock-bajo' : undefined}>Disponible: {disp} uds{pideUds > disp ? ` (pides ${pideUds})` : ''}</span>
                )}
              </span>
            </div>
          )
        })}
        {editable && (
          <div>
            <button className="btn btn-sm btn-outline" type="button" onClick={() => setLineas((ls) => [...ls, { ...LINEA_VACIA }])}>
              + Añadir línea
            </button>
          </div>
        )}
        <div className="stack stack-1" style={{ alignItems: 'flex-end' }}>
          <span className="t-caption">Base imponible (est.): {formatCOP(desglose.base)}</span>
          <span className="t-caption">IVA (est.): {formatCOP(desglose.iva)}</span>
          {puedeVerCostes && margen && (
            <span className={'t-caption margen-linea' + (margen.valor < 0 ? ' stock-bajo' : '')}>
              🔒 Margen del pedido: {margen.pct == null ? '—' : `${Math.round(margen.pct * 100)}%`} ({formatCOP(margen.valor)})
            </span>
          )}
          <div className="cluster cluster-2">
            <span className="t-label">Total con IVA</span>
            <span className="t-heading">{formatCOP(total)}</span>
          </div>
        </div>
      </div>

      {puedeFacturar && (
      <div className="stack stack-2">
        <span className="t-label">Cobro</span>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Nº de factura</span>
            <input className="input" value={cab.numero_factura} onChange={(e) => setC({ numero_factura: e.target.value })} disabled={congelado} />
          </label>
          <div className="field">
            <span className="field__label">Saldo</span>
            <span className="t-body">{saldo == null ? '—' : formatCOP(saldo)}</span>
          </div>
          <label className="field">
            <span className="field__label">Valor factura (con IVA)</span>
            <input className="input" type="number" min="0" step="any" value={cab.valor_factura}
              onChange={(e) => { setValorFacturaTocado(true); setC({ valor_factura: e.target.value }) }} disabled={congelado} />
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
            <input className="input" type="number" min="0" step="any" value={cab.pagado} onChange={(e) => setC({ pagado: e.target.value })} disabled={congelado} />
          </label>
          <label className="field">
            <span className="field__label">Vencimiento</span>
            <input className="input" type="date" value={cab.fecha_vencimiento} onChange={(e) => setC({ fecha_vencimiento: e.target.value })} disabled={congelado} />
            {!congelado && vencSugerido && cab.fecha_vencimiento !== vencSugerido && (
              <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 'var(--sp-1)' }} onClick={() => setC({ fecha_vencimiento: vencSugerido })}>
                Sugerir: factura + {plazo} días
              </button>
            )}
          </label>
          <label className="field">
            <span className="field__label">Fecha de pago</span>
            <input className="input" type="date" value={cab.fecha_pago} onChange={(e) => setC({ fecha_pago: e.target.value })} disabled={congelado} />
          </label>
          {estadoReal === 'anulado' && (
            <>
              <label className="field">
                <span className="field__label">Nº nota de crédito</span>
                <input className="input" value={cab.nota_credito_numero} onChange={(e) => setC({ nota_credito_numero: e.target.value })} disabled={!puedeEditar} />
              </label>
              <label className="field">
                <span className="field__label">Fecha nota de crédito</span>
                <input className="input" type="date" value={cab.nota_credito_fecha} onChange={(e) => setC({ nota_credito_fecha: e.target.value })} disabled={!puedeEditar} />
              </label>
            </>
          )}
        </div>
      </div>
      )}

      {congelado && (
        <p className="t-caption" style={{ color: 'var(--text-4)' }}>
          Pedido {labelDe(ESTADOS_PEDIDO, estadoReal).toLowerCase()}: las líneas y los datos
          económicos están bloqueados. {puedeEditar ? 'Puedes editar notas' : 'Solo consulta'}
          {esAnulado && puedeEditar ? ' y la nota de crédito' : ''}
          {puedeCiclo ? '; o reactivarlo para volver a operarlo.' : '.'}
        </p>
      )}

      {/* Panel de anulación con nota de crédito (pedido facturado) */}
      {anulando && (
        <div className="card stack stack-2" style={{ borderColor: 'var(--amber, #b45309)' }}>
          <span className="t-label">Anular con nota de crédito</span>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Nº nota de crédito</span>
              <input className="input" autoFocus value={cab.nota_credito_numero}
                onChange={(e) => setC({ nota_credito_numero: e.target.value })} />
            </label>
            <label className="field">
              <span className="field__label">Fecha nota de crédito</span>
              <input className="input" type="date" value={cab.nota_credito_fecha}
                onChange={(e) => setC({ nota_credito_fecha: e.target.value })} />
            </label>
          </div>
          <p className="t-caption" style={{ color: 'var(--text-4)' }}>
            Al anular, el stock de las líneas vuelve al almacén y el pedido queda bloqueado.
          </p>
          <div className="cluster cluster-2">
            <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={confirmarAnulacion}>
              {saving ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button className="btn btn-outline btn-sm" type="button" disabled={saving} onClick={() => setAnulando(false)}>
              Volver
            </button>
          </div>
        </div>
      )}

      {error && <p className="login-error">{error}</p>}

      {!anulando && (
        <div className="cluster cluster-3" style={{ justifyContent: 'space-between' }}>
          <div className="cluster cluster-3">
            {/* Guardar normal: solo en pedido consumidor y con permiso de edición */}
            {editable && (
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</button>
            )}
            {/* Guardar notas/NC de un pedido congelado */}
            {congelado && puedeEditar && onGuardarNotas && (
              <button className="btn btn-primary" type="button" disabled={saving} onClick={guardarNotas}>
                {saving ? 'Guardando…' : 'Guardar notas'}
              </button>
            )}
            <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>Cerrar</button>
          </div>

          {/* Acciones de ciclo de vida (Backoffice/Superadmin) */}
          <div className="cluster cluster-2">
            {!congelado && puedeCiclo && tieneFactura && onAnular && (
              <button className="btn btn-outline btn-sm" type="button" disabled={saving}
                onClick={() => { if (!cab.nota_credito_fecha) setC({ nota_credito_fecha: new Date().toISOString().slice(0, 10) }); setAnulando(true) }}>
                Anular con nota de crédito
              </button>
            )}
            {!congelado && puedeCiclo && !tieneFactura && onCancelar && (
              <button className="btn btn-outline btn-sm" type="button" disabled={saving}
                onClick={() => { if (confirm('¿Cancelar este pedido? El stock de las líneas volverá al almacén.')) ejecutar(onCancelar) }}>
                Cancelar pedido
              </button>
            )}
            {congelado && puedeCiclo && onReactivar && (
              <button className="btn btn-outline btn-sm" type="button" disabled={saving}
                onClick={() => { if (confirm('¿Reactivar este pedido? Se descontará de nuevo el stock (la BD validará disponibilidad).')) ejecutar(onReactivar) }}>
                Reactivar pedido
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  )
}
