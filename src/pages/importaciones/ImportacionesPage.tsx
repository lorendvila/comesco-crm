import { useEffect, useState } from 'react'
import { listTiposCoste } from '../../data/importaciones'
import type { TipoCoste } from '../../data/importaciones'

// Página ESQUELETO de la Fase I-0. El módulo operativo (importaciones, líneas,
// costes, recepciones...) se construye en fases posteriores. De momento sirve
// para (a) marcar el destino en la barra lateral y (b) verificar que los
// catálogos ya sembrados se leen correctamente según el rol (comercial no
// llega aquí: la ruta lo redirige y la RLS le devolvería 0 filas).

export function ImportacionesPage() {
  const [tipos, setTipos] = useState<TipoCoste[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    listTiposCoste()
      .then(setTipos)
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div className="stack stack-4">
      <div className="page-header">
        <div>
          <h1 className="t-display">Importaciones</h1>
          <p className="t-body-sm">
            Módulo en construcción (Fase I-0: fundaciones). Catálogo de conceptos de coste ya disponible.
          </p>
        </div>
      </div>

      <div className="card stack stack-3">
        <h2 className="t-heading">Conceptos de coste</h2>
        {cargando && <p className="t-body-sm">Cargando…</p>}
        {error && <p className="t-body-sm">No se pudo cargar: {error}</p>}
        {!cargando && !error && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Naturaleza</th>
                  <th>Capitalizable</th>
                  <th>Reparto por defecto</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.codigo}>
                    <td>{t.nombre}</td>
                    <td>{t.naturaleza}</td>
                    <td>
                      {t.capitalizable ? (
                        <span className="badge">Landed cost</span>
                      ) : (
                        <span className="badge">No capitalizable</span>
                      )}
                    </td>
                    <td>{t.criterio_reparto_default}</td>
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
