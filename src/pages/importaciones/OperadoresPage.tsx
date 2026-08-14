import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { formatFecha } from '../../data/constants'
import {
  listOperadores, createOperador, updateOperador, getOperador,
  listTiposRolOperador, listRolesDeOperador, addRolOperador, removeRolOperador,
  listDocumentosOperador, crearDocumentoOperador, subirArchivo, urlFirmada,
} from '../../data/importaciones'
import type { Operador, TipoRolOperador, DocumentoOperador } from '../../data/importaciones'

export function OperadoresPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const puedeGestionar = permisos.manageImportaciones(profile)
  const [ops, setOps] = useState<Operador[]>([])
  const [sel, setSel] = useState<Operador | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => { listOperadores(true).then(setOps).catch((e) => setError(e.message)) }, [])
  useEffect(cargar, [cargar])

  const crear = async () => {
    if (!nuevoNombre.trim()) return
    try { const id = await createOperador({ nombre: nuevoNombre.trim() }); setNuevoNombre(''); cargar(); setSel(await getOperador(id)) }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="stack stack-4">
      <div className="page-header">
        <div>
          <h1 className="t-display">Operadores</h1>
          <p className="t-body-sm">Proveedores, navieras, aduana, almacenes… (independiente de clientes).</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/importaciones')}>Volver a importaciones</button>
      </div>

      {error && <div className="card"><p className="t-body-sm">{error}</p></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 16 }}>
        <div className="card stack stack-3">
          <h2 className="t-heading">Listado</h2>
          {puedeGestionar && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Nuevo operador…" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
              <button className="btn btn-primary" onClick={crear}>Crear</button>
            </div>
          )}
          <div className="stack" style={{ gap: 4 }}>
            {ops.map((o) => (
              <button key={o.id} className={'btn ' + (sel?.id === o.id ? 'btn-primary' : 'btn-secondary')}
                style={{ justifyContent: 'flex-start' }} onClick={() => setSel(o)}>
                {o.nombre}{!o.activo && ' (inactivo)'}
              </button>
            ))}
            {ops.length === 0 && <p className="t-body-sm">Sin operadores.</p>}
          </div>
        </div>

        <div>{sel ? <OperadorDetalle op={sel} puedeGestionar={puedeGestionar} onChanged={cargar} onError={setError} /> : <div className="card"><p className="t-body-sm">Selecciona un operador.</p></div>}</div>
      </div>
    </div>
  )
}

function OperadorDetalle({ op, puedeGestionar, onChanged, onError }: { op: Operador; puedeGestionar: boolean; onChanged: () => void; onError: (m: string) => void }) {
  const [f, setF] = useState(op)
  const [roles, setRoles] = useState<TipoRolOperador[]>([])
  const [misRoles, setMisRoles] = useState<string[]>([])
  const [docs, setDocs] = useState<DocumentoOperador[]>([])
  const [nuevoTipoDoc, setNuevoTipoDoc] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => { setF(op) }, [op])
  const cargarRoles = useCallback(() => { listRolesDeOperador(op.id).then(setMisRoles).catch(() => {}) }, [op.id])
  const cargarDocs = useCallback(() => { listDocumentosOperador(op.id).then(setDocs).catch(() => {}) }, [op.id])
  useEffect(() => { listTiposRolOperador().then(setRoles).catch(() => {}); cargarRoles(); cargarDocs() }, [cargarRoles, cargarDocs])

  const guardar = async () => {
    try {
      await updateOperador(op.id, { nombre: f.nombre, nit: f.nit, pais: f.pais, email: f.email, telefono: f.telefono, web: f.web, notas: f.notas, activo: f.activo })
      onChanged()
    } catch (e) { onError((e as Error).message) }
  }
  const toggleRol = async (codigo: string) => {
    try { if (misRoles.includes(codigo)) await removeRolOperador(op.id, codigo); else await addRolOperador(op.id, codigo); cargarRoles() }
    catch (e) { onError((e as Error).message) }
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setSubiendo(true)
    try {
      const meta = await subirArchivo(`op/${op.id}`, file)
      await crearDocumentoOperador(op.id, { tipo: nuevoTipoDoc || null, estado: 'recibido', nombre_archivo: meta.nombre, storage_path: meta.path, mime_type: meta.mime, tamano_bytes: meta.size })
      cargarDocs()
    } catch (err) { onError((err as Error).message) } finally { setSubiendo(false) }
  }
  const descargar = async (d: DocumentoOperador) => {
    if (!d.storage_path) return
    try { const url = await urlFirmada(d.storage_path); window.open(url, '_blank') } catch (e) { onError((e as Error).message) }
  }

  const dis = !puedeGestionar
  return (
    <div className="stack stack-4">
      <div className="card stack stack-3">
        <h2 className="t-heading">Datos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <F label="Nombre"><input disabled={dis} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></F>
          <F label="NIT"><input disabled={dis} value={f.nit ?? ''} onChange={(e) => setF({ ...f, nit: e.target.value || null })} /></F>
          <F label="País"><input disabled={dis} value={f.pais ?? ''} onChange={(e) => setF({ ...f, pais: e.target.value || null })} /></F>
          <F label="Email"><input disabled={dis} value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value || null })} /></F>
          <F label="Teléfono"><input disabled={dis} value={f.telefono ?? ''} onChange={(e) => setF({ ...f, telefono: e.target.value || null })} /></F>
          <F label="Web"><input disabled={dis} value={f.web ?? ''} onChange={(e) => setF({ ...f, web: e.target.value || null })} /></F>
        </div>
        {puedeGestionar && (
          <label className="t-body-sm" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} /> Activo
          </label>
        )}
        {puedeGestionar && <button className="btn btn-primary" onClick={guardar}>Guardar</button>}
      </div>

      <div className="card stack stack-3">
        <h2 className="t-heading">Roles</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {roles.map((r) => (
            <button key={r.codigo} disabled={dis} className={'btn ' + (misRoles.includes(r.codigo) ? 'btn-primary' : 'btn-secondary')} onClick={() => toggleRol(r.codigo)}>
              {r.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack stack-3">
        <h2 className="t-heading">Documentación de alta / relación</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Emisión</th><th>Caducidad</th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.tipo ?? '—'}</td>
                  <td>{d.storage_path ? <button className="btn btn-secondary" onClick={() => descargar(d)}>{d.nombre_archivo ?? 'Descargar'}</button> : '—'}</td>
                  <td><span className="badge">{d.estado}</span></td>
                  <td>{formatFecha(d.fecha_emision)}</td>
                  <td>{formatFecha(d.fecha_caducidad)}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={5} className="t-body-sm">Sin documentos de alta.</td></tr>}
            </tbody>
          </table>
        </div>
        {puedeGestionar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Tipo (RUT, cámara…)" value={nuevoTipoDoc} onChange={(e) => setNuevoTipoDoc(e.target.value)} />
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              {subiendo ? 'Subiendo…' : 'Subir documento'}
              <input type="file" hidden onChange={onFile} disabled={subiendo} />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="field"><span className="field__label">{label}</span>{children}</label>)
}
