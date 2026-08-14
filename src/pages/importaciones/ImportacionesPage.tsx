import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { formatFecha } from '../../data/constants'
import {
  listImportaciones,
  createImportacion,
  ESTADO_LOG_LABEL,
  ESTADO_COSTE_LABEL,
} from '../../data/importaciones'
import type { ImportacionListItem } from '../../data/importaciones'

export function ImportacionesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const puedeGestionar = permisos.manageImportaciones(profile)
  const [filas, setFilas] = useState<ImportacionListItem[]>([])
  const [verArchivadas, setVerArchivadas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const cargar = () => {
    setCargando(true)
    listImportaciones(verArchivadas)
      .then(setFilas)
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [verArchivadas])

  const nueva = async () => {
    setCreando(true)
    try {
      const id = await createImportacion({ moneda: 'EUR' })
      navigate(`/importaciones/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setCreando(false)
    }
  }

  return (
    <div className="stack stack-4">
      <div className="page-header">
        <div>
          <h1 className="t-display">Importaciones</h1>
          <p className="t-body-sm">
            Coste real puesto en almacén por importación. <Link to="/importaciones/operadores">Operadores</Link>
          </p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={nueva} disabled={creando}>
            {creando ? 'Creando…' : 'Nueva importación'}
          </button>
        )}
      </div>

      <div className="card stack stack-3">
        <label className="t-body-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} />
          Mostrar archivadas
        </label>

        {cargando && <p className="t-body-sm">Cargando…</p>}
        {error && <p className="t-body-sm">No se pudo cargar: {error}</p>}
        {!cargando && !error && filas.length === 0 && <p className="t-body-sm">Aún no hay importaciones.</p>}

        {!cargando && !error && filas.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Coste</th>
                  <th>Origen → Destino</th>
                  <th>ETA prev.</th>
                  <th>Almacén</th>
                  <th>Líneas</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/importaciones/${f.id}`)}>
                    <td>
                      {f.codigo ?? '—'}
                      {f.deleted_at && <span className="badge" style={{ marginLeft: 8 }}>Archivada</span>}
                    </td>
                    <td><span className="badge">{ESTADO_LOG_LABEL[f.estado_logistico] ?? f.estado_logistico}</span></td>
                    <td><span className="badge">{ESTADO_COSTE_LABEL[f.estado_coste] ?? f.estado_coste}</span></td>
                    <td>{[f.origen, f.destino].filter(Boolean).join(' → ') || '—'}</td>
                    <td>{formatFecha(f.eta_prevista)}</td>
                    <td>{f.almacen_nombre ?? '—'}</td>
                    <td>{f.n_lineas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
