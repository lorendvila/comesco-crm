import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { createCliente } from '../../data/clientes'
import { listUsuarios } from '../../data/users'
import type { UsuarioResumen } from '../../data/users'
import {
  ClienteForm,
  VALORES_VACIOS,
  valuesToPayload,
} from '../../components/ClienteForm'

export function NuevoClientePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])

  useEffect(() => {
    if (isAdmin) listUsuarios().then(setUsuarios).catch(() => {})
  }, [isAdmin])

  return (
    <div className="stack stack-6" style={{ maxWidth: 720 }}>
      <div>
        <Link to="/clientes" className="t-body-sm">← Clientes</Link>
        <h1 className="t-display">Nuevo cliente</h1>
      </div>
      <ClienteForm
        initial={VALORES_VACIOS}
        isAdmin={isAdmin}
        usuarios={usuarios}
        submitLabel="Crear cliente"
        onCancel={() => navigate('/clientes')}
        onSubmit={async (values) => {
          const payload = valuesToPayload(values)
          // Un comercial solo puede crear clientes asignados a sí mismo (regla RLS).
          if (!isAdmin && profile) payload.comercial_asignado_id = profile.id
          const nuevo = await createCliente(payload)
          navigate(`/clientes/${nuevo.id}`)
        }}
      />
    </div>
  )
}
