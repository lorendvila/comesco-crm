import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { formatFecha, formatFechaHora } from '../../data/constants'
import { listReferencias } from '../../data/referencias'
import type { ReferenciaResumen } from '../../data/referencias'
import { listAlmacenes } from '../../data/almacenes'
import type { Almacen } from '../../data/almacenes'
import {
  getImportacion, updateImportacion, cambiarEstadoLogistico, archivarImportacion, restaurarImportacion,
  listLineas, addLinea, deleteLinea,
  listImportacionOperadores, addImportacionOperador, removeImportacionOperador,
  listDocumentos, crearDocumento, subirArchivo, urlFirmada, actualizarDocumento, borrarDocumento, archivarDocumento,
  listOperadores, listTiposRolOperador, listTiposDocumento,
  INCOTERMS, MODALIDADES, ESTADO_LOG_LABEL, ESTADO_COSTE_LABEL, ESTADOS_DOC, transicionesLogisticas,
} from '../../data/importaciones'
import type {
  Importacion, ImportacionLinea, ImportacionOperador, DocumentoImportacion, Operador, TipoRolOperador, TipoDocumento,
} from '../../data/importaciones'
import { TabCostes, TabAnticipos, ResumenIndicadoresI2 } from './TabsI2'

const TABS = ['Resumen', 'Mercancía', 'Costes', 'Operadores', 'Logística', 'Documentación', 'Anticipos'] as const
const TABS_PENDIENTES = ['Incidencias', 'Recepciones'] as const
type Tab = (typeof TABS)[number]

const num = (s: string): number | null => {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function ImportacionFichaPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const puedeGestionar = permisos.manageImportaciones(profile)

  const [imp, setImp] = useState<Importacion | null>(null)
  const [tab, setTab] = useState<Tab>('Resumen')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    getImportacion(id)
      .then((i) => setImp(i))
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setCargando(false))
  }, [id])
  useEffect(recargar, [recargar])

  if (cargando) return <p className="t-body-sm">Cargando…</p>
  if (error) return <p className="t-body-sm">Error: {error}</p>
  if (!imp) return <p className="t-body-sm">Importación no encontrada.</p>

  const editable = puedeGestionar && ['borrador', 'confirmada'].includes(imp.estado_logistico)
  const transiciones = transicionesLogisticas(imp.estado_logistico)

  const mover = async (estado: string) => {
    setError(null)
    try { await cambiarEstadoLogistico(imp.id, estado); recargar() } catch (e) { setError((e as Error).message) }
  }
  const archivar = async () => {
    setError(null)
    try {
      if (imp.deleted_at) await restaurarImportacion(imp.id)
      else await archivarImportacion(imp.id)
      recargar()
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="stack stack-4">
      <div className="page-header">
        <div>
          <h1 className="t-display">{imp.codigo ?? 'Importación'}</h1>
          <p className="t-body-sm">
            <span className="badge">{ESTADO_LOG_LABEL[imp.estado_logistico]}</span>{' '}
            <span className="badge">Coste: {ESTADO_COSTE_LABEL[imp.estado_coste]}</span>
            {imp.deleted_at && <span className="badge" style={{ marginLeft: 6 }}>Archivada</span>}
          </p>
        </div>
        <div className="stack" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {puedeGestionar && transiciones.map((t) => (
            <button key={t} className="btn btn-secondary" onClick={() => mover(t)}>
              {t === 'anulada' ? 'Anular' : `→ ${ESTADO_LOG_LABEL[t]}`}
            </button>
          ))}
          {puedeGestionar && (
            <button className="btn btn-secondary" onClick={archivar}>{imp.deleted_at ? 'Restaurar' : 'Archivar'}</button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/importaciones')}>Volver</button>
        </div>
      </div>

      {error && <div className="card"><p className="t-body-sm">{error}</p></div>}

      <div className="stack" style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={'btn ' + (tab === t ? 'btn-primary' : 'btn-secondary')} onClick={() => setTab(t)}>{t}</button>
        ))}
        {TABS_PENDIENTES.map((t) => (
          <button key={t} className="btn btn-secondary" disabled title="Disponible en la fase siguiente" style={{ opacity: 0.5 }}>{t}</button>
        ))}
      </div>

      {tab === 'Resumen' && <TabResumen imp={imp} />}
      {tab === 'Mercancía' && <TabMercancia impId={imp.id} editable={editable} onError={setError} />}
      {tab === 'Costes' && <TabCostes imp={imp} puedeGestionar={puedeGestionar} onError={setError} />}
      {tab === 'Operadores' && <TabOperadores impId={imp.id} puedeGestionar={puedeGestionar} onError={setError} />}
      {tab === 'Logística' && <TabLogistica imp={imp} puedeGestionar={puedeGestionar} onSaved={recargar} onError={setError} />}
      {tab === 'Documentación' && <TabDocumentos impId={imp.id} puedeGestionar={puedeGestionar} onError={setError} />}
      {tab === 'Anticipos' && <TabAnticipos impId={imp.id} puedeGestionar={puedeGestionar} onError={setError} />}
    </div>
  )
}

