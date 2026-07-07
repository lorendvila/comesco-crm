import { useEffect, useMemo, useState } from 'react'
import { ETAPAS, ETAPAS_ABIERTAS, formatCOP } from '../../data/constants'
import { listClientes } from '../../data/clientes'
import type { ClienteResumen } from '../../data/clientes'
import {
  listOportunidades,
  createOportunidad,
  updateOportunidad,
  deleteOportunidad,
} from '../../data/oportunidades'
import type { Oportunidad, OportunidadConCliente } from '../../data/oportunidades'
import {
  OportunidadForm,
  OPORTUNIDAD_VACIA,
  oportunidadToValues,
  valuesToOportunidadPayload,
} from '../../components/OportunidadForm'

type Modal = { mode: 'new' } | { mode: 'edit'; op: Oportunidad } | null

export function PipelinePage() {
  const [ops, setOps] = useState<OportunidadConCliente[]>([])
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)

  const cargar = () => {
    setLoading(true)
    Promise.all([listOportunidades(), listClientes()])
      .then(([o, c]) => {
        setOps(o)
        setClientes(c)
      })
      .catch(() => setError('No se pudieron cargar las oportunidades.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const resumen = useMemo(() => {
    const abiertas = ops.filter((o) => ETAPAS_ABIERTAS.includes(o.etapa))
    const bruto = abiertas.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
    const ponderado = abiertas.reduce(
      (s, o) => s + (o.valor_estimado ?? 0) * ((o.probabilidad_cierre ?? 0) / 100),
      0,
    )
    const ganado = ops
      .filter((o) => o.etapa === 'cierre_ganado')
      .reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
    return { bruto, ponderado, ganado }
  }, [ops])

  const moverEtapa = async (op: OportunidadConCliente, etapa: string) => {
    await updateOportunidad(op.id, { etapa })
    cargar()
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <h1 className="t-display">Pipeline</h1>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'new' })}>
          Nueva oportunidad
        </button>
      </div>

      <div className="summary-row">
        <div className="card-metric">
          <p className="card-metric__label">Pipeline abierto (bruto)</p>
          <p className="card-metric__value">{formatCOP(resumen.bruto)}</p>
          <p className="card-metric__sub">Prospección + Negociación</p>
        </div>
        <div className="card-metric">
          <p className="card-metric__label">Proyección ponderada</p>
          <p className="card-metric__value">{formatCOP(resumen.ponderado)}</p>
          <p className="card-metric__sub">Valor × probabilidad</p>
        </div>
        <div className="card-metric">
          <p className="card-metric__label">Ganado</p>
          <p className="card-metric__value">{formatCOP(resumen.ganado)}</p>
          <p className="card-metric__sub">Cierres ganados</p>
        </div>
      </div>

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="pipeline-scroll">
          <div className="pipeline-board">
            {ETAPAS.map((et) => {
              const enEtapa = ops.filter((o) => o.etapa === et.value)
              const suma = enEtapa.reduce((s, o) => s + (o.valor_estimado ?? 0), 0)
              return (
                <div key={et.value} className="pipeline-col">
                  <div className="pipeline-col__head">
                    <span className="t-sub">{et.label}</span>
                    <span className="t-caption">{enEtapa.length} · {formatCOP(suma)}</span>
                  </div>
                  {enEtapa.map((o) => (
                    <div key={o.id} className="oportunidad-card">
                      <span className="t-body">{o.clientes?.nombre ?? '—'}</span>
                      <div className="cluster cluster-2">
                        <span className="t-sub">{formatCOP(o.valor_estimado)}</span>
                        {o.probabilidad_cierre != null && (
                          <span className="badge">{o.probabilidad_cierre}%</span>
                        )}
                      </div>
                      {o.fecha_cierre && <span className="t-caption">Cierre: {o.fecha_cierre}</span>}
                      <div className="cluster cluster-2">
                        <select
                          className="input input-xs"
                          value={o.etapa}
                          onChange={(e) => moverEtapa(o, e.target.value)}
                          title="Mover de etapa"
                        >
                          {ETAPAS.map((e2) => (
                            <option key={e2.value} value={e2.value}>{e2.label}</option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-outline" onClick={() => setModal({ mode: 'edit', op: o })}>
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                  {enEtapa.length === 0 && <p className="t-caption" style={{ padding: 'var(--sp-2)' }}>—</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="t-heading" style={{ marginBottom: 'var(--sp-4)' }}>
              {modal.mode === 'new' ? 'Nueva oportunidad' : 'Editar oportunidad'}
            </h2>
            <OportunidadForm
              clientes={clientes}
              initial={modal.mode === 'new' ? OPORTUNIDAD_VACIA : oportunidadToValues(modal.op)}
              submitLabel={modal.mode === 'new' ? 'Crear' : 'Guardar'}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                const payload = valuesToOportunidadPayload(values)
                if (modal.mode === 'new') await createOportunidad(payload)
                else await updateOportunidad(modal.op.id, payload)
                setModal(null)
                cargar()
              }}
              onDelete={
                modal.mode === 'edit'
                  ? async () => {
                      await deleteOportunidad(modal.op.id)
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

// Reexport para claridad de tipos en otros módulos si hiciera falta.
export type { OportunidadConCliente }
