import { useEffect, useState } from 'react'
import { CANALES_ORIGEN, ESTADOS_PEDIDO, formatCOP, formatFecha, labelDe } from '../../data/constants'
import { listClientes } from '../../data/clientes'
import type { ClienteResumen } from '../../data/clientes'
import { listReferencias } from '../../data/referencias'
import type { ReferenciaResumen } from '../../data/referencias'
import {
  listPedidos,
  getPedido,
  createPedido,
  updatePedido,
  deletePedido,
} from '../../data/pedidos'
import type { PedidoResumen, PedidoConLineas } from '../../data/pedidos'
import { PedidoForm, cabeceraVacia } from '../../components/PedidoForm'
import type { CabeceraState, LineaState } from '../../components/PedidoForm'

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
  }
}

function toLineas(p: PedidoConLineas): LineaState[] {
  return p.pedido_lineas.map((l) => ({
    referencia_id: l.referencia_id,
    cantidad: String(l.cantidad),
    unidad: l.unidad,
    precio: l.precio_unitario_cop == null ? '' : String(l.precio_unitario_cop),
  }))
}

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [referencias, setReferencias] = useState<ReferenciaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)

  const cargar = () => {
    setLoading(true)
    Promise.all([listPedidos(), listClientes(), listReferencias()])
      .then(([p, c, r]) => {
        setPedidos(p)
        setClientes(c)
        setReferencias(r)
      })
      .catch(() => setError('No se pudieron cargar los pedidos.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const abrirEdicion = async (id: string) => {
    try {
      const pedido = await getPedido(id)
      setModal({ mode: 'edit', pedido })
    } catch {
      setError('No se pudo abrir el pedido.')
    }
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <h1 className="t-display">Pedidos</h1>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'new' })}>Nuevo pedido</button>
      </div>

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
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
                  <td>{formatFecha(p.fecha_pedido)}</td>
                  <td>{p.clientes?.nombre ?? '—'}</td>
                  <td>{labelDe(CANALES_ORIGEN, p.canal_origen)}</td>
                  <td><span className="badge">{labelDe(ESTADOS_PEDIDO, p.estado)}</span></td>
                  <td>{formatCOP(p.total_cop)}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); abrirEdicion(p.id) }}>Ver</button></td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr><td colSpan={6} className="t-body-sm">Aún no hay pedidos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="t-heading" style={{ marginBottom: 'var(--sp-4)' }}>
              {modal.mode === 'new' ? 'Nuevo pedido' : 'Pedido'}
            </h2>
            <PedidoForm
              clientes={clientes}
              referencias={referencias}
              initialCab={modal.mode === 'new' ? cabeceraVacia() : toCab(modal.pedido)}
              initialLineas={modal.mode === 'new' ? [] : toLineas(modal.pedido)}
              submitLabel={modal.mode === 'new' ? 'Crear pedido' : 'Guardar cambios'}
              onCancel={() => setModal(null)}
              onSubmit={async ({ cabecera, lineas }) => {
                if (modal.mode === 'new') await createPedido(cabecera, lineas)
                else await updatePedido(modal.pedido.id, cabecera, lineas)
                setModal(null)
                cargar()
              }}
              onDelete={
                modal.mode === 'edit'
                  ? async () => {
                      await deletePedido(modal.pedido.id)
                      setModal(null)
                      cargar()
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
