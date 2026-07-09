import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSeguimiento, marcarHecha } from '../../data/seguimiento'
import type { ItemSeguimiento } from '../../data/seguimiento'
import { Badge } from '../../components/Badge'
import { TIPOS_ACTIVIDAD, labelDe, COLOR_AMBAR, COLOR_GOLD, COLOR_AZUL } from '../../data/constants'

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha + 'T00:00:00')
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

function etiqueta(d: number | null): string {
  if (d == null) return 'Sin fecha'
  if (d < 0) return `Atrasada ${-d}d`
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  return `En ${d} días`
}

export function SeguimientoPage() {
  const [items, setItems] = useState<ItemSeguimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    setLoading(true)
    listSeguimiento()
      .then(setItems)
      .catch(() => setError('No se pudo cargar el seguimiento.'))
      .finally(() => setLoading(false))
  }
  useEffect(cargar, [])

  const resumen = useMemo(() => {
    let atrasadas = 0, hoy = 0, semana = 0
    for (const it of items) {
      const d = diasHasta(it.fecha)
      if (d == null) continue
      if (d < 0) atrasadas++
      else if (d === 0) hoy++
      else if (d <= 7) semana++
    }
    return { atrasadas, hoy, semana, total: items.length }
  }, [items])

  const hecha = async (it: ItemSeguimiento) => {
    await marcarHecha(it)
    cargar()
  }

  return (
    <div className="stack stack-6">
      <div>
        <h1 className="t-display">Seguimiento</h1>
        <p className="t-body-sm">Lo que tienes pendiente: acciones programadas y tareas, por fecha. Lo atrasado, arriba.</p>
      </div>

      <div className="grid-auto">
        <div className="card-metric">
          <p className="card-metric__label">Atrasadas</p>
          <p className="card-metric__value" style={{ color: COLOR_AMBAR }}>{resumen.atrasadas}</p>
        </div>
        <div className="card-metric">
          <p className="card-metric__label">Hoy</p>
          <p className="card-metric__value">{resumen.hoy}</p>
        </div>
        <div className="card-metric">
          <p className="card-metric__label">Esta semana</p>
          <p className="card-metric__value">{resumen.semana}</p>
        </div>
        <div className="card-metric">
          <p className="card-metric__label">Total pendientes</p>
          <p className="card-metric__value">{resumen.total}</p>
        </div>
      </div>

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table data-table--plain">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Acción</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const d = diasHasta(it.fecha)
                const atrasada = d != null && d < 0
                return (
                  <tr key={it.key}>
                    <td>
                      <Link to={`/clientes/${it.clienteId}`} className="link-cliente">{it.cliente}</Link>
                    </td>
                    <td>
                      <Badge color={it.origen === 'tarea' ? COLOR_AZUL : COLOR_GOLD}>
                        {it.origen === 'tarea' ? 'Tarea' : labelDe(TIPOS_ACTIVIDAD, it.tipo ?? '')}
                      </Badge>{' '}
                      {it.accion || '—'}
                    </td>
                    <td style={{ color: atrasada ? COLOR_AMBAR : undefined, fontWeight: atrasada ? 500 : undefined }}>
                      {etiqueta(d)}
                    </td>
                    <td><button className="btn btn-sm btn-outline" onClick={() => hecha(it)}>Hecha</button></td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="t-body-sm">Nada pendiente. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
