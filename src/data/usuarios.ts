import { supabase } from '../lib/supabase'

export interface Usuario {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'comercial'
  is_active: boolean
  created_at: string
}

// Lista completa de usuarios (solo el admin la ve por RLS).
export async function listUsuariosAdmin(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .order('is_active', { ascending: false })
    .order('full_name')
    .returns<Usuario[]>()
  if (error) throw error
  return data ?? []
}

// Todas las mutaciones de usuarios pasan por la Edge Function admin-users
// (necesita service_role). El JWT del admin viaja automáticamente en la llamada.
async function invokeAdmin(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error desconocido')
}

export function crearUsuario(p: {
  full_name: string
  email: string
  role: 'admin' | 'comercial'
  password: string
}): Promise<void> {
  return invokeAdmin({ action: 'create', ...p })
}

export function setUsuarioActivo(user_id: string, is_active: boolean): Promise<void> {
  return invokeAdmin({ action: 'set_active', user_id, is_active })
}

export function resetPassword(user_id: string, password: string): Promise<void> {
  return invokeAdmin({ action: 'reset_password', user_id, password })
}

// Cambio de la propia contraseña: no necesita service_role, el usuario ya está
// autenticado y puede actualizar su propia cuenta.
export async function cambiarMiPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

// Contraseña temporal legible (para que el admin la copie y se la pase).
export function generarPassword(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyz'
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const nums = '23456789'
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${pick(mayus, 1)}${pick(letras, 5)}${pick(nums, 3)}`
}
