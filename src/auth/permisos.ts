// Punto ÚNICO de capacidades del frontend. Espejo de las funciones SQL
// (la BD es la última barrera; esto es solo la capa de UX).
//
// Reglas:
//  - Cada capacidad es específica por área (evitamos un `canOperate` genérico):
//    así cada área puede evolucionar sin arrastrar a las demás.
//  - `is_active` es obligatorio: una cuenta desactivada no tiene capacidades.
//  - El resto del front consume estas funciones, nunca compara el rol a mano.

export type Role = 'superadmin' | 'direccion' | 'backoffice' | 'comercial'

// Forma mínima que necesitan las capacidades (Profile la cumple estructuralmente).
interface PerfilMin {
  role: string
  is_active: boolean
}

function has(p: PerfilMin | null | undefined, roles: readonly Role[]): boolean {
  return !!p && p.is_active && (roles as readonly string[]).includes(p.role)
}

export const permisos = {
  // Control total (gestión de roles/config crítica).
  isSuperadmin: (p: PerfilMin | null | undefined) => has(p, ['superadmin']),

  // Visibilidad global de negocio (cartera/pipeline/pedidos/informes completos).
  readAll: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'direccion', 'backoffice']),

  // Ver coste y margen. Dirección SÍ ve; comercial NO.
  seeCosts: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'direccion', 'backoffice']),

  // Operar por área (crear/editar). Dirección NO opera; comercial solo lo suyo (vía RLS).
  manageClientes: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),
  managePedidos: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),
  manageFacturacion: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),
  manageInventario: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),
  manageReferencias: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),

  // Crear/gestionar usuarios comerciales.
  manageUsers: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),

  // Módulo Importaciones. Acceso (lectura): super/dirección/backoffice. Comercial NO.
  accessImportaciones: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'direccion', 'backoffice']),
  // Operar Importaciones (crear/editar, confirmar recepciones): super/backoffice. Dirección NO opera.
  manageImportaciones: (p: PerfilMin | null | undefined) => has(p, ['superadmin', 'backoffice']),
  // Configuración crítica del módulo (serie de TC, Gmail/automatización). Solo superadmin.
  manageImportacionesConfig: (p: PerfilMin | null | undefined) => has(p, ['superadmin']),

  // Crear/editar roles no-comerciales y configuración crítica. Solo superadmin.
  managePrivileged: (p: PerfilMin | null | undefined) => has(p, ['superadmin']),

  // Es un comercial (solo su cartera). Útil para forzar reglas del lado comercial.
  isComercial: (p: PerfilMin | null | undefined) => !!p && p.is_active && p.role === 'comercial',
}

// Etiquetas legibles de rol (para tablas y la barra superior).
export const ROL_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  direccion: 'Dirección',
  backoffice: 'Backoffice',
  comercial: 'Comercial',
}

// Roles que se pueden asignar desde la gestión de usuarios.
export const ROLES_ASIGNABLES: Role[] = ['superadmin', 'direccion', 'backoffice', 'comercial']

// Rol privilegiado = no es comercial. Backoffice no puede gestionarlos.
export function esRolPrivilegiado(role: string): boolean {
  return role === 'superadmin' || role === 'direccion' || role === 'backoffice'
}
