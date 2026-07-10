import { createClient } from 'jsr:@supabase/supabase-js@2'

// Edge Function admin-users: crea usuarios, activa/desactiva y resetea
// contraseñas. Reparto de responsabilidades:
//  - Lecturas/escrituras en public.users -> con el JWT del admin que llama
//    (su rol 'authenticated' tiene grants y pasa la RLS users_admin_all).
//  - Alta de cuenta y cambio de contraseña en Auth -> con la service key
//    (operaciones de GoTrue admin). Nota: en este proyecto la service key
//    inyectada no resuelve a service_role en PostgREST, por eso las tablas se
//    tocan con el cliente del admin y la service key se usa solo para GoTrue.
//
// Siempre verifica que quien llama es un admin activo antes de actuar.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')

    // Cliente con el JWT del admin (para PostgREST: rol authenticated + RLS)
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    // Cliente con service key (solo para GoTrue admin)
    const gotrue = createClient(url, service)

    const { data: { user }, error: uErr } = await asUser.auth.getUser(jwt)
    if (uErr || !user) return json({ ok: false, error: 'No autenticado' })

    const { data: me } = await asUser
      .from('users').select('id, role, is_active').eq('auth_user_id', user.id).maybeSingle()
    if (!me || me.role !== 'admin' || !me.is_active) {
      return json({ ok: false, error: 'Solo un administrador puede gestionar usuarios' })
    }

    const body = await req.json()
    const action = body?.action

    if (action === 'create') {
      const full_name = String(body.full_name ?? '').trim()
      const email = String(body.email ?? '').trim().toLowerCase()
      const role = body.role
      const password = String(body.password ?? '')
      if (!full_name || !email || password.length < 6 || !['admin', 'comercial'].includes(role)) {
        return json({ ok: false, error: 'Datos incompletos o contraseña menor de 6 caracteres' })
      }
      const { data: created, error: cErr } = await gotrue.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (cErr || !created?.user) return json({ ok: false, error: cErr?.message ?? 'No se pudo crear la cuenta' })
      const { error: iErr } = await asUser.from('users').insert({
        auth_user_id: created.user.id, full_name, email, role, is_active: true,
      })
      if (iErr) {
        // Rollback: si falla la fila de perfil, borra la cuenta de auth recién creada
        await gotrue.auth.admin.deleteUser(created.user.id)
        return json({ ok: false, error: iErr.message })
      }
      return json({ ok: true })
    }

    if (action === 'set_active') {
      const user_id = body.user_id // public.users.id
      const is_active = Boolean(body.is_active)
      const { data: target } = await asUser.from('users').select('auth_user_id').eq('id', user_id).maybeSingle()
      if (!target) return json({ ok: false, error: 'Usuario no encontrado' })
      if (!is_active && target.auth_user_id === user.id) {
        return json({ ok: false, error: 'No puedes desactivar tu propia cuenta' })
      }
      const { error } = await asUser.from('users').update({ is_active }).eq('id', user_id)
      if (error) return json({ ok: false, error: error.message })
      return json({ ok: true })
    }

    if (action === 'reset_password') {
      const user_id = body.user_id
      const password = String(body.password ?? '')
      if (password.length < 6) return json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' })
      const { data: target } = await asUser.from('users').select('auth_user_id').eq('id', user_id).maybeSingle()
      if (!target) return json({ ok: false, error: 'Usuario no encontrado' })
      const { error } = await gotrue.auth.admin.updateUserById(target.auth_user_id, { password })
      if (error) return json({ ok: false, error: error.message })
      return json({ ok: true })
    }

    return json({ ok: false, error: 'Acción no reconocida' })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) })
  }
})
