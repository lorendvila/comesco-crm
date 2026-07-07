import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCliente } from '../../data/clientes'
import type { Cliente } from '../../data/clientes'
import { ESTADOS, labelDe } from '../../data/constants'
import { DatosTab } from './DatosTab'
import { ContactosTab } from './ContactosTab'

type TabId = 'datos' | 'contactos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'contactos', label: 'Contactos' },
]

export function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('datos')

  const cargar = () => {
    if (!id) return
    getCliente(id)
      .then(setCliente)
      .catch(() => setError('No se pudo cargar el cliente (o no tienes acceso).'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [id])

  if (loading) return <p className="t-body-sm">Cargando…</p>
  if (error || !cliente) return <p className="login-error">{error ?? 'No encontrado.'}</p>

  return (
    <div className="stack stack-6">
      <div>
        <Link to="/clientes" className="t-body-sm">← Clientes</Link>
        <div className="cluster cluster-3" style={{ marginTop: 8 }}>
          <h1 className="t-display">{cliente.nombre}</h1>
          <span className="badge">{labelDe(ESTADOS, cliente.estado)}</span>
        </div>
        <p className="t-body-sm mono">{cliente.codigo_interno}</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' tab--active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && <DatosTab cliente={cliente} onSaved={cargar} />}
      {tab === 'contactos' && <ContactosTab clienteId={cliente.id} />}
    </div>
  )
}
