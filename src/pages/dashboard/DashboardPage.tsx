import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { listClientes } from '../../data/clientes'
import { listOportunidades } from '../../data/oportunidades'
import { listPedidosExport } from '../../data/pedidos'
import { listInventario } from '../../data/inventario'
import { resumenProducto } from '../../data/informes'
import type { RefVenta } from '../../data/informes'
import {
  CANALES,
  ETAPAS,
  formatCOPcorto,
  colorFamilia,
  costeConComision,
  COLOR_GOLD,
  COLOR_VERDE,
  COLOR_AMBAR,
  COLOR_AZUL,
} from '../../data/constants'

const ETAPA_COLOR: Record<string, string> = {
  prospeccion: '#A2946F',
  negociacion: '#C9AE7E',
  cierre_ganado: '#ECC978',
  cierre_perdido: '#7C8794',
}

interface BarItem {
  name: string
  val: number
  text: string
  color: string
}

interface Metricas {
  facturado: number
  pendiente: number
  vencido: number
  margen: number
  margenPct: number
  valorInventario: number
  pipelinePorEtapa: BarItem[]
  porCanal: BarItem[]
  porFamilia: BarItem[]
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

// Barra apilada: nombre + valor arriba, barra debajo (Comercial).
function BarrasStack({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.val))
  return (
    <div>
      {items.map((i) => (
        <div key={i.name} className="hbar-row">
          <div className="hbar-row__head">
            <span className="hbar-row__name">{i.name}</span>
            <span className="hbar-row__val">{i.text}</span>
          </div>
          <div className="hbar"><div className="hbar__fill" style={{ width: `${(i.val / max) * 100}%`, background: i.color }} /></div>
        </div>
      ))}
    </div>
  )
}

// Barra en línea: nombre · barra · valor (Producto).
function BarrasInline({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.val))
  return (
    <div>
      {items.map((i) => (
        <div key={i.name} className="hbar-inline">
          <span className="hbar-inline__name">{i.name}</span>
          <div className="hbar"><div className="hbar__fill" style={{ width: `${(i.val / max) * 100}%`, background: i.color }} /></div>
          <span className="hbar-inline__val">{i.text}</span>
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
    Promise.all([listClientes(), listOportunidades(), listPedidosExport({}), listInventario(), resumenProducto()])
      .then(([clientes, ops, pedidos, inventario, prod]) => {
        const margen = prod.totalRevenue - prod.totalCogs
        // Las facturas canceladas o anuladas por NC no cuentan en la cobranza.
        const activos = pedidos.filter((p) => p.estado !== 'cancelado' && p.estado !== 'anulado')
        // Stock total por referencia = suma de todos los almacenes.
        const totalPorRef = new Map<string, number>()
        for (const f of inventario) totalPorRef.set(f.referencia_id, (totalPorRef.get(f.referencia_id) ?? 0) + f.cantidad_disponible)
        setM({
          facturado: activos.reduce((s, p) => s + (p.valor_factura ?? 0), 0),
          pendiente: activos.reduce((s, p) => s + Math.max(0, (p.valor_factura ?? 0) - (p.pagado ?? 0)), 0),
          vencido: activos.reduce((s, p) => {
            const saldo = (p.valor_factura ?? 0) - (p.pagado ?? 0)
            return s + (p.fecha_vencimiento && p.fecha_vencimiento < hoy && saldo > 0 ? saldo : 0)
          }, 0),
          margen,
          margenPct: prod.totalRevenue > 0 ? margen / prod.totalRevenue : 0,
          valorInventario: inventario.reduce((s, f) => s + f.cantidad_disponible * (costeConComision(f.coste_almacen_cop) ?? 0), 0),
          pipelinePorEtapa: ETAPAS.map((et) => {
            const valor = ops.filter((o) => o.etapa === et.value).reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
            return { name: et.label, val: valor, text: formatCOPcorto(valor), color: ETAPA_COLOR[et.value] }
          }),
          porCanal: CANALES.map((c) => {
            const n = clientes.filter((cl) => cl.canal === c.value).length
            return { name: c.label, val: n, text: String(n), color: COLOR_AZUL }
          }),
          porFamilia: prod.porFamilia.map((f) => ({ name: f.categoria, val: f.unidades, text: String(f.unidades), color: colorFamilia(f.categoria) })),
          topReferencias: prod.topReferencias,
          sinStock: [...totalPorRef.values()].filter((t) => t <= 0).length,
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
              <Kpi label="Facturado" value={formatCOPcorto(m.facturado)} accent={COLOR_GOLD} />
              <Kpi label="Pendiente de cobro" value={formatCOPcorto(m.pendiente)} accent={COLOR_AMBAR}
                sub={m.vencido > 0 ? `${formatCOPcorto(m.vencido)} vencido` : 'sin vencidos'} />
              <Kpi label="Margen bruto" value={pct(m.margenPct)} accent={m.margen >= 0 ? COLOR_VERDE : COLOR_AMBAR} sub={`${formatCOPcorto(m.margen)} · sin IVA`} />
              <Kpi label="Valor inventario" value={formatCOPcorto(m.valorInventario)} accent={COLOR_AZUL} />
            </div>
          </section>

          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Comercial</div>
            <div className="grid-2">
              <div className="panel">
                <div className="panel__title">Pipeline por etapa</div>
                <BarrasStack items={m.pipelinePorEtapa} />
              </div>
              <div className="panel">
                <div className="panel__title">Clientes por canal</div>
                <BarrasStack items={m.porCanal} />
              </div>
            </div>
          </section>

          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Producto · Compras</div>
            <div className="grid-2">
              <div className="panel">
                <div className="panel__title">Unidades vendidas por familia</div>
                {m.porFamilia.length === 0
                  ? <p className="t-body-sm">Sin ventas registradas todavía.</p>
                  : <BarrasInline items={m.porFamilia} />}
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
                          <td className="ref-name">
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFamilia(r.categoria), marginRight: 8, flexShrink: 0 }} />
                            {r.nombre} · {r.formato}
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.unidades}</td>
                          <td style={{ textAlign: 'right' }}>{formatCOPcorto(r.valor)}</td>
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
