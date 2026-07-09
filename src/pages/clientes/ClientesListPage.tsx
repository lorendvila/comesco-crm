import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listClientes } from '../../data/clientes'
import type { ClienteResumen } from '../../data/clientes'
import { CANALES, ESTADOS, labelDe, colorEstadoCliente } from '../../data/constants'
import { Badge } from '../../components/Badge'

export function ClientesListPage() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<ClienteResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    listClientes()
      .then(setClientes)
      .catch(() => setError('No se pudieron cargar los clientes.'))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return clientes
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(t) ||
        c.codigo_interno.toLowerCase().includes(t) ||
        (c.ciudad ?? '').toLowerCase().includes(t),
    )
  }, [clientes, q])

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <div>
          <h1 className="t-display">Clientes</h1>
          <p className="t-body-sm">{clientes.length} en total</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/clientes/nuevo')}>
          Nuevo cliente
        </button>
      </div>

      <input
        className="input"
        placeholder="Buscar por nombre, código o ciudad…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: 360 }}
      />

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Ciudad</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td className="mono">{c.codigo_interno}</td>
                  <td>{c.nombre}</td>
                  <td>{labelDe(CANALES, c.canal)}</td>
                  <td><Badge color={colorEstadoCliente(c.estado)}>{labelDe(ESTADOS, c.estado)}</Badge></td>
                  <td>{c.ciudad ?? '—'}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="t-body-sm">Sin resultados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
