import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { permisos } from '../auth/permisos'

type NavEntry =
  | { type: 'link'; to: string; label: string; end?: boolean; adminOnly?: boolean }
  | { type: 'group'; label: string; items: { to: string; label: string }[] }

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
  { type: 'link', to: '/informes', label: 'Informes' },
  { type: 'link', to: '/usuarios', label: 'Usuarios', adminOnly: true },
]

const itemClass = ({ isActive }: { isActive: boolean }) =>
  'nav-item' + (isActive ? ' nav-item--active' : '')

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const { profile } = useAuth()
  // `adminOnly` = requiere gestión de usuarios (Usuarios). Superadmin/backoffice.
  const nav = NAV.filter((e) => e.type !== 'link' || !e.adminOnly || permisos.manageUsers(profile))
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
