import { createClient } from 'jsr:@supabase/supabase-js@2'

// Edge Function admin-users: alta, activar/desactivar, reset de contraseña y
// cambio de rol. La BARRERA REAL es esta validación de servidor + la RLS de
// public.users (0025): la service key NO salta RLS en PostgREST, así que las
// tablas se tocan con el cliente del que llama (rol authenticated + RLS) y la
// service key se usa solo para GoTrue (auth). Aquí se valida además lo que la
// RLS no cubre (GoTrue) y las reglas de escalada.
//
// Modelo de permisos:
//  - superadmin (y 'admin' legacy): gestiona usuarios de CUALQUIER rol, cambia
//    roles, activa/desactiva y resetea a cualquiera.
//  - backoffice: SOLO comerciales (crear/activar/desactivar/reset). No puede
//    crear ni tocar dirección/backoffice/superadmin, ni elevar roles, ni a sí
//    mismo. No puede cambiar roles.
//  - dirección / comercial: no gestionan usuarios.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

const ROLES_ASIGNABLES = ['superadmin', 'direccion', 'backoffice', 'comercial']
const esSuper = (r: string) => r === 'superadmin' || r === 'admin'
const esPrivilegiado = (r: string) => r === 'superadmin' || r === 'direccion' || r === 'backoffice' || r === 'admin'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    // Cliente con el JWT del que llama (PostgREST: rol authenticated + RLS)
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    // Cliente con service key (solo para GoTrue admin)
    const gotrue = createClient(url, service)

    const { data: { user }, error: uErr } = await asUser.auth.getUser(jwt)
    if (uErr || !user) return json({ ok: false, error: 'No autenticado' })

    const { data: me } = await asUser
      .from('users').select('id, auth_user_id, role, is_active').eq('auth_user_id', user.id).maybeSingle()
    // Solo gestionan usuarios superadmin/admin y backoffice.
    if (!me || !me.is_active || !(esSuper(me.role) || me.role === 'backoffice')) {
      return json({ ok: false, error: 'No autorizado para gestionar usuarios' })
    }
    const callerSuper = esSuper(me.role)

    const body = await req.json()
    const action = body?.action

    // Carga la fila objetivo (public.users.id) para decidir según su rol actual.
    const loadTarget = async (user_id: string) => {
      const { data } = await asUser.from('users').select('id, auth_user_id, role, is_active').eq('id', user_id).maybeSingle()
      return data
    }
    // ¿Quedan otros superadmin/admin activos aparte de exceptId?
    const hayOtroSuperActivo = async (exceptId: string) => {
      const { data } = await asUser.from('users')
        .select('id').in('role', ['superadmin', 'admin']).eq('is_active', true).neq('id', exceptId)
      return (data?.length ?? 0) > 0
    }

    if (action === 'create') {
      const full_name = String(body.full_name ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      const role = body.role
      const password = String(body.password ?? '')
      if (!full_name || !email || password.length < 6 || !ROLES_ASIGNABLES.includes(role)) {
        return json({ ok: false, error: 'Datos incompletos o contraseña menor de 6 caracteres' })
      }
      // Escalada: backoffice solo crea comerciales.
      if (!callerSuper && role !== 'comercial') {
        return json({ ok: false, error: 'Backoffice solo puede crear usuarios comerciales' })
      }
      const { data: created, error: cErr } = await gotrue.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (cErr || !created?.user) return json({ ok: false, error: cErr?.message ?? 'No se pudo crear la cuenta' })
      // El insert pasa por RLS (0025): backstop si la validación de arriba fallara.
      const { error: iErr } = await asUser.from('users').insert({
        auth_user_id: created.user.id, full_name, email, role, is_active: true,
      })
      if (iErr) {
        await gotrue.auth.admin.deleteUser(created.user.id) // rollback de la cuenta
        return json({ ok: false, error: iErr.message })
      }
      return json({ ok: true })
    }

    if (action === 'set_active') {
      const target = await loadTarget(body.user_id)
      const is_active = Boolean(body.is_active)
      if (!target) return json({ ok: false, error: 'Usuario no encontrado' })
      if (!is_active && target.auth_user_id === me.auth_user_id) {
        return json({ ok: false, error: 'No puedes desactivar tu propia cuenta' })
      }
      if (!callerSuper && esPrivilegiado(target.role)) {
        return json({ ok: false, error: 'Backoffice solo puede gestionar usuarios comerciales' })
      }
      // No dejar el sistema sin superadmin activo.
      if (!is_active && esSuper(target.role) && !(await hayOtroSuperActivo(target.id))) {
        return json({ ok: false, error: 'No puedes desactivar al último superadmin activo' })
      }
      const { error } = await asUser.from('users').update({ is_active }).eq('id', body.user_id)
      if (error) return json({ ok: false, error: error.message })
      return json({ ok: true })
    }

    if (action === 'reset_password') {
      const password = String(body.password ?? '')
      if (password.length < 6) return json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' })
      const target = await loadTarget(body.user_id)
      if (!target) return json({ ok: false, error: 'Usuario no encontrado' })
      // GoTrue no pasa por RLS: la restricción de backoffice se valida AQUÍ.
      if (!callerSuper && esPrivilegiado(target.role)) {
        return json({ ok: false, error: 'Backoffice solo puede gestionar usuarios comerciales' })
      }
      const { error } = await gotrue.auth.admin.updateUserById(target.auth_user_id, { password })
      if (error) return json({ ok: false, error: error.message })
      return json({ ok: true })
    }

    if (action === 'set_role') {
      // Solo superadmin puede asignar/cambiar roles.
      if (!callerSuper) return json({ ok: false, error: 'Solo un superadmin puede cambiar roles' })
      const target = await loadTarget(body.user_id)
      const newRole = body.role
      if (!target) return json({ ok: false, error: 'Usuario no encontrado' })
      if (!ROLES_ASIGNABLES.includes(newRole)) return json({ ok: false, error: 'Rol no válido' })
      // No dejar el sistema sin superadmin activo al degradar al último.
      if (esSuper(target.role) && !esSuper(newRole) && !(await hayOtroSuperActivo(target.id))) {
        return json({ ok: false, error: 'No puedes quitar el rol al último superadmin activo' })
      }
      const { error } = await asUser.from('users').update({ role: newRole }).eq('id', body.user_id)
      if (error) return json({ ok: false, error: error.message })
      return json({ ok: true })
    }

    return json({ ok: false, error: 'Acción no reconocida' })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) })
  }
})
