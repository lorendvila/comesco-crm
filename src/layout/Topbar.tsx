import { useAuth } from '../auth/AuthProvider'

export function Topbar() {
  const { session, profile, signOut } = useAuth()
  const name = profile?.full_name ?? session?.user.email ?? ''
  const role = profile?.role

  return (
    <header className="topbar">
      <div className="topbar__spacer" />
      <div className="cluster cluster-3">
        <div className="topbar__user">
          <span className="topbar__name">{name}</span>
          {role && <span className="badge">{role}</span>}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => signOut()}>
          Salir
        </button>
      </div>
    </header>
  )
}