// ---------------- Resumen ----------------
function TabResumen({ imp }: { imp: Importacion }) {
  const filas: [string, string][] = [
    ['Origen', imp.origen ?? '—'], ['Destino', imp.destino ?? '—'],
    ['Incoterm', imp.incoterm ?? '—'], ['Transporte', imp.modalidad_transporte ?? '—'],
    ['ETD prevista', formatFecha(imp.etd_prevista)], ['ETA prevista', formatFecha(imp.eta_prevista)],
    ['ETD real', formatFecha(imp.etd_real)], ['ETA real', formatFecha(imp.eta_real)],
    ['Moneda', imp.moneda], ['TC presupuestado', imp.tc_presupuestado != null ? String(imp.tc_presupuestado) : '—'],
    ['Booking', imp.booking ?? '—'], ['BL', imp.bl ?? '—'], ['Contenedor', imp.contenedor ?? '—'],
  ]
  return (
    <div className="stack stack-4">
      <div className="card stack stack-3">
        <h2 className="t-heading">Resumen</h2>
        <div className="table-wrap">
          <table className="data-table">
            <tbody>{filas.map(([k, v]) => (<tr key={k}><th style={{ width: 200 }}>{k}</th><td>{v}</td></tr>))}</tbody>
          </table>
        </div>
        {imp.observaciones && <p className="t-body-sm">{imp.observaciones}</p>}
      </div>
      <ResumenIndicadoresI2 impId={imp.id} />
    </div>
  )
}

