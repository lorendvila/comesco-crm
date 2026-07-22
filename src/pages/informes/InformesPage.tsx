import { useEffect, useState } from 'react'
import { facturacionMensual, rotacionReferencias } from '../../data/informes'
import type { MesFacturacion, RotacionReferencias, RefRotacion } from '../../data/informes'
import { downloadCSV } from '../../lib/csv'
import {
  formatCOP,
  formatCOPcorto,
  colorFamilia,
  COLOR_GOLD,
  COLOR_VERDE,
  COLOR_AMBAR,
  COLOR_AZUL,
} from '../../data/constants'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// 'YYYY-MM' -> 'jul 2026'
function labelMes(mes: string): string {
  const [y, m] = mes.split('-')
  return `${MESES[Number(m) - 1] ?? m} ${y}`
}
// 'YYYY-MM' -> 'jul' (encabezado compacto de la matriz)
function labelMesCorto(mes: string): string {
  const m = Number(mes.split('-')[1])
  return MESES[m - 1] ?? mes
}

const hoyISO = () => new Date().toISOString().slice(0, 10)
const pct = (n: number) => `${Math.round(n * 100)}%`
const uds = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 0 })

// Barra vertical: facturado (relleno) con cobrado marcado dentro.
function BarrasMes({ data }: { data: MesFacturacion[] }) {
  const max = Math.max(1, ...data.map((d) => d.facturado))
  return (
    <div className="bars-col">
      {data.map((d) => (
        <div key={d.mes} className="bars-col__item" title={`${labelMes(d.mes)} · ${formatCOP(d.facturado)}`}>
          <span className="bars-col__val">{formatCOPcorto(d.facturado)}</span>
          <div className="bars-col__track">
            <div className="bars-col__fill" style={{ height: `${(d.facturado / max) * 100}%`, background: COLOR_GOLD }}>
              <div className="bars-col__paid" style={{ height: `${d.facturado > 0 ? (d.cobrado / d.facturado) * 100 : 0}%`, background: COLOR_VERDE }} />
            </div>
          </div>
          <span className="bars-col__label">{labelMes(d.mes)}</span>
        </div>
      ))}
    </div>
  )
}

// Etiqueta de cobertura de stock -> aviso de reposición.
function avisoCobertura(r: RefRotacion): { texto: string; color: string } {
  if (r.demandaMensual <= 0) return { texto: 'Sin demanda', color: COLOR_AZUL }
  if (r.stock <= 0) return { texto: 'Sin stock', color: COLOR_AMBAR }
  const c = r.coberturaMeses ?? 0
  if (c < 1) return { texto: 'Reponer ya', color: COLOR_AMBAR }
  if (c < 2) return { texto: 'Vigilar', color: COLOR_GOLD }
  return { texto: 'OK', color: COLOR_VERDE }
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

// Punto de color de familia + nombre de la referencia (celda de tabla).
function RefCell({ r }: { r: RefRotacion }) {
  return (
    <td className="ref-name">
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFamilia(r.categoria), marginRight: 8, flexShrink: 0 }} />
      {r.nombre} · {r.formato}
    </td>
  )
}

