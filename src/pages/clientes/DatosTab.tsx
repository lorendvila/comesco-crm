import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { updateCliente } from '../../data/clientes'
import type { Cliente } from '../../data/clientes'
import { listUsuarios } from '../../data/users'
import type { UsuarioResumen } from '../../data/users'
import { CANALES, labelDe } from '../../data/constants'
import {
  ClienteForm,
  clienteToValues,
  valuesToPayload,
} from '../../components/ClienteForm'

interface Props {
  cliente: Cliente
  onSaved: () => void
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="dato">
      <span className="field__label">{label}</span>
      <span className="t-body">{value && value.trim() ? value : '—'}</span>
    </div>
  )
}

export function DatosTab({ cliente, onSaved }: Props) {
  const { profile } = useAuth()
  const puedeGestionar = permisos.manageClientes(profile)
  const [editando, setEditando] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([])

  useEffect(() => {
    if (puedeGestionar) listUsuarios().then(setUsuarios).catch(() => {})
  }, [puedeGestionar])

  const comercial = usuarios.find((u) => u.id === cliente.comercial_asignado_id)

  if (editando) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <ClienteForm
          initial={clienteToValues(cliente)}
          puedeAsignarComercial={puedeGestionar}
          usuarios={usuarios}
          submitLabel="Guardar cambios"
          onCancel={() => setEditando(false)}
          onSubmit={async (values) => {
            await updateCliente(cliente.id, valuesToPayload(values))
            setEditando(false)
            onSaved()
          }}
        />
      </div>
    )
  }

  return (
    <div className="stack stack-4" style={{ maxWidth: 720 }}>
      <Dato label="Razón social" value={cliente.razon_social} />
      <Dato label="NIT" value={cliente.nit} />
      <Dato label="Email de facturación electrónica" value={cliente.email_facturacion} />
      <div className="grid-2">
        <Dato label="Canal" value={labelDe(CANALES, cliente.canal)} />
        <Dato label="Ciudad" value={cliente.ciudad} />
        <Dato label="País" value={cliente.pais} />
        <Dato
          label="Comercial asignado"
          value={
            cliente.comercial_asignado_id
              ? comercial?.full_name ?? 'Asignado'
              : 'Sin asignar'
          }
        />
      </div>
      <Dato label="Dirección de entrega" value={cliente.direccion_entrega} />
      <Dato label="Notas" value={cliente.notas} />
      <div>
        <button className="btn btn-outline" onClick={() => setEditando(true)}>
          Editar datos
        </button>
      </div>
    </div>
  )
}
