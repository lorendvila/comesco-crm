import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { cambiarMiPassword } from '../data/usuarios'

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { session, profile, signOut } = useAuth()
  const name = profile?.full_name ?? session?.user.email ?? ''
  const role = profile?.role
  const [modal, setModal] = useState(false)

  return (
    <header className="topbar">
      <button className="topbar__menu" onClick={onMenu} aria-label="Abrir menú">☰</button>
      <div className="topbar__spacer" />
      <div className="cluster cluster-3">
        <div className="topbar__user">
          <span className="topbar__name">{name}</span>
          {role && <span className="badge">{role}</span>}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setModal(true)}>
          Cambiar contraseña
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => signOut()}>
          Salir
        </button>
      </div>
      {modal && <CambiarPasswordModal onClose={() => setModal(false)} />}
    </header>
  )
}

function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [repite, setRepite] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setErr(null)
    if (password.length < 6) return setErr('La contraseña debe tener al menos 6 caracteres.')
    if (password !== repite) return setErr('Las contraseñas no coinciden.')
    setSaving(true)
    try {
      await cambiarMiPassword(password)
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
        <h2 className="t-heading" style={{ marginBottom: 'var(--sp-4)' }}>Cambiar mi contraseña</h2>
        {ok ? (
          <div className="stack stack-3">
            <p className="t-body-sm">Contraseña actualizada correctamente.</p>
            <div className="cluster cluster-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        ) : (
          <div className="stack stack-3">
            <label className="field">
              <span className="field__label">Nueva contraseña</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span className="field__label">Repetir contraseña</span>
              <input className="input" type="password" value={repite} onChange={(e) => setRepite(e.target.value)} />
            </label>
            {err && <p className="login-error">{err}</p>}
            <div className="cluster cluster-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
              <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
