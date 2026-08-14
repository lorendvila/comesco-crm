import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { permisos } from '../auth/permisos'

// `cap` = capacidad requerida para ver la entrada (clave de `permisos`). Si no
// se indica, la entrada es visible para cualquier usuario con sesión.
type Cap = keyof typeof permisos
type NavEntry =
  | { type: 'link'; to: string; label: string; end?: boolean; adminOnly?: boolean; cap?: Cap }
  | { type: 'group'; label: string; cap?: Cap; items: { to: string; label: string }[] }

// Barra lateral = destinos. Agrupados en Comercial (seguimiento) y Operaciones.
// Los detalles de un cliente (condiciones, contactos...) viven en su ficha.
const NAV: NavEntry[] = [
  { type: 'link', to: '/', label: 'Dashboard', end: true },
  {
    type: 'group',
    label: 'Comercial',
    items: [
      { to: '/pipeline', label: 'Pipeline' },
      { to: '/seguimiento', label: 'Seguimiento' },
    ],
  },
  {
    type: 'group',
    label: 'Operaciones',
    items: [
      { to: '/clientes', label: 'Clientes' },
      { to: '/pedidos', label: 'Pedidos' },
      { to: '/inventario', label: 'Inventario' },
    ],
  },
  {
    type: 'group',
    label: 'Importaciones',
    cap: 'accessImportaciones', // super/dirección/backoffice; comercial no lo ve
    items: [
      { to: '/importaciones', label: 'Importaciones' },
      { to: '/importaciones/operadores', label: 'Operadores' },
    ],
  },
  { type: 'link', to: '/informes', label: 'Informes' },
  { type: 'link', to: '/usuarios', label: 'Usuarios', adminOnly: true },
]

const itemClass = ({ isActive }: { isActive: boolean }) =>
  'nav-item' + (isActive ? ' nav-item--active' : '')

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const { profile } = useAuth()
  // `adminOnly` = requiere gestión de usuarios (Usuarios). Superadmin/backoffice.
  // `cap` = capacidad requerida (p.ej. accessImportaciones); si no la cumple, se oculta.
  const nav = NAV.filter((e) => {
    if (e.type === 'link' && e.adminOnly && !permisos.manageUsers(profile)) return false
    if (e.cap && !permisos[e.cap](profile)) return false
    return true
  })
  return (
    <aside className={'sidebar' + (open ? ' sidebar--open' : '')}>
      <div className="sidebar__brand">
        <div className="ld-firma"></div>
        <span className="sidebar__brand-name">COMESCO</span>
      </div>
      <nav className="sidebar__nav">
        {nav.map((entry) =>
          entry.type === 'link' ? (
            <NavLink key={entry.to} to={entry.to} end={entry.end} className={itemClass} onClick={onNavigate}>
              {entry.label}
            </NavLink>
          ) : (
            <div key={entry.label} className="nav-group">
              <span className="nav-group__label">{entry.label}</span>
              <div className="nav-group__items">
                {entry.items.map((it) => (
                  <NavLink key={it.to} to={it.to} className={itemClass} onClick={onNavigate}>
                    {it.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ),
        )}
      </nav>
    </aside>
  )
}
