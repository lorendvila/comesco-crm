import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return <div className="loading-screen">Cargando…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  // Sesión iniciada pero perfil aún cargando
  if (!profile) {
    return <div className="loading-screen">Cargando…</div>
  }
  // Cuenta desactivada por un administrador: bloquea el acceso.
  if (!profile.is_active) {
    return (
      <div className="loading-screen">
        <div className="stack stack-4" style={{ textAlign: 'center', maxWidth: 360 }}>
          <h1 className="t-heading">Cuenta desactivada</h1>
          <p className="t-body-sm">Tu cuenta ha sido desactivada. Contacta con un administrador.</p>
          <button className="btn btn-primary" onClick={() => signOut()}>Volver al inicio de sesión</button>
        </div>
      </div>
    )
  }
  return <Outlet />
}
