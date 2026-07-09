import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { listClientes } from '../../data/clientes'
import { listOportunidades } from '../../data/oportunidades'
import { listPedidosExport } from '../../data/pedidos'
import { listTareas } from '../../data/tareas'
import { CANALES, ETAPAS_ABIERTAS, formatCOP } from '../../data/constants'

interface Metricas {
  clientes: number
  leads: number
  activos: number
  porCanal: { canal: string; n: number }[]
  pipelinePonderado: number
  ganado: number
  oportAbiertas: number
  facturado: number
  cobrado: number
  pendiente: number
  pedidos: number
  tareasPendientes: number
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-metric">
      <p className="card-metric__label">{label}</p>
      <p className="card-metric__value">{value}</p>
      {sub && <p className="card-metric__sub">{sub}</p>}
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [m, setM] = useState<Metricas | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listClientes(), listOportunidades(), listPedidosExport({}), listTareas()])
      .then(([clientes, ops, pedidos, tareas]) => {
        const abiertas = ops.filter((o) => ETAPAS_ABIERTAS.includes(o.etapa))
        const porCanal = CANALES.map((c) => ({
          canal: c.label,
          n: clientes.filter((cl) => cl.canal === c.value).length,
        }))
        setM({
          clientes: clientes.length,
          leads: clientes.filter((c) => c.estado === 'lead').length,
          activos: clientes.filter((c) => c.estado === 'activo').length,
          porCanal,
          pipelinePonderado: abiertas.reduce((s, o) => s + (o.valor_estimado ?? 0) * ((o.probabilidad_cierre ?? 0) / 100), 0),
          ganado: ops.filter((o) => o.etapa === 'cierre_ganado').reduce((s, o) => s + (o.valor_estimado ?? 0), 0),
          oportAbiertas: abiertas.length,
          facturado: pedidos.reduce((s, p) => s + (p.valor_factura ?? 0), 0),
          cobrado: pedidos.reduce((s, p) => s + (p.pagado ?? 0), 0),
          pendiente: pedidos.reduce((s, p) => s + Math.max(0, (p.valor_factura ?? 0) - (p.pagado ?? 0)), 0),
          pedidos: pedidos.length,
          tareasPendientes: tareas.filter((t) => t.estado === 'pendiente').length,
        })
      })
      .catch(() => setError('No se pudo cargar el panel.'))
  }, [])

  return (
    <div className="stack stack-6">
      <div>
        <h1 className="t-display">Dashboard</h1>
        <p className="t-body-sm">
          {profile?.role === 'admin' ? 'Visión global del negocio.' : 'Resumen de tus clientes.'}
          {' '}Aviso: parte de los datos aún son de prueba.
        </p>
      </div>

      {error && <p className="login-error">{error}</p>}
      {!m && !error && <p className="t-body-sm">Cargando…</p>}

      {m && (
        <div className="stack stack-6">
          <div>
            <p className="t-label" style={{ marginBottom: 'var(--sp-3)' }}>Ventas y cobros</p>
            <div className="grid-auto">
              <Metric label="Proyección pipeline" value={formatCOP(m.pipelinePonderado)} sub={`${m.oportAbiertas} oportunidades abiertas`} />
              <Metric label="Facturado" value={formatCOP(m.facturado)} sub={`${m.pedidos} pedidos`} />
              <Metric label="Cobrado" value={formatCOP(m.cobrado)} />
              <Metric label="Pendiente de cobro" value={formatCOP(m.pendiente)} />
              <Metric label="Ganado" value={formatCOP(m.ganado)} sub="Cierres ganados" />
            </div>
          </div>

          <div>
            <p className="t-label" style={{ marginBottom: 'var(--sp-3)' }}>Cartera</p>
            <div className="grid-auto">
              <Metric label="Clientes / leads" value={String(m.clientes)} sub={`${m.leads} leads · ${m.activos} activos`} />
              <Metric label="Tareas pendientes" value={String(m.tareasPendientes)} />
              {m.porCanal.map((c) => (
                <Metric key={c.canal} label={c.canal} value={String(c.n)} sub="clientes" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
