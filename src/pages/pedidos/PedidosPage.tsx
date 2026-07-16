import { useEffect, useState } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP, formatFecha, labelDe, colorEstadoPedido } from '../../data/constants'
import { Badge } from '../../components/Badge'
import { listClientes } from '../../data/clientes'
import type { ClienteResumen } from '../../data/clientes'
import { listReferencias } from '../../data/referencias'
import type { ReferenciaResumen } from '../../data/referencias'
import { getStockMap } from '../../data/inventario'
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

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [referencias, setReferencias] = useState<ReferenciaResumen[]>([])
  const [stock, setStock] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [nextNum, setNextNum] = useState<string>('')
  const [filtro, setFiltro] = useState<FiltroPedidos>({})

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
    Promise.all([listClientes(), listReferencias(), getStockMap()])
      .then(([c, r, s]) => {
        setClientes(c)
        setReferencias(r)
        setStock(s)
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
          <button className="btn btn-sm btn-outline" onClick={() => setFiltro({})}>Limpiar</button>
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
                <th>Nº pedido</th>
                <th>Recepción</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} onClick={() => abrirEdicion(p.id)}>
                  <td>{p.numero_pedido ?? '—'}</td>
                  <td>{formatFecha(p.fecha_pedido)}</td>
                  <td>{p.clientes?.nombre ?? '—'}</td>
                  <td>{labelDe(CANALES_ORIGEN, p.canal_origen)}</td>
                  <td><Badge color={colorEstadoPedido(p.estado)}>{labelDe(ESTADOS_PEDIDO, p.estado)}</Badge></td>
                  <td>{formatCOP(p.total_cop)}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); abrirEdicion(p.id) }}>Ver</button></td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr><td colSpan={7} className="t-body-sm">No hay pedidos con estos filtros.</td></tr>
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
              stock={stock}
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