// ---------------- Mercancía ----------------
function TabMercancia({ impId, editable, onError }: { impId: string; editable: boolean; onError: (m: string) => void }) {
  const [lineas, setLineas] = useState<ImportacionLinea[]>([])
  const [refs, setRefs] = useState<ReferenciaResumen[]>([])
  const [ops, setOps] = useState<Operador[]>([])
  const [nueva, setNueva] = useState({ referencia_id: '', proveedor: '', cantidad: '', cajas: '', pallets: '', precio: '', moneda: 'EUR' })

  const cargar = useCallback(() => { listLineas(impId).then(setLineas).catch((e) => onError(e.message)) }, [impId, onError])
  useEffect(() => {
    cargar()
    listReferencias().then((r) => setRefs(r.filter((x) => !x.es_servicio))).catch(() => {})
    listOperadores().then(setOps).catch(() => {})
  }, [cargar])

  const agregar = async () => {
    onError('')
    const cant = num(nueva.cantidad); const precio = num(nueva.precio)
    if (!nueva.referencia_id || cant == null || precio == null) { onError('Referencia, cantidad y precio son obligatorios.'); return }
    try {
      await addLinea(impId, {
        referencia_id: nueva.referencia_id,
        operador_proveedor_id: nueva.proveedor || null,
        cantidad_unidades: cant, cajas: num(nueva.cajas), pallets: num(nueva.pallets),
        precio_compra: precio, moneda: nueva.moneda,
      })
      setNueva({ referencia_id: '', proveedor: '', cantidad: '', cajas: '', pallets: '', precio: '', moneda: 'EUR' })
      cargar()
    } catch (e) { onError((e as Error).message) }
  }
  const quitar = async (lid: string) => { try { await deleteLinea(lid); cargar() } catch (e) { onError((e as Error).message) } }

  return (
    <div className="card stack stack-3">
      <h2 className="t-heading">Mercancía por referencia</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Referencia</th><th>Proveedor</th><th>Uds.</th><th>Cajas</th><th>Pallets</th><th>Precio</th><th>Importe</th><th></th></tr></thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.id}>
                <td>{l.referencia_nombre ?? l.referencia_id}{l.referencia_sku ? ` (${l.referencia_sku})` : ''}</td>
                <td>{l.proveedor_nombre ?? '—'}</td>
                <td>{l.cantidad_unidades}</td>
                <td>{l.cajas ?? '—'}</td>
                <td>{l.pallets ?? '—'}</td>
                <td>{l.precio_compra} {l.moneda}</td>
                <td>{l.importe_mercancia} {l.moneda}</td>
                <td>{editable && <button className="btn btn-secondary" onClick={() => quitar(l.id)}>Quitar</button>}</td>
              </tr>
            ))}
            {lineas.length === 0 && <tr><td colSpan={8} className="t-body-sm">Sin mercancía todavía.</td></tr>}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="stack stack-2">
          <h3 className="t-body-sm">Añadir línea</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={nueva.referencia_id} onChange={(e) => setNueva({ ...nueva, referencia_id: e.target.value })}>
              <option value="">— Referencia —</option>
              {refs.map((r) => (<option key={r.id} value={r.id}>{r.nombre_producto} · {r.formato}</option>))}
            </select>
            <select value={nueva.proveedor} onChange={(e) => setNueva({ ...nueva, proveedor: e.target.value })}>
              <option value="">— Proveedor —</option>
              {ops.map((o) => (<option key={o.id} value={o.id}>{o.nombre}</option>))}
            </select>
            <input placeholder="Uds." style={{ width: 80 }} value={nueva.cantidad} onChange={(e) => setNueva({ ...nueva, cantidad: e.target.value })} />
            <input placeholder="Cajas" style={{ width: 70 }} value={nueva.cajas} onChange={(e) => setNueva({ ...nueva, cajas: e.target.value })} />
            <input placeholder="Pallets" style={{ width: 70 }} value={nueva.pallets} onChange={(e) => setNueva({ ...nueva, pallets: e.target.value })} />
            <input placeholder="Precio ud." style={{ width: 90 }} value={nueva.precio} onChange={(e) => setNueva({ ...nueva, precio: e.target.value })} />
            <input placeholder="Moneda" style={{ width: 70 }} value={nueva.moneda} onChange={(e) => setNueva({ ...nueva, moneda: e.target.value })} />
            <button className="btn btn-primary" onClick={agregar}>Añadir</button>
          </div>
          <p className="t-body-sm">El importe se calcula automáticamente (cantidad × precio).</p>
        </div>
      )}
    </div>
  )
}

// ---------------- Operadores ----------------
function TabOperadores({ impId, puedeGestionar, onError }: { impId: string; puedeGestionar: boolean; onError: (m: string) => void }) {
  const [items, setItems] = useState<ImportacionOperador[]>([])
  const [ops, setOps] = useState<Operador[]>([])
  const [roles, setRoles] = useState<TipoRolOperador[]>([])
  const [sel, setSel] = useState({ operador: '', rol: '' })

  const cargar = useCallback(() => { listImportacionOperadores(impId).then(setItems).catch((e) => onError(e.message)) }, [impId, onError])
  useEffect(() => { cargar(); listOperadores().then(setOps).catch(() => {}); listTiposRolOperador().then(setRoles).catch(() => {}) }, [cargar])

  const agregar = async () => {
    if (!sel.operador || !sel.rol) return
    try { await addImportacionOperador(impId, sel.operador, sel.rol); setSel({ operador: '', rol: '' }); cargar() } catch (e) { onError((e as Error).message) }
  }
  const quitar = async (opId: string, rol: string) => { try { await removeImportacionOperador(impId, opId, rol); cargar() } catch (e) { onError((e as Error).message) } }

  return (
    <div className="card stack stack-3">
      <h2 className="t-heading">Operadores de la importación</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Operador</th><th>Rol en esta importación</th><th></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.operador_id + it.rol_codigo}>
                <td>{it.operador_nombre ?? it.operador_id}</td>
                <td>{it.rol_nombre ?? it.rol_codigo}</td>
                <td>{puedeGestionar && <button className="btn btn-secondary" onClick={() => quitar(it.operador_id, it.rol_codigo)}>Quitar</button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="t-body-sm">Sin operadores asignados.</td></tr>}
          </tbody>
        </table>
      </div>
      {puedeGestionar && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={sel.operador} onChange={(e) => setSel({ ...sel, operador: e.target.value })}>
            <option value="">— Operador —</option>
            {ops.map((o) => (<option key={o.id} value={o.id}>{o.nombre}</option>))}
          </select>
          <select value={sel.rol} onChange={(e) => setSel({ ...sel, rol: e.target.value })}>
            <option value="">— Rol —</option>
            {roles.map((r) => (<option key={r.codigo} value={r.codigo}>{r.nombre}</option>))}
          </select>
          <button className="btn btn-primary" onClick={agregar}>Añadir</button>
        </div>
      )}
    </div>
  )
}

