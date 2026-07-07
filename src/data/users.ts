import { supabase } from '../lib/supabase'

export interface UsuarioResumen {
  id: string
  full_name: string
  role: string
}

// Lista de usuarios activos (para asignar comercial). Por RLS, un comercial
// solo se ve a sí mismo; el admin ve a todos.
export async function listUsuarios(): Promise<UsuarioResumen[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('is_active', true)
    .order('full_name')
  if (error) throw error
  return data ?? []
}
