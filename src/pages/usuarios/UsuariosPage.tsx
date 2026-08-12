import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { permisos, ROL_LABEL, ROLES_ASIGNABLES, esRolPrivilegiado } from '../../auth/permisos'
import type { Role } from '../../auth/permisos'
import {
  listUsuariosAdmin,
  crearUsuario,
  setUsuarioActivo,
  setUsuarioRol,
  resetPassword,
  generarPassword,
} from '../../data/usuarios'
import type { Usuario } from '../../data/usuarios'
import { formatFecha } from '../../data/constants'

type Modal =
  | { mode: 'nuevo' }
  | { mode: 'reset'; user: Usuario }
  | null

export function UsuariosPage() {
  const { profile } = useAuth()
  const esSuper = permisos.managePrivileged(profile) // superadmin: gestiona todos + cambia roles
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const cargar = () => {
    listUsuariosAdmin()
      .then(setUsuarios)
      .catch(() => setError('No se pudieron cargar los usuarios.'))
  }
  useEffect(cargar, [])

  // Gestión de usuarios: superadmin/backoffice (capacidad manageUsers).
  if (profile && !permisos.manageUsers(profile)) return <Navigate to="/" replace />

  const toggleActivo = async (u: Usuario) => {
    setBusy(u.id)
    try {
      await setUsuarioActivo(u.id, !u.is_active)
      cargar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const cambiarRol = async (u: Usuario, role: Role) => {
    if (role === u.role) return
    setBusy(u.id)
    try {
      await setUsuarioRol(u.id, role)
      cargar()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <h1 className="t-display">Usuarios</h1>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'nuevo' })}>Nuevo usuario</button>
      </div>

      {!esSuper && (
        <p className="t-body-sm" style={{ color: 'var(--text-4)' }}>
          Como backoffice puedes crear y gestionar usuarios <strong>comerciales</strong>. La gestión de roles
          y de usuarios privilegiados (dirección, backoffice, superadmin) es exclusiva de superadmin.
        </p>
      )}

      {error && <p className="login-error">{error}</p>}
      {!usuarios && !error && <p className="t-body-sm">Cargando…</p>}

      {usuarios && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Alta</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYo = u.id === profile?.id
                const privilegiado = esRolPrivilegiado(u.role)
                // Backoffice solo gestiona comerciales; superadmin, a todos.
                const puedeGestionar = esSuper || !privilegiado
                return (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                    <td>{u.full_name}{esYo && <span className="badge" style={{ marginLeft: 8 }}>tú</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      {esSuper && !esYo ? (
                        <select
                          className="input input-sm"
                          value={u.role}
                          disabled={busy === u.id}
                          onChange={(e) => cambiarRol(u, e.target.value as Role)}
                        >
                          {ROLES_ASIGNABLES.map((r) => (
                            <option key={r} value={r}>{ROL_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        ROL_LABEL[u.role] ?? u.role
                      )}
                    </td>
                    <td>
                      <span className="pill" style={{ background: u.is_active ? 'var(--color-verde, #A6B187)' : '#7C8794' }}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{formatFecha(u.created_at.slice(0, 10))}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {puedeGestionar ? (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => setModal({ mode: 'reset', user: u })}>
                            Contraseña
                          </button>{' '}
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={esYo || busy === u.id}
                            title={esYo ? 'No puedes desactivar tu propia cuenta' : undefined}
                            onClick={() => toggleActivo(u)}
                          >
                            {u.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </>
                      ) : (
                        <span className="t-caption" style={{ color: 'var(--text-4)' }}>Solo superadmin</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'nuevo' && (
        <NuevoUsuarioModal
          esSuper={esSuper}
          onClose={() => setModal(null)}
          onCreado={() => { setModal(null); cargar() }}
        />
      )}
      {modal?.mode === 'reset' && (
        <ResetPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function NuevoUsuarioModal({ esSuper, onClose, onCreado }: { esSuper: boolean; onClose: () => void; onCreado: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  // Backoffice solo crea comerciales; superadmin, cualquier rol asignable.
  const [role, setRole] = useState<Role>('comercial')
  const [password, setPassword] = useState(generarPassword())
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setErr(null)
    setSaving(true)
    try {
      await crearUsuario({ full_name: fullName.trim(), email: email.trim(), role, password })
      onCreado()
    } catch (e) {
      setErr((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="t-heading" style={{ marginBottom: 'var(--sp-4)' }}>Nuevo usuario</h2>
        <div className="stack stack-3">
          <label className="field">
            <span className="field__label">Nombre completo</span>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Rol</span>
            {esSuper ? (
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES_ASIGNABLES.map((r) => (
                  <option key={r} value={r}>{ROL_LABEL[r]}</option>
                ))}
              </select>
            ) : (
              <>
                <input className="input" value={ROL_LABEL.comercial} disabled />
                <span className="t-caption">Backoffice solo crea usuarios comerciales.</span>
              </>
            )}
          </label>
          <label className="field">
            <span className="field__label">Contraseña temporal</span>
            <div className="cluster cluster-2">
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPassword(generarPassword())}>Generar</button>
            </div>
            <span className="t-caption">Pásasela al usuario; podrá cambiarla desde su sesión.</span>
          </label>
          {err && <p className="login-error">{err}</p>}
          <div className="cluster cluster-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving || !fullName.trim() || !email.trim() || password.length < 6}>
              {saving ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({ user, onClose }: { user: Usuario; onClose: () => void }) {
  const [password, setPassword] = useState(generarPassword())
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setErr(null)
    setSaving(true)
    try {
      await resetPassword(user.id, password)
      setOk(true)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="t-heading" style={{ marginBottom: 'var(--sp-2)' }}>Contraseña de {user.full_name}</h2>
        <p className="t-body-sm" style={{ marginBottom: 'var(--sp-4)' }}>{user.email}</p>
        {ok ? (
          <div className="stack stack-3">
            <p className="t-body-sm">Contraseña actualizada. Nueva contraseña:</p>
            <code className="code-box">{password}</code>
            <div className="cluster cluster-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        ) : (
          <div className="stack stack-3">
            <label className="field">
              <span className="field__label">Nueva contraseña</span>
              <div className="cluster cluster-2">
                <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setPassword(generarPassword())}>Generar</button>
              </div>
            </label>
            {err && <p className="login-error">{err}</p>}
            <div className="cluster cluster-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
              <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving || password.length < 6}>
                {saving ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
