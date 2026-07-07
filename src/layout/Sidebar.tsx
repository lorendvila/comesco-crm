import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/clientes', label: 'Clientes' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/actividad', label: 'Actividad' },
  { to: '/tareas', label: 'Tareas' },
  { to: '/comunicaciones', label: 'Comunicaciones' },
  { to: '/demanda', label: 'Demanda' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/condiciones', label: 'Condiciones' },
  { to: '/informes', label: 'Informes' },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="ld-firma"></div>
        <span className="sidebar__brand-name">COMESCO</span>
      </div>
      <nav className="sidebar__nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item--active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
