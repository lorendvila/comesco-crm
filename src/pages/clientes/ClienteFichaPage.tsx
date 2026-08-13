import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getCliente, archivarCliente, restaurarCliente } from '../../data/clientes'
import type { Cliente } from '../../data/clientes'
import { ESTADOS, labelDe, colorEstadoCliente } from '../../data/constants'
import { Badge } from '../../components/Badge'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { DatosTab } from './DatosTab'
import { ContactosTab } from './ContactosTab'
import { CondicionesTab } from './CondicionesTab'
import { ActividadPanel } from '../../components/ActividadPanel'
import { TareasPanel } from '../../components/TareasPanel'

type TabId = 'datos' | 'contactos' | 'condiciones' | 'actividad' | 'tareas'

const TABS: { id: TabId; label: string }[] = [
  { id: 'datos', label: 'Datos' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'condiciones', label: 'Condiciones' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'tareas', label: 'Tareas' },
]

export function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const puedeGestionar = permisos.manageClientes(profile)
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

  const archivado = cliente.deleted_at != null
  const alternarArchivo = async () => {
    const c = cliente
    const msg = archivado
      ? '¿Restaurar este cliente? Volverá a los listados operativos.'
      : '¿Archivar este cliente? Se retira de los listados operativos; su histórico (pedidos, etc.) se conserva.'
    if (!confirm(msg)) return
    try {
      if (archivado) await restaurarCliente(c.id)
      else await archivarCliente(c.id)
      cargar()
    } catch {
      setError('No se pudo cambiar el archivado (¿permisos suficientes?).')
    }
  }

  return (
    <div className="stack stack-6">
      <div>
        <Link to="/clientes" className="t-body-sm">← Clientes</Link>
        <div className="cluster cluster-3" style={{ marginTop: 8, justifyContent: 'space-between' }}>
          <div className="cluster cluster-3">
            <h1 className="t-display">{cliente.nombre}</h1>
            <Badge color={colorEstadoCliente(cliente.estado)}>{labelDe(ESTADOS, cliente.estado)}</Badge>
            {archivado && <span className="badge">Archivado</span>}
          </div>
          {puedeGestionar && (
            <button className="btn btn-sm btn-outline" onClick={alternarArchivo}>
              {archivado ? 'Restaurar' : 'Archivar'}
            </button>
          )}
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
      {tab === 'condiciones' && <CondicionesTab clienteId={cliente.id} />}
      {tab === 'actividad' && <ActividadPanel clienteId={cliente.id} />}
      {tab === 'tareas' && <TareasPanel clienteId={cliente.id} />}
    </div>
  )
}
