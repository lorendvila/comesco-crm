import { useEffect, useMemo, useState } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP, formatCOPcorto, formatFecha, labelDe, colorEstadoPedido, COLOR_AMBAR, COLOR_VERDE } from '../../data/constants'
import { Badge } from '../../components/Badge'
import { listClientes } from '../../data/clientes'
import type { ClienteResumen } from '../../data/clientes'
import { listReferencias } from '../../data/referencias'
import type { ReferenciaResumen } from '../../data/referencias'
import { getStockMap } from '../../data/inventario'
import type { StockMap } from '../../data/inventario'
import { listAlmacenes } from '../../data/almacenes'
import type { Almacen } from '../../data/almacenes'
import {
  listPedidos,
  getPedido,
  createPedido,
  updatePedido,
  deletePedido,
  listPedidosExport,
  listLineasExport,
  siguienteNumeroPedido,
} from '../../data/pedidos'
import type { PedidoResumen, PedidoConLineas, FiltroPedidos } from '../../data/pedidos'
import { PedidoForm, cabeceraVacia } from '../../components/PedidoForm'
import type { CabeceraState, LineaState } from '../../components/PedidoForm'
import { downloadCSV } from '../../lib/csv'

type Modal = { mode: 'new' } | { mode: 'edit'; pedido: PedidoConLineas } | null

function toCab(p: PedidoConLineas): CabeceraState {
  return {
    cliente_id: p.cliente_id,
    almacen_id: p.almacen_id ?? '',
    fecha_pedido: p.fecha_pedido,
    fecha_entrega: p.fecha_entrega ?? '',
    fecha_factura: p.fecha_factura ?? '',
    canal_origen: p.canal_origen,
    estado: p.estado,
    notas: p.notas ?? '',
    numero_factura: p.numero_factura ?? '',
    valor_factura: p.valor_factura == null ? '' : String(p.valor_factura),
    pagado: p.pagado == null ? '' : String(p.pagado),
    fecha_vencimiento: p.fecha_vencimiento ?? '',
    fecha_pago: p.fecha_pago ?? '',
    nota_credito_numero: p.nota_credito_numero ?? '',
    nota_credito_fecha: p.nota_credito_fecha ?? '',
  }
}

