import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { listClientes } from '../../data/clientes'
import { listOportunidades } from '../../data/oportunidades'
import { listPedidosExport } from '../../data/pedidos'
import { listTareas } from '../../data/tareas'
import { listInventario } from '../../data/inventario'
import { resumenProducto } from '../../data/informes'
import type { RefVenta } from '../../data/informes'
import {
  CANALES,
  ETAPAS_ABIERTAS,
  formatCOP,
  colorFamilia,
  COLOR_GOLD,
  COLOR_VERDE,
  COLOR_AMBAR,
  COLOR_AZUL,
} from '../../data/constants'

interface Metricas {
  facturado: number
  pendiente: number
  vencido: number
  margen: number
  margenPct: number
  valorInventario: number
  pipelinePonderado: number
  oportAbiertas: number
  leads: number
  activos: number
  porCanal: { label: string; n: number }[]
  porFamilia: { categoria: string; unidades: number }[]
  topReferencias: RefVenta[]
  sinStock: number
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="kpi" style={{ borderTopColor: accent }}>
      <p className="kpi__label">{label}</p>
      <p className="kpi__value" style={{ color: accent }}>{value}</p>
      {sub && <p className="kpi__sub">{sub}</p>}
    </div>
  )
}

function Barras({ items }: { items: { name: string; val: number; color: string; fmt?: (n: number) => string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.val))
  return (
    <div>
      {items.map((i) => (
        <div key={i.name} className="hbar-row">
          <div className="hbar-row__head">
            <span className="hbar-row__name">{i.name}</span>
            <span className="hbar-row__val">{i.fmt ? i.fmt(i.val) : i.val}</span>
          </div>
          <div className="hbar">
            <div className="hbar__fill" style={{ width: `${(i.val / max) * 100}%`, background: i.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function DashboardPage() {
  const { profile } = useAuth()
  const [m, setM] = useState<Metricas | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    Promise.all([
      listClientes(),
      listOportunidades(),
      listPedidosExport({}),
      listTareas(),
      listInventario(),
      resumenProducto(),
    ])
      .then(([clientes, ops, pedidos, tareas, inventario, prod]) => {
        void tareas
        const abiertas = ops.filter((o) => ETAPAS_ABIERTAS.includes(o.etapa))
        const margen = prod.totalRevenue - prod.totalCogs
        setM({
          facturado: pedidos.reduce((s, p) => s + (p.valor_factura ?? 0), 0),
          pendiente: pedidos.reduce((s, p) => s + Math.max(0, (p.valor_factura ?? 0) - (p.pagado ?? 0)), 0),
          vencido: pedidos.reduce((s, p) => {
            const saldo = (p.valor_factura ?? 0) - (p.pagado ?? 0)
            return s + (p.fecha_vencimiento && p.fecha_vencimiento < hoy && saldo > 0 ? saldo : 0)
          }, 0),
          margen,
          margenPct: prod.totalRevenue > 0 ? margen / prod.totalRevenue : 0,
          valorInventario: inventario.reduce((s, f) => s + (f.inv ? f.inv.cantidad_disponible * (f.coste_almacen_cop ?? 0) : 0), 0),
          pipelinePonderado: abiertas.reduce((s, o) => s + (o.valor_estimado ?? 0) * ((o.probabilidad_cierre ?? 0) / 100), 0),
          oportAbiertas: abiertas.length,
          leads: clientes.filter((c) => c.estado === 'lead').length,
          activos: clientes.filter((c) => c.estado === 'activo').length,
          porCanal: CANALES.map((c) => ({ label: c.label, n: clientes.filter((cl) => cl.canal === c.value).length })),
          porFamilia: prod.porFamilia,
          topReferencias: prod.topReferencias,
          sinStock: inventario.filter((f) => !f.inv || f.inv.cantidad_disponible <= 0).length,
        })
      })
      .catch(() => setError('No se pudo cargar el panel.'))
  }, [])

  return (
    <div className="stack stack-8">
      <div>
        <h1 className="t-display">Dashboard</h1>
        <p className="t-body-sm">
          {profile?.role === 'admin' ? 'Visión global del negocio.' : 'Resumen de tus clientes.'}{' '}
          Aviso: parte de los datos aún son de prueba.
        </p>
      </div>

      {error && <p className="login-error">{error}</p>}
      {!m && !error && <p className="t-body-sm">Cargando…</p>}

      {m && (
        <>
          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Financiero</div>
            <div className="grid-auto">
              <Kpi label="Facturado" value={formatCOP(m.facturado)} accent={COLOR_GOLD} />
              <Kpi label="Pendiente de cobro" value={formatCOP(m.pendiente)} accent={COLOR_AMBAR}
                sub={m.vencido > 0 ? `${formatCOP(m.vencido)} vencido` : 'sin vencidos'} />
              <Kpi label="Margen bruto" value={pct(m.margenPct)} accent={COLOR_VERDE} sub={formatCOP(m.margen)} />
              <Kpi label="Valor inventario" value={formatCOP(m.valorInventario)} accent={COLOR_AZUL} />
            </div>
          </section>

          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Comercial</div>
            <div className="grid-auto">
              <Kpi label="Proyección pipeline" value={formatCOP(m.pipelinePonderado)} accent={COLOR_GOLD}
                sub={`${m.oportAbiertas} oportunidades abiertas`} />
              <Kpi label="Clientes activos" value={String(m.activos)} accent={COLOR_VERDE}
                sub={`${m.leads} leads por convertir`} />
              <div className="panel">
                <div className="panel__title">Clientes por canal</div>
                <Barras items={m.porCanal.map((c) => ({ name: c.label, val: c.n, color: COLOR_AZUL }))} />
              </div>
            </div>
          </section>

          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Producto · Compras</div>
            <div className="grid-2">
              <div className="panel">
                <div className="panel__title">Unidades vendidas por familia</div>
                {m.porFamilia.length === 0 ? (
                  <p className="t-body-sm">Sin ventas registradas todavía.</p>
                ) : (
                  <Barras items={m.porFamilia.map((f) => ({ name: f.categoria, val: f.unidades, color: colorFamilia(f.categoria) }))} />
                )}
              </div>
              <div className="panel">
                <div className="panel__title">Top referencias</div>
                {m.topReferencias.length === 0 ? (
                  <p className="t-body-sm">Sin ventas registradas todavía.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Referencia</th><th style={{ textAlign: 'right' }}>Uds</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                    </thead>
                    <tbody>
                      {m.topReferencias.map((r) => (
                        <tr key={r.nombre + r.formato}>
                          <td>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFamilia(r.categoria), marginRight: 8 }} />
                            {r.nombre} · {r.formato}
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.unidades}</td>
                          <td style={{ textAlign: 'right' }}>{formatCOP(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="grid-auto" style={{ marginTop: 'var(--sp-4)' }}>
              <Kpi label="Referencias sin stock" value={String(m.sinStock)} accent={COLOR_AMBAR} sub="reponer a tiempo" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
