import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { permisos } from './permisos'

// Guard de ruta por capacidad. Defensa en profundidad: la RLS ya devuelve 0
// filas a quien no tiene acceso, pero además impedimos que la página se
// renderice (p.ej. un comercial en /importaciones -> redirigido al inicio).
type Cap = keyof typeof permisos

export function RequireCap({ cap, children }: { cap: Cap; children: ReactNode }) {
  const { profile } = useAuth()
  const allowed = permisos[cap](profile)
  if (!allowed) return <Navigate to="/" replace />
  return <>{children}</>
}