function toLineas(p: PedidoConLineas, referencias: ReferenciaResumen[]): LineaState[] {
  return p.pedido_lineas.map((l) => {
    const iva = referencias.find((r) => r.id === l.referencia_id)?.iva_pct ?? 0
    // Precio base neto: el guardado; si no hay (pedidos antiguos), se deriva del
    // precio final con IVA con descuento 0, para que el importe no cambie al editar.
    const base =
      l.precio_base_cop != null
        ? l.precio_base_cop
        : l.precio_unitario_cop != null
          ? Math.round((l.precio_unitario_cop / (1 + iva / 100)) * 100) / 100
          : null
    return {
      referencia_id: l.referencia_id,
      cantidad: String(l.cantidad),
      unidad: l.unidad,
      precioBase: base == null ? '' : String(base),
      descuento: l.descuento_pct == null ? '0' : String(l.descuento_pct),
    }
  })
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

// --- Cartera (cobranza) ---
// Un pedido cuenta en cartera si tiene factura y saldo pendiente, y no está
// cancelado ni anulado. Misma lógica que el Dashboard, para que los totales
// cuadren entre pantallas.
const esActivoCobranza = (p: PedidoResumen) => p.estado !== 'cancelado' && p.estado !== 'anulado'
// Saldo pendiente = valor factura − pagado (0 si no hay factura o ya está cobrado).
const saldoDe = (p: PedidoResumen) =>
  p.valor_factura == null ? 0 : Math.max(0, p.valor_factura - (p.pagado ?? 0))
const enCartera = (p: PedidoResumen) => esActivoCobranza(p) && saldoDe(p) > 0
const estaVencido = (p: PedidoResumen, hoy: string) =>
  enCartera(p) && p.fecha_vencimiento != null && p.fecha_vencimiento < hoy

// Filtro derivado (se aplica en cliente porque el saldo/vencimiento no es una
// columna simple): todos · en cartera (con saldo) · vencidos.
type CarteraFiltro = '' | 'pendiente' | 'vencido'

// Columnas por las que se puede ordenar la lista, con su valor de comparación.
type SortCol = 'numero_pedido' | 'fecha_pedido' | 'cliente' | 'estado' | 'total_cop' | 'numero_factura' | 'fecha_vencimiento'
type SortDir = 'asc' | 'desc'

const sortValor: Record<SortCol, (p: PedidoResumen) => string | number | null> = {
  numero_pedido: (p) => p.numero_pedido,
  fecha_pedido: (p) => p.fecha_pedido,
  cliente: (p) => p.clientes?.nombre ?? null,
  estado: (p) => p.estado,
  total_cop: (p) => p.total_cop,
  numero_factura: (p) => p.numero_factura,
  fecha_vencimiento: (p) => p.fecha_vencimiento,
}

// Ordena una copia; los vacíos (null) siempre al final.
function ordenar(pedidos: PedidoResumen[], col: SortCol, dir: SortDir): PedidoResumen[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...pedidos].sort((a, b) => {
    const va = sortValor[col](a)
    const vb = sortValor[col](b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), 'es') * factor
  })
}

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [referencias, setReferencias] = useState<ReferenciaResumen[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [stock, setStock] = useState<StockMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [nextNum, setNextNum] = useState<string>('')
  const [filtro, setFiltro] = useState<FiltroPedidos>({})
  const [cartera, setCartera] = useState<CarteraFiltro>('')
  const [sortCol, setSortCol] = useState<SortCol>('numero_pedido')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const hoy = hoyISO()

  // Totales de cartera sobre el conjunto ya filtrado (fechas/cliente/estado),
  // sin que el toggle de vista los afecte: son los importes reales de cobranza.
  const carteraTotal = useMemo(
    () => pedidos.reduce((s, p) => s + (esActivoCobranza(p) ? saldoDe(p) : 0), 0),
    [pedidos],
  )
  const carteraVencida = useMemo(
    () => pedidos.reduce((s, p) => s + (estaVencido(p, hoy) ? saldoDe(p) : 0), 0),
    [pedidos, hoy],
  )

  const pedidosOrdenados = useMemo(() => ordenar(pedidos, sortCol, sortDir), [pedidos, sortCol, sortDir])

  // Vista de la tabla: aplica el toggle de cartera al listado ya ordenado.
  const pedidosVisibles = useMemo(() => {
    if (cartera === 'pendiente') return pedidosOrdenados.filter(enCartera)
    if (cartera === 'vencido') return pedidosOrdenados.filter((p) => estaVencido(p, hoy))
    return pedidosOrdenados
  }, [pedidosOrdenados, cartera, hoy])

  // Clic en cabecera: si es la columna activa alterna sentido; si no, la
  // selecciona (ascendente por defecto, salvo Nº pedido que empieza en desc).
  const ordenarPor = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'numero_pedido' ? 'desc' : 'asc')
    }
  }
  const flecha = (col: SortCol) => (col === sortCol ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const refrescarStock = () => getStockMap().then(setStock).catch(() => {})

  // Abre el modal de nuevo pedido tras pedir el siguiente número OC.
  const abrirNuevo = async () => {
    try {
      setNextNum(await siguienteNumeroPedido())
    } catch {
      setNextNum('')
    }
    setModal({ mode: 'new' })
  }

  // Catálogos (una vez)
  useEffect(() => {
    Promise.all([listClientes(), listReferencias(), getStockMap(), listAlmacenes()])
      .then(([c, r, s, a]) => {
        setClientes(c)
        setReferencias(r)
        setStock(s)
        setAlmacenes(a)
      })
      .catch(() => setError('No se pudieron cargar los catálogos.'))
  }, [])

  // Lista de pedidos (según filtro)
  const cargarPedidos = () => {
    setLoading(true)
    listPedidos(filtro)
      .then(setPedidos)
      .catch(() => setError('No se pudieron cargar los pedidos.'))
      .finally(() => setLoading(false))
  }
  useEffect(cargarPedidos, [filtro])

  const abrirEdicion = async (id: string) => {
    try {
      setModal({ mode: 'edit', pedido: await getPedido(id) })
    } catch {
      setError('No se pudo abrir el pedido.')
    }
  }

  const exportarPedidos = async () => {
    const data = await listPedidosExport(filtro)
    downloadCSV(
      `pedidos_${hoyISO()}.csv`,
      ['Recepción', 'Entrega', 'Factura', 'Vencimiento', 'Fecha pago', 'Cliente', 'Razón social', 'Canal', 'Estado', 'Total COP', 'Nº factura', 'Valor factura', 'Pagado', 'Saldo'],
      data.map((p) => [
        p.fecha_pedido, p.fecha_entrega, p.fecha_factura, p.fecha_vencimiento, p.fecha_pago,
        p.clientes?.nombre ?? '', p.clientes?.razon_social ?? '',
        labelDe(CANALES_ORIGEN, p.canal_origen), labelDe(ESTADOS_PEDIDO, p.estado), p.total_cop,
        p.numero_factura ?? '', p.valor_factura, p.pagado,
        p.valor_factura == null ? '' : p.valor_factura - (p.pagado ?? 0),
      ]),
    )
  }

  const exportarLineas = async () => {
    const rows = await listLineasExport(filtro)
    downloadCSV(
      `pedidos_lineas_${hoyISO()}.csv`,
      [
        'Recepción', 'Entrega', 'Factura', 'Vencimiento', 'Fecha pago',
        'Cliente', 'Razón social', 'Canal', 'Estado',
        'Nº factura', 'Valor factura', 'Pagado', 'Saldo',
        'Referencia', 'Formato', 'Categoría', 'Cantidad', 'Unidad', 'Precio ud. COP', 'Subtotal COP',
      ],
      rows.map((r) => [
        r.fecha_pedido, r.fecha_entrega, r.fecha_factura, r.fecha_vencimiento, r.fecha_pago,
        r.cliente, r.razon_social, labelDe(CANALES_ORIGEN, r.canal_origen), labelDe(ESTADOS_PEDIDO, r.estado),
        r.numero_factura ?? '', r.valor_factura, r.pagado,
        r.valor_factura == null ? '' : r.valor_factura - (r.pagado ?? 0),
        r.referencia, r.formato, r.categoria, r.cantidad, r.unidad, r.precio, r.subtotal,
      ]),
    )
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <h1 className="t-display">Pedidos</h1>
        <button className="btn btn-primary" onClick={abrirNuevo}>Nuevo pedido</button>
      </div>

      <div className="grid-auto">
        <button
          type="button"
          className={'card-metric card-metric--btn' + (cartera === 'pendiente' ? ' card-metric--active' : '')}
          onClick={() => setCartera((c) => (c === 'pendiente' ? '' : 'pendiente'))}
          title="Facturas con saldo pendiente (sin cancelar/anular). Clic para ver solo esas."
        >
          <p className="card-metric__label">Cartera total (pendiente)</p>
          <p className="card-metric__value" style={{ color: COLOR_AMBAR }}>{formatCOPcorto(carteraTotal)}</p>
        </button>
        <button
          type="button"
          className={'card-metric card-metric--btn' + (cartera === 'vencido' ? ' card-metric--active' : '')}
          onClick={() => setCartera((c) => (c === 'vencido' ? '' : 'vencido'))}
          title="Saldo de facturas cuyo vencimiento ya pasó. Clic para ver solo esas."
        >
          <p className="card-metric__label">Cartera vencida</p>
          <p className="card-metric__value" style={{ color: carteraVencida > 0 ? COLOR_AMBAR : COLOR_VERDE }}>
            {formatCOPcorto(carteraVencida)}
          </p>
        </button>
      </div>

      <div className="card stack stack-3">
        <div className="cluster cluster-3" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            <span className="field__label">Desde</span>
            <input className="input" type="date" value={filtro.desde ?? ''} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span className="field__label">Hasta</span>
            <input className="input" type="date" value={filtro.hasta ?? ''} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value || undefined })} />
          </label>
          <label className="field" style={{ minWidth: 220 }}>
            <span className="field__label">Cliente</span>
            <select className="input" value={filtro.clienteId ?? ''} onChange={(e) => setFiltro({ ...filtro, clienteId: e.target.value || undefined })}>
              <option value="">Todos</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="field" style={{ minWidth: 160 }}>
            <span className="field__label">Estado</span>
            <select className="input" value={filtro.estado ?? ''} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value || undefined })}>
              <option value="">Todos</option>
              {ESTADOS_PEDIDO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span className="field__label">Cartera</span>
            <select className="input" value={cartera} onChange={(e) => setCartera(e.target.value as CarteraFiltro)}>
              <option value="">Todos los pedidos</option>
              <option value="pendiente">En cartera (con saldo)</option>
              <option value="vencido">Solo vencidos</option>
            </select>
          </label>
          <button className="btn btn-sm btn-outline" onClick={() => { setFiltro({}); setCartera('') }}>Limpiar</button>
        </div>
        <div className="cluster cluster-2">
          <button className="btn btn-outline btn-sm" onClick={exportarPedidos}>Exportar pedidos (CSV)</button>
          <button className="btn btn-outline btn-sm" onClick={exportarLineas}>Exportar líneas por referencia (CSV)</button>
        </div>
      </div>

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => ordenarPor('numero_pedido')}>Nº pedido{flecha('numero_pedido')}</th>
                <th className="th-sort" onClick={() => ordenarPor('fecha_pedido')}>Recepción{flecha('fecha_pedido')}</th>
                <th className="th-sort" onClick={() => ordenarPor('cliente')}>Cliente{flecha('cliente')}</th>
                <th>Canal</th>
                <th className="th-sort" onClick={() => ordenarPor('estado')}>Estado{flecha('estado')}</th>
                <th className="th-sort" onClick={() => ordenarPor('numero_factura')}>Nº factura{flecha('numero_factura')}</th>
                <th className="th-sort" onClick={() => ordenarPor('fecha_vencimiento')}>Vencimiento{flecha('fecha_vencimiento')}</th>
                <th>Saldo</th>
                <th className="th-sort" onClick={() => ordenarPor('total_cop')}>Total{flecha('total_cop')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidosVisibles.map((p) => {
                const saldo = saldoDe(p)
                const vencido = estaVencido(p, hoy)
                return (
                <tr key={p.id} onClick={() => abrirEdicion(p.id)}>
                  <td>{p.numero_pedido ?? '—'}</td>
                  <td>{formatFecha(p.fecha_pedido)}</td>
                  <td>{p.clientes?.nombre ?? '—'}</td>
                  <td>{labelDe(CANALES_ORIGEN, p.canal_origen)}</td>
                  <td><Badge color={colorEstadoPedido(p.estado)}>{labelDe(ESTADOS_PEDIDO, p.estado)}</Badge></td>
                  <td>{p.numero_factura ?? '—'}</td>
                  <td style={vencido ? { color: COLOR_AMBAR, fontWeight: 600 } : undefined}>
                    {formatFecha(p.fecha_vencimiento)}{vencido ? ' · vencido' : ''}
                  </td>
                  <td style={saldo > 0 ? { color: COLOR_AMBAR, fontWeight: 600 } : undefined}>
                    {p.valor_factura == null ? '—' : formatCOP(saldo)}
                  </td>
                  <td>{formatCOP(p.total_cop)}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); abrirEdicion(p.id) }}>Ver</button></td>
                </tr>
                )
              })}
              {pedidosVisibles.length === 0 && (
                <tr><td colSpan={10} className="t-body-sm">No hay pedidos con estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--sp-4)' }}>
              <h2 className="t-heading">{modal.mode === 'new' ? 'Nuevo pedido' : 'Pedido'}</h2>
              {(modal.mode === 'new' ? nextNum : modal.pedido.numero_pedido) && (
                <span className="pedido-num" title={modal.mode === 'new' ? 'Se asignará al guardar' : undefined}>
                  {modal.mode === 'new' ? nextNum : modal.pedido.numero_pedido}
                </span>
              )}
            </div>
            <PedidoForm
              clientes={clientes}
              referencias={referencias}
              almacenes={almacenes}
              stock={stock}
              esNuevo={modal.mode === 'new'}
              initialCab={modal.mode === 'new' ? cabeceraVacia() : toCab(modal.pedido)}
              initialLineas={modal.mode === 'new' ? [] : toLineas(modal.pedido, referencias)}
              submitLabel={modal.mode === 'new' ? 'Crear pedido' : 'Guardar cambios'}
              onCancel={() => setModal(null)}
              onSubmit={async ({ cabecera, lineas }) => {
                if (modal.mode === 'new') await createPedido(cabecera, lineas)
                else await updatePedido(modal.pedido.id, cabecera, lineas)
                setModal(null)
                cargarPedidos()
                refrescarStock()
              }}
              onDelete={
                modal.mode === 'edit'
                  ? async () => {
                      await deletePedido(modal.pedido.id)
                      setModal(null)
                      cargarPedidos()
                      refrescarStock()
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
