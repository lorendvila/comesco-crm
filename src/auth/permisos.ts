// Punto ÚNICO de capacidades del frontend. Espejo de las funciones SQL de la
// Fase 0 (la BD es la última barrera; esto es solo la capa de UX).
//
// Reglas:
//  - Cada capacidad es específica por área (evitamos un `canOperate` genérico):
//    así cada área puede evolucionar sin arrastrar a las demás.
//  - 'admin' (legacy) se incluye en todos los conjuntos = equivalente a
//    superadmin durante la transición, para no introducir regresiones.
//  - `is_active` es obligatorio: una cuenta desactivada no tiene capacidades.
//  - No mira nunca por igualdad a 'admin' fuera de aquí: el resto del front
//    consume estas funciones.

export type Role = 'superadmin' | 'direccion' | 'backoffice' | 'comercial' | 'admin'

// Forma mínima que necesitan las capacidades (Profile la cumple estructuralmente).
interface PerfilMin {
  role: string
  is_active: boolean
}

function has(p: PerfilMin | null | undefined, roles: readonly Role[]): boolean {
  return !!p && p.is_active && (roles as readonly string[]).includes(p.role)
}

export const permisos = {
  // Control total (gestión de roles/config crítica, en fases futuras).
  isSuperadmin: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'admin']),

  // Visibilidad global de negocio (cartera/pipeline/pedidos/informes completos).
  readAll: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'direccion', 'backoffice', 'admin']),

  // Ver coste y margen. Dirección SÍ ve; comercial NO.
  seeCosts: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'direccion', 'backoffice', 'admin']),

  // Operar por área (crear/editar). Dirección NO opera; comercial solo lo suyo (vía RLS).
  manageClientes: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),
  managePedidos: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),
  manageFacturacion: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),
  manageInventario: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),
  manageReferencias: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),

  // Crear/gestionar usuarios comerciales.
  manageUsers: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice', 'admin']),

  // Crear/editar roles no-comerciales y configuración crítica. Solo superadmin.
  managePrivileged: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'admin']),

  // Es un comercial (solo su cartera). Útil para forzar reglas del lado comercial.
  isComercial: (p: PerfilMin | null | undefined) => !!p && p.is_active && p.role === 'comercial',
}

// Etiquetas legibles de rol (para tablas y la barra superior).
export const ROL_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  direccion: 'Dirección',
  backoffice: 'Backoffice',
  comercial: 'Comercial',
  admin: 'Administrador',
}

// Roles que se pueden asignar desde la gestión de usuarios ('admin' es legacy:
// no se crea, solo existe durante la transición).
export const ROLES_ASIGNABLES: Role[] = ['superadmin', 'direccion', 'backoffice', 'comercial']

// Rol privilegiado = no es comercial. Backoffice no puede gestionarlos.
export function esRolPrivilegiado(role: string): boolean {
  return role === 'superadmin' || role === 'direccion' || role === 'backoffice' || role === 'admin'
}