export function InformesPage() {
  const [meses, setMeses] = useState<MesFacturacion[] | null>(null)
  const [rot, setRot] = useState<RotacionReferencias | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([facturacionMensual(), rotacionReferencias()])
      .then(([m, r]) => {
        setMeses(m)
        setRot(r)
      })
      .catch(() => setError('No se pudieron cargar los informes.'))
  }, [])

  const exportarMensual = () => {
    if (!meses) return
    downloadCSV(
      `facturacion_mensual_${hoyISO()}.csv`,
      ['Mes', 'Nº pedidos', 'Facturado COP', 'Cobrado COP', 'Pendiente COP'],
      meses.map((m) => [labelMes(m.mes), m.numPedidos, m.facturado, m.cobrado, m.pendiente]),
    )
  }

  // Matriz de rotación: una fila por referencia, una columna por mes.
  const exportarRotacion = () => {
    if (!rot) return
    downloadCSV(
      `rotacion_mensual_${hoyISO()}.csv`,
      ['Referencia', 'Formato', 'Categoría', 'Unidad', ...rot.meses.map(labelMes), 'Total'],
      rot.refs.map((r) => [
        r.nombre, r.formato, r.categoria ?? '', r.unidad,
        ...rot.meses.map((mes) => r.porMes[mes] ?? 0),
        r.total,
      ]),
    )
  }

  const exportarDemanda = () => {
    if (!rot) return
    downloadCSV(
      `demanda_estimada_${hoyISO()}.csv`,
      ['Referencia', 'Formato', 'Categoría', 'Unidad', 'Demanda mensual estimada', 'Stock', 'Cobertura (meses)', 'Aviso'],
      rot.refs.map((r) => [
        r.nombre, r.formato, r.categoria ?? '', r.unidad,
        Math.round(r.demandaMensual), r.stock,
        r.coberturaMeses == null ? '' : r.coberturaMeses.toFixed(1), avisoCobertura(r).texto,
      ]),
    )
  }

  // Totales para KPIs de cabecera.
  const totFacturado = meses?.reduce((s, m) => s + m.facturado, 0) ?? 0
  const totCobrado = meses?.reduce((s, m) => s + m.cobrado, 0) ?? 0
  const totPendiente = meses?.reduce((s, m) => s + m.pendiente, 0) ?? 0

  // Demanda: las referencias que necesitan atención primero (menor cobertura).
  const demandaOrdenada = rot
    ? [...rot.refs]
        .filter((r) => r.demandaMensual > 0)
        .sort((a, b) => (a.coberturaMeses ?? Infinity) - (b.coberturaMeses ?? Infinity))
    : []

  const nVentana = rot?.mesesVentana.length ?? 0

  return (
    <div className="stack stack-8">
      <div>
        <h1 className="t-display">Informes</h1>
        <p className="t-body-sm">
          Facturación, rotación de producto y demanda estimada.{' '}
          {rot && rot.meses.length > 0 && `Periodo: ${labelMes(rot.meses[0])} – ${labelMes(rot.meses[rot.meses.length - 1])}.`}
        </p>
      </div>

      {error && <p className="login-error">{error}</p>}
      {!meses && !error && <p className="t-body-sm">Cargando…</p>}

      {meses && rot && (
        <>
          {/* ---- Facturación ---- */}
          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Facturación</div>
            <div className="grid-auto">
              <Kpi label="Facturado" value={formatCOPcorto(totFacturado)} accent={COLOR_GOLD} />
              <Kpi label="Cobrado" value={formatCOPcorto(totCobrado)} accent={COLOR_VERDE} />
              <Kpi label="Pendiente de cobro" value={formatCOPcorto(totPendiente)} accent={COLOR_AMBAR} />
            </div>

            <div className="panel" style={{ marginTop: 'var(--sp-4)' }}>
              <div className="panel__head">
                <div className="panel__title">Facturación mensual</div>
                <button className="btn btn-outline btn-sm" onClick={exportarMensual}>Exportar CSV</button>
              </div>
              {meses.length === 0 ? (
                <p className="t-body-sm">Sin facturación registrada todavía.</p>
              ) : (
                <>
                  <BarrasMes data={meses} />
                  <div className="legend">
                    <span className="legend__item"><span className="legend__dot" style={{ background: COLOR_GOLD }} />Facturado</span>
                    <span className="legend__item"><span className="legend__dot" style={{ background: COLOR_VERDE }} />Cobrado</span>
                  </div>
                  <div className="table-wrap" style={{ marginTop: 'var(--sp-3)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th style={{ textAlign: 'right' }}>Pedidos</th>
                        <th style={{ textAlign: 'right' }}>Facturado</th>
                        <th style={{ textAlign: 'right' }}>Cobrado</th>
                        <th style={{ textAlign: 'right' }}>Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meses.map((m) => (
                        <tr key={m.mes}>
                          <td>{labelMes(m.mes)}</td>
                          <td style={{ textAlign: 'right' }}>{m.numPedidos}</td>
                          <td style={{ textAlign: 'right' }}>{formatCOP(m.facturado)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCOP(m.cobrado)}</td>
                          <td style={{ textAlign: 'right', color: m.pendiente > 0 ? COLOR_AMBAR : undefined }}>{formatCOP(m.pendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ---- Rotación por referencia (unidades vendidas por mes) ---- */}
          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Rotación de producto</div>
            <div className="panel">
              <div className="panel__head">
                <div className="panel__title">Cajas vendidas por referencia y mes</div>
                <button className="btn btn-outline btn-sm" onClick={exportarRotacion}>Exportar CSV</button>
              </div>
              {rot.refs.length === 0 ? (
                <p className="t-body-sm">Sin ventas registradas todavía.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table matrix">
                    <thead>
                      <tr>
                        <th>Referencia</th>
                        {rot.meses.map((mes) => (
                          <th key={mes} style={{ textAlign: 'right' }} title={labelMes(mes)}>{labelMesCorto(mes)}</th>
                        ))}
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rot.refs.map((r) => (
                        <tr key={r.referencia_id}>
                          <RefCell r={r} />
                          {rot.meses.map((mes) => {
                            const v = r.porMes[mes] ?? 0
                            return <td key={mes} style={{ textAlign: 'right', color: v === 0 ? 'var(--text-4)' : undefined }}>{v === 0 ? '·' : uds(v)}</td>
                          })}
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{uds(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* ---- Demanda estimada / reposición ---- */}
          <section>
            <div className="block-label" style={{ color: COLOR_AZUL }}>Demanda estimada · Reposición</div>
            <div className="panel">
              <div className="panel__head">
                <div className="panel__title">Demanda mensual estimada y cobertura de stock</div>
                <button className="btn btn-outline btn-sm" onClick={exportarDemanda}>Exportar CSV</button>
              </div>
              <p className="t-body-sm" style={{ marginBottom: 'var(--sp-3)' }}>
                Demanda estimada = media de cajas vendidas en {nVentana === 1 ? 'el último mes' : `los últimos ${nVentana} meses`}.
                La cobertura indica cuántos meses aguanta el stock actual a ese ritmo.
              </p>
              {demandaOrdenada.length === 0 ? (
                <p className="t-body-sm">Sin demanda registrada todavía.</p>
              ) : (
                <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th style={{ textAlign: 'right' }}>Demanda/mes</th>
                      <th style={{ textAlign: 'right' }}>Stock</th>
                      <th style={{ textAlign: 'right' }}>Cobertura</th>
                      <th style={{ textAlign: 'center' }}>Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandaOrdenada.map((r) => {
                      const a = avisoCobertura(r)
                      return (
                        <tr key={r.referencia_id}>
                          <RefCell r={r} />
                          <td style={{ textAlign: 'right' }}>{uds(Math.round(r.demandaMensual))}</td>
                          <td style={{ textAlign: 'right' }}>{uds(r.stock)}</td>
                          <td style={{ textAlign: 'right' }}>{r.coberturaMeses == null ? '—' : `${r.coberturaMeses.toFixed(1)} m`}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="pill" style={{ background: a.color }}>{a.texto}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