// ---------------- Logística ----------------
function TabLogistica({ imp, puedeGestionar, onSaved, onError }: { imp: Importacion; puedeGestionar: boolean; onSaved: () => void; onError: (m: string) => void }) {
  const [f, setF] = useState(imp)
  const [alms, setAlms] = useState<Almacen[]>([])
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { listAlmacenes().then(setAlms).catch(() => {}) }, [])

  const set = (k: keyof Importacion, v: string) => setF({ ...f, [k]: v === '' ? null : v })

  const guardar = async () => {
    setGuardando(true); onError('')
    try {
      await updateImportacion(imp.id, {
        origen: f.origen, destino: f.destino, incoterm: f.incoterm, modalidad_transporte: f.modalidad_transporte,
        booking: f.booking, bl: f.bl, contenedor: f.contenedor,
        etd_prevista: f.etd_prevista, etd_real: f.etd_real, eta_prevista: f.eta_prevista, eta_real: f.eta_real,
        almacen_destino_id: f.almacen_destino_id, moneda: f.moneda || 'EUR',
        tc_presupuestado: f.tc_presupuestado, observaciones: f.observaciones,
      })
      onSaved()
    } catch (e) { onError((e as Error).message) } finally { setGuardando(false) }
  }

  const dis = !puedeGestionar
  return (
    <div className="card stack stack-3">
      <h2 className="t-heading">Logística y fechas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        <L label="Origen"><input disabled={dis} value={f.origen ?? ''} onChange={(e) => set('origen', e.target.value)} /></L>
        <L label="Destino"><input disabled={dis} value={f.destino ?? ''} onChange={(e) => set('destino', e.target.value)} /></L>
        <L label="Incoterm">
          <select disabled={dis} value={f.incoterm ?? ''} onChange={(e) => set('incoterm', e.target.value)}>
            <option value="">—</option>{INCOTERMS.map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
        </L>
        <L label="Transporte">
          <select disabled={dis} value={f.modalidad_transporte ?? ''} onChange={(e) => set('modalidad_transporte', e.target.value)}>
            <option value="">—</option>{MODALIDADES.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </L>
        <L label="Booking"><input disabled={dis} value={f.booking ?? ''} onChange={(e) => set('booking', e.target.value)} /></L>
        <L label="BL"><input disabled={dis} value={f.bl ?? ''} onChange={(e) => set('bl', e.target.value)} /></L>
        <L label="Contenedor"><input disabled={dis} value={f.contenedor ?? ''} onChange={(e) => set('contenedor', e.target.value)} /></L>
        <L label="Almacén destino">
          <select disabled={dis} value={f.almacen_destino_id ?? ''} onChange={(e) => set('almacen_destino_id', e.target.value)}>
            <option value="">—</option>{alms.map((a) => (<option key={a.id} value={a.id}>{a.nombre}</option>))}
          </select>
        </L>
        <L label="ETD prevista"><input type="date" disabled={dis} value={f.etd_prevista ?? ''} onChange={(e) => set('etd_prevista', e.target.value)} /></L>
        <L label="ETD real"><input type="date" disabled={dis} value={f.etd_real ?? ''} onChange={(e) => set('etd_real', e.target.value)} /></L>
        <L label="ETA prevista"><input type="date" disabled={dis} value={f.eta_prevista ?? ''} onChange={(e) => set('eta_prevista', e.target.value)} /></L>
        <L label="ETA real"><input type="date" disabled={dis} value={f.eta_real ?? ''} onChange={(e) => set('eta_real', e.target.value)} /></L>
        <L label="Moneda"><input disabled={dis} value={f.moneda ?? ''} onChange={(e) => set('moneda', e.target.value)} /></L>
        <L label="TC presupuestado">
          <input disabled={dis} value={f.tc_presupuestado != null ? String(f.tc_presupuestado) : ''}
            onChange={(e) => setF({ ...f, tc_presupuestado: e.target.value === '' ? null : Number(e.target.value) })} />
        </L>
      </div>
      <L label="Observaciones"><textarea disabled={dis} rows={2} value={f.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} /></L>
      {puedeGestionar && <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>}
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  )
}

// ---------------- Documentación ----------------
function TabDocumentos({ impId, puedeGestionar, onError }: { impId: string; puedeGestionar: boolean; onError: (m: string) => void }) {
  const [docs, setDocs] = useState<DocumentoImportacion[]>([])
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(() => { listDocumentos(impId).then(setDocs).catch((e) => onError(e.message)) }, [impId, onError])
  useEffect(() => { cargar(); listTiposDocumento().then(setTipos).catch(() => {}) }, [cargar])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setSubiendo(true); onError('')
    try {
      const meta = await subirArchivo(`imp/${impId}`, file)
      await crearDocumento(impId, {
        tipo_codigo: nuevoTipo || null, estado: 'recibido',
        nombre_archivo: meta.nombre, storage_path: meta.path, mime_type: meta.mime, tamano_bytes: meta.size,
      })
      cargar()
    } catch (err) { onError((err as Error).message) } finally { setSubiendo(false) }
  }

  const descargar = async (d: DocumentoImportacion) => {
    if (!d.storage_path) return
    try { const url = await urlFirmada(d.storage_path); window.open(url, '_blank') } catch (e) { onError((e as Error).message) }
  }
  const cambiarEstado = async (d: DocumentoImportacion, estado: string) => {
    try { await actualizarDocumento(d.id, { estado }); cargar() } catch (e) { onError((e as Error).message) }
  }
  const eliminar = async (d: DocumentoImportacion) => {
    try {
      if (d.validado_at) await archivarDocumento(d.id)  // evidencia validada: archivar, no borrar
      else await borrarDocumento(d.id)
      cargar()
    } catch (e) { onError((e as Error).message) }
  }

  return (
    <div className="card stack stack-3">
      <h2 className="t-heading">Documentación</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{tipos.find((t) => t.codigo === d.tipo_codigo)?.nombre ?? d.tipo_codigo ?? '—'}</td>
                <td>{d.storage_path ? <button className="btn btn-secondary" onClick={() => descargar(d)}>{d.nombre_archivo ?? 'Descargar'}</button> : '—'}</td>
                <td>
                  {puedeGestionar ? (
                    <select value={d.estado} onChange={(e) => cambiarEstado(d, e.target.value)}>
                      {ESTADOS_DOC.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  ) : (<span className="badge">{d.estado}</span>)}
                </td>
                <td>{d.fecha ? formatFecha(d.fecha) : formatFechaHora(d.created_at)}</td>
                <td>{puedeGestionar && <button className="btn btn-secondary" onClick={() => eliminar(d)}>{d.validado_at ? 'Archivar' : 'Quitar'}</button>}</td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={5} className="t-body-sm">Sin documentos.</td></tr>}
          </tbody>
        </table>
      </div>
      {puedeGestionar && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)}>
            <option value="">— Tipo —</option>
            {tipos.map((t) => (<option key={t.codigo} value={t.codigo}>{t.nombre}</option>))}
          </select>
          <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
            {subiendo ? 'Subiendo…' : 'Subir documento'}
            <input type="file" hidden onChange={onFile} disabled={subiendo} />
          </label>
          <span className="t-body-sm">Los documentos validados no se borran (se archivan o versionan).</span>
        </div>
      )}
    </div>
  )
}
