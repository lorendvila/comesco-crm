import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCOP } from '../../data/constants'
import { listLineas, listOperadores } from '../../data/importaciones'
import type { ImportacionLinea, Operador } from '../../data/importaciones'
import { listReferencias } from '../../data/referencias'
import type { ReferenciaResumen } from '../../data/referencias'
import {
  listCostes, crearCoste, actualizarCoste, borrarCoste,
  recalcularReparto, listReparto, guardarRepartoManual, reconciliar, listLanded,
  listAnticipos, crearAnticipo, actualizarAnticipo, tcSugerido,
  CRITERIOS, CRITERIO_LABEL, ESTADOS_ANTICIPO,
} from '../../data/importaciones-costes'
import type { Coste, CosteInput, RepartoRow, LandedLinea, Anticipo } from '../../data/importaciones-costes'
import { listTiposCoste } from '../../data/importaciones'
import type { TipoCoste } from '../../data/importaciones'

const n = (s: string): number | null => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null)
const cop = (v: number | null | undefined) => formatCOP(v ?? 0)
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

// ============ COSTES ============
export function TabCostes({ imp, puedeGestionar, onError }: { imp: { id: string; estado_coste: string }; puedeGestionar: boolean; onError: (m: string) => void }) {
  const impId = imp.id
  const [costes, setCostes] = useState<Coste[]>([])
  const [lineas, setLineas] = useState<ImportacionLinea[]>([])
  const [landed, setLanded] = useState<LandedLinea[]>([])
  const [reparto, setReparto] = useState<RepartoRow[]>([])
  const [tipos, setTipos] = useState<TipoCoste[]>([])
  const [ops, setOps] = useState<Operador[]>([])
  const [refs, setRefs] = useState<ReferenciaResumen[]>([])
  const [recoOk, setRecoOk] = useState<boolean | null>(null)
  const [selCoste, setSelCoste] = useState<string | null>(null)
  const [form, setForm] = useState<FormCoste>(nuevoForm())

  const editable = puedeGestionar && imp.estado_coste !== 'definitivo'

  const recargar = useCallback(async () => {
    try {
      const [c, l, la, rp] = await Promise.all([listCostes(impId), listLineas(impId), listLanded(impId), listReparto(impId)])
      setCostes(c); setLineas(l); setLanded(la); setReparto(rp)
      const mis = await reconciliar(impId)
      setRecoOk(mis.length === 0)
    } catch (e) { onError((e as Error).message) }
  }, [impId, onError])

  useEffect(() => {
    recargar()
    listTiposCoste().then(setTipos).catch(() => {})
    listOperadores().then(setOps).catch(() => {})
    listReferencias().then((r) => setRefs(r.filter((x) => !x.es_servicio))).catch(() => {})
  }, [recargar])

  const nombreLinea = useCallback((lineaId: string) => {
    const l = lineas.find((x) => x.id === lineaId)
    return l ? `${l.referencia_nombre ?? l.referencia_id}${l.referencia_sku ? ` (${l.referencia_sku})` : ''} · ${l.cantidad_unidades} u` : lineaId
  }, [lineas])

  const capitalizables = costes.filter((c) => c.capitalizable)
  const noCapitalizables = costes.filter((c) => !c.capitalizable)

  const guardarCoste = async () => {
    onError('')
    const payload: CosteInput = {
      tipo_coste_codigo: form.tipo, capitalizable: form.capitalizable, concepto: form.concepto || null,
      operador_id: form.operador || null, criterio_reparto: form.criterio,
      referencia_id: form.criterio === 'directo' && form.directoTipo === 'ref' ? form.referencia || null : null,
      linea_directa_id: form.criterio === 'directo' && form.directoTipo === 'linea' ? form.linea || null : null,
      importe_estimado: n(form.impEst), moneda_estimado: form.monEst || null, tc_estimado: n(form.tcEst),
      importe_real: n(form.impReal), moneda_real: form.monReal || null, tc_real: n(form.tcReal),
      sin_coste_real: form.sinReal, fecha_factura: form.fechaFactura || null,
    }
    if (!payload.tipo_coste_codigo) { onError('Elige un tipo de coste.'); return }
    try {
      if (form.id) await actualizarCoste(form.id, payload)
      else await crearCoste(impId, payload)
      if (form.criterio !== 'manual') await recalcularReparto(impId)
      setForm(nuevoForm()); recargar()
    } catch (e) { onError((e as Error).message) }
  }

  const eliminar = async (c: Coste) => { try { await borrarCoste(c); if (c.criterio_reparto !== 'manual') await recalcularReparto(impId); recargar() } catch (e) { onError((e as Error).message) } }
  const recalc = async () => { try { await recalcularReparto(impId); recargar() } catch (e) { onError((e as Error).message) } }
  const editar = (c: Coste) => setForm(formDesde(c))

  const totLandedProv = landed.reduce((s, x) => s + (x.landed_prov_cop ?? 0), 0)
  const totProvEst = landed.reduce((s, x) => s + (x.prov_desde_estimado_cop ?? 0), 0)

  return (
    <div className="stack stack-4">
      {imp.estado_coste === 'definitivo' && <div className="card"><p className="t-body-sm">Importación en coste <b>definitivo</b>: costes inmutables.</p></div>}

      {/* Landed cost por línea */}
      <div className="card stack stack-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="t-heading">Landed cost por línea</h2>
          <span className="t-body-sm">Provisional total: <b>{cop(totLandedProv)}</b> · de estimación: <b>{cop(totProvEst)}</b> ({pct(totProvEst, totLandedProv)}%)</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Referencia</th><th>Uds.</th><th>Landed est.</th><th>Landed real</th><th>Landed provisional</th><th>Unitario prov.</th><th>% aún estimado</th></tr></thead>
            <tbody>
              {landed.map((x) => (
                <tr key={x.linea_id}>
                  <td>{nombreLinea(x.linea_id).split(' · ')[0]}</td>
                  <td>{x.cantidad_unidades}</td>
                  <td>{cop(x.landed_est_cop)}</td>
                  <td>{cop(x.landed_real_cop)}</td>
                  <td><b>{cop(x.landed_prov_cop)}</b></td>
                  <td>{cop(x.landed_prov_unitario)}</td>
                  <td>
                    <span className="badge">{pct(x.prov_desde_estimado_cop ?? 0, x.landed_prov_cop ?? 0)}%</span>
                  </td>
                </tr>
              ))}
              {landed.length === 0 && <tr><td colSpan={7} className="t-body-sm">Sin líneas de mercancía.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="t-body-sm">El provisional usa, por cada componente, el valor real si existe y si no el estimado. La columna "% aún estimado" indica cuánto del landed sigue siendo estimación.</p>
      </div>

      {/* Costes capitalizables */}
      <div className="card stack stack-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="t-heading">Costes capitalizables (entran en landed)</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {recoOk != null && <span className="badge">{recoOk ? 'Reparto reconciliado ✓' : 'Descuadre de reparto'}</span>}
            {editable && <button className="btn btn-secondary" onClick={recalc}>Recalcular reparto</button>}
          </div>
        </div>
        <TablaCostes costes={capitalizables} editable={editable} onEditar={editar} onEliminar={eliminar} onVerReparto={setSelCoste} selCoste={selCoste} />
      </div>

      {/* Editor / vista de reparto del coste seleccionado */}
      {selCoste && (
        <RepartoCoste
          coste={costes.find((c) => c.id === selCoste)!}
          reparto={reparto.filter((r) => r.coste_id === selCoste)}
          nombreLinea={nombreLinea} lineas={lineas} editable={editable}
          onGuardado={recargar} onError={onError} onCerrar={() => setSelCoste(null)}
        />
      )}

      {/* No capitalizables */}
      <div className="card stack stack-3">
        <h2 className="t-heading">Costes no capitalizables (separados; no entran en landed)</h2>
        <TablaCostes costes={noCapitalizables} editable={editable} onEditar={editar} onEliminar={eliminar} onVerReparto={() => {}} selCoste={null} noReparto />
      </div>

      {/* Alta / edición */}
      {editable && (
        <div className="card stack stack-3">
          <h3 className="t-heading">{form.id ? 'Editar coste' : 'Añadir coste'}</h3>
          <FormularioCoste form={form} setForm={setForm} tipos={tipos} ops={ops} refs={refs} lineas={lineas} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={guardarCoste}>{form.id ? 'Guardar' : 'Añadir'}</button>
            {form.id && <button className="btn btn-secondary" onClick={() => setForm(nuevoForm())}>Cancelar</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function TablaCostes({ costes, editable, onEditar, onEliminar, onVerReparto, selCoste, noReparto }: {
  costes: Coste[]; editable: boolean; onEditar: (c: Coste) => void; onEliminar: (c: Coste) => void; onVerReparto: (id: string) => void; selCoste: string | null; noReparto?: boolean
}) {
  const desv = (c: Coste) => (c.importe_real_cop != null && c.importe_estimado_cop != null) ? c.importe_real_cop - c.importe_estimado_cop : null
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Tipo</th><th>Concepto</th><th>Criterio</th><th>Estimado</th><th>Real</th><th>Desviación</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {costes.map((c) => {
            const d = desv(c)
            const resuelto = c.importe_real != null || c.sin_coste_real
            return (
              <tr key={c.id} style={selCoste === c.id ? { outline: '2px solid var(--accent, #888)' } : undefined}>
                <td>{c.tipo_nombre ?? c.tipo_coste_codigo}</td>
                <td>{c.concepto ?? '—'}{c.operador_nombre ? ` · ${c.operador_nombre}` : ''}</td>
                <td>{CRITERIO_LABEL[c.criterio_reparto] ?? c.criterio_reparto}</td>
                <td>{c.importe_estimado_cop != null ? cop(c.importe_estimado_cop) : '—'}{c.moneda_estimado ? ` (${c.importe_estimado} ${c.moneda_estimado})` : ''}</td>
                <td>{c.importe_real_cop != null ? cop(c.importe_real_cop) : (c.sin_coste_real ? 'sin coste' : '—')}</td>
                <td>{d != null ? cop(d) : '—'}</td>
                <td><span className="badge">{resuelto ? 'Resuelto' : 'Pendiente'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {!noReparto && <button className="btn btn-secondary" onClick={() => onVerReparto(c.id)}>Reparto</button>}{' '}
                  {editable && <button className="btn btn-secondary" onClick={() => onEditar(c)}>Editar</button>}{' '}
                  {editable && <button className="btn btn-secondary" onClick={() => onEliminar(c)}>{c.importe_real != null ? 'Archivar' : 'Quitar'}</button>}
                </td>
              </tr>
            )
          })}
          {costes.length === 0 && <tr><td colSpan={8} className="t-body-sm">Sin costes.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function RepartoCoste({ coste, reparto, nombreLinea, lineas, editable, onGuardado, onError, onCerrar }: {
  coste: Coste; reparto: RepartoRow[]; nombreLinea: (id: string) => string; lineas: ImportacionLinea[]; editable: boolean; onGuardado: () => void; onError: (m: string) => void; onCerrar: () => void
}) {
  const esManual = coste.criterio_reparto === 'manual'
  const [filas, setFilas] = useState<{ linea_id: string; est: string; real: string }[]>([])
  useEffect(() => {
    if (esManual) {
      setFilas(lineas.map((l) => {
        const r = reparto.find((x) => x.importacion_linea_id === l.id)
        return { linea_id: l.id, est: r?.importe_estimado_cop != null ? String(r.importe_estimado_cop) : '', real: r?.importe_real_cop != null ? String(r.importe_real_cop) : '' }
      }))
    }
  }, [esManual, lineas, reparto])

  const sumaEst = filas.reduce((s, f) => s + (n(f.est) ?? 0), 0)
  const objetivoEst = coste.importe_estimado_cop ?? 0
  const guardar = async () => {
    onError('')
    if (Math.abs(sumaEst - objetivoEst) > 0.005) { onError(`El reparto manual estimado (${cop(sumaEst)}) debe sumar el coste (${cop(objetivoEst)}).`); return }
    try { await guardarRepartoManual(coste.id, filas.map((f) => ({ linea_id: f.linea_id, est: n(f.est), real: n(f.real) }))); onGuardado() }
    catch (e) { onError((e as Error).message) }
  }

  return (
    <div className="card stack stack-3">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="t-heading">Reparto · {coste.tipo_nombre ?? coste.tipo_coste_codigo} ({CRITERIO_LABEL[coste.criterio_reparto]})</h3>
        <button className="btn btn-secondary" onClick={onCerrar}>Cerrar</button>
      </div>
      {esManual ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Línea</th><th>Estimado COP</th><th>Real COP</th></tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.linea_id}>
                    <td>{nombreLinea(f.linea_id)}</td>
                    <td><input style={{ width: 120 }} disabled={!editable} value={f.est} onChange={(e) => setFilas(filas.map((x, j) => j === i ? { ...x, est: e.target.value } : x))} /></td>
                    <td><input style={{ width: 120 }} disabled={!editable} value={f.real} onChange={(e) => setFilas(filas.map((x, j) => j === i ? { ...x, real: e.target.value } : x))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-body-sm">Suma estimada: <b>{cop(sumaEst)}</b> / objetivo <b>{cop(objetivoEst)}</b></p>
          {editable && <button className="btn btn-primary" onClick={guardar}>Guardar reparto manual</button>}
        </>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Línea</th><th>Base</th><th>Estimado COP</th><th>Real COP</th></tr></thead>
            <tbody>
              {reparto.map((r) => (
                <tr key={r.importacion_linea_id}>
                  <td>{nombreLinea(r.importacion_linea_id)}</td>
                  <td>{r.base_reparto ?? '—'}</td>
                  <td>{cop(r.importe_estimado_cop)}</td>
                  <td>{r.importe_real_cop != null ? cop(r.importe_real_cop) : '—'}</td>
                </tr>
              ))}
              {reparto.length === 0 && <tr><td colSpan={4} className="t-body-sm">Sin reparto (recalcula).</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- formulario de coste ----
type FormCoste = {
  id: string | null; tipo: string; capitalizable: boolean; concepto: string; operador: string; criterio: string
  directoTipo: 'ref' | 'linea'; referencia: string; linea: string
  impEst: string; monEst: string; tcEst: string; impReal: string; monReal: string; tcReal: string; sinReal: boolean; fechaFactura: string
}
function nuevoForm(): FormCoste {
  return { id: null, tipo: '', capitalizable: true, concepto: '', operador: '', criterio: 'valor', directoTipo: 'ref', referencia: '', linea: '', impEst: '', monEst: 'EUR', tcEst: '', impReal: '', monReal: 'EUR', tcReal: '', sinReal: false, fechaFactura: '' }
}
function formDesde(c: Coste): FormCoste {
  return {
    id: c.id, tipo: c.tipo_coste_codigo, capitalizable: !!c.capitalizable, concepto: c.concepto ?? '', operador: c.operador_id ?? '',
    criterio: c.criterio_reparto, directoTipo: c.linea_directa_id ? 'linea' : 'ref', referencia: c.referencia_id ?? '', linea: c.linea_directa_id ?? '',
    impEst: c.importe_estimado != null ? String(c.importe_estimado) : '', monEst: c.moneda_estimado ?? 'EUR', tcEst: c.tc_estimado != null ? String(c.tc_estimado) : '',
    impReal: c.importe_real != null ? String(c.importe_real) : '', monReal: c.moneda_real ?? 'EUR', tcReal: c.tc_real != null ? String(c.tc_real) : '', sinReal: c.sin_coste_real, fechaFactura: c.fecha_factura ?? '',
  }
}
function FormularioCoste({ form, setForm, tipos, ops, refs, lineas }: { form: FormCoste; setForm: (f: FormCoste) => void; tipos: TipoCoste[]; ops: Operador[]; refs: ReferenciaResumen[]; lineas: ImportacionLinea[] }) {
  const onTipo = (codigo: string) => {
    const t = tipos.find((x) => x.codigo === codigo)
    setForm({ ...form, tipo: codigo, capitalizable: t ? t.capitalizable : form.capitalizable, criterio: t?.criterio_reparto_default ?? form.criterio })
  }
  const prefillTc = async (campo: 'tcEst' | 'tcReal') => { const v = await tcSugerido(); if (v != null) setForm({ ...form, [campo]: String(v) }) }
  return (
    <div className="stack stack-2">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={form.tipo} onChange={(e) => onTipo(e.target.value)}>
          <option value="">— Tipo de coste —</option>
          {tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}{t.capitalizable ? '' : ' (no cap.)'}</option>)}
        </select>
        <label className="t-body-sm" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={form.capitalizable} onChange={(e) => setForm({ ...form, capitalizable: e.target.checked })} /> Capitalizable
        </label>
        <input placeholder="Concepto" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
        <select value={form.operador} onChange={(e) => setForm({ ...form, operador: e.target.value })}>
          <option value="">— Entidad que cobra —</option>
          {ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={form.criterio} onChange={(e) => setForm({ ...form, criterio: e.target.value })}>
          {CRITERIOS.map((c) => <option key={c} value={c}>{CRITERIO_LABEL[c]}</option>)}
        </select>
        {form.criterio === 'directo' && (
          <>
            <select value={form.directoTipo} onChange={(e) => setForm({ ...form, directoTipo: e.target.value as 'ref' | 'linea' })}>
              <option value="ref">a Referencia</option>
              <option value="linea">a Línea</option>
            </select>
            {form.directoTipo === 'ref' ? (
              <select value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })}>
                <option value="">— Referencia —</option>
                {refs.map((r) => <option key={r.id} value={r.id}>{r.nombre_producto}</option>)}
              </select>
            ) : (
              <select value={form.linea} onChange={(e) => setForm({ ...form, linea: e.target.value })}>
                <option value="">— Línea —</option>
                {lineas.map((l) => <option key={l.id} value={l.id}>{l.referencia_nombre} · {l.cantidad_unidades} u</option>)}
              </select>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="t-body-sm">Estimado:</span>
        <input placeholder="Importe" style={{ width: 100 }} value={form.impEst} onChange={(e) => setForm({ ...form, impEst: e.target.value })} />
        <input placeholder="Moneda" style={{ width: 70 }} value={form.monEst} onChange={(e) => setForm({ ...form, monEst: e.target.value })} />
        <input placeholder="TC" style={{ width: 90 }} value={form.tcEst} onChange={(e) => setForm({ ...form, tcEst: e.target.value })} />
        <button type="button" className="btn btn-secondary" onClick={() => prefillTc('tcEst')}>TC serie</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="t-body-sm">Real:</span>
        <input placeholder="Importe" style={{ width: 100 }} value={form.impReal} onChange={(e) => setForm({ ...form, impReal: e.target.value })} />
        <input placeholder="Moneda" style={{ width: 70 }} value={form.monReal} onChange={(e) => setForm({ ...form, monReal: e.target.value })} />
        <input placeholder="TC" style={{ width: 90 }} value={form.tcReal} onChange={(e) => setForm({ ...form, tcReal: e.target.value })} />
        <button type="button" className="btn btn-secondary" onClick={() => prefillTc('tcReal')}>TC serie</button>
        <input type="date" value={form.fechaFactura} onChange={(e) => setForm({ ...form, fechaFactura: e.target.value })} />
        <label className="t-body-sm" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={form.sinReal} onChange={(e) => setForm({ ...form, sinReal: e.target.checked })} /> Sin coste real
        </label>
      </div>
      <p className="t-body-sm">El importe COP se calcula con el TC (bloqueado). El estimado nunca se sobrescribe al añadir el real.</p>
    </div>
  )
}

// ============ ANTICIPOS ============
export function TabAnticipos({ impId, puedeGestionar, onError }: { impId: string; puedeGestionar: boolean; onError: (m: string) => void }) {
  const [items, setItems] = useState<Anticipo[]>([])
  const [ops, setOps] = useState<Operador[]>([])
  const [f, setF] = useState({ operador: '', concepto: '', importe: '', moneda: 'EUR', tc: '', estado: 'solicitado', utilizado: '', fechaSol: '', fechaPago: '' })

  const recargar = useCallback(() => { listAnticipos(impId).then(setItems).catch((e) => onError(e.message)) }, [impId, onError])
  useEffect(() => { recargar(); listOperadores().then(setOps).catch(() => {}) }, [recargar])

  const crear = async () => {
    onError('')
    const importe = n(f.importe)
    if (importe == null) { onError('Importe obligatorio.'); return }
    try {
      await crearAnticipo(impId, { operador_id: f.operador || null, concepto: f.concepto || null, importe, moneda: f.moneda, tc: n(f.tc), estado: f.estado, importe_utilizado: n(f.utilizado) ?? 0, fecha_solicitud: f.fechaSol || null, fecha_pago: f.fechaPago || null })
      setF({ operador: '', concepto: '', importe: '', moneda: 'EUR', tc: '', estado: 'solicitado', utilizado: '', fechaSol: '', fechaPago: '' })
      recargar()
    } catch (e) { onError((e as Error).message) }
  }
  const cambiarEstado = async (a: Anticipo, estado: string) => { try { await actualizarAnticipo(a.id, { estado }); recargar() } catch (e) { onError((e as Error).message) } }

  const totalCop = items.reduce((s, a) => s + (a.importe_cop ?? 0), 0)
  const saldoCop = items.reduce((s, a) => s + (a.saldo_cop ?? 0), 0)

  return (
    <div className="card stack stack-3">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="t-heading">Anticipos y pagos</h2>
        <span className="t-body-sm">Anticipado: <b>{cop(totalCop)}</b> · Saldo pendiente de justificar: <b>{cop(saldoCop)}</b></span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Operador</th><th>Concepto</th><th>Importe</th><th>COP</th><th>Estado</th><th>Utilizado</th><th>Saldo</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{ops.find((o) => o.id === a.operador_id)?.nombre ?? '—'}</td>
                <td>{a.concepto ?? '—'}</td>
                <td>{a.importe} {a.moneda}{a.tc ? ` @${a.tc}` : ''}</td>
                <td>{cop(a.importe_cop)}</td>
                <td>{puedeGestionar ? (
                  <select value={a.estado} onChange={(e) => cambiarEstado(a, e.target.value)}>{ESTADOS_ANTICIPO.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                ) : <span className="badge">{a.estado}</span>}</td>
                <td>{a.importe_utilizado}</td>
                <td>{a.saldo}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="t-body-sm">Sin anticipos.</td></tr>}
          </tbody>
        </table>
      </div>
      {puedeGestionar && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={f.operador} onChange={(e) => setF({ ...f, operador: e.target.value })}><option value="">— Operador —</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
          <input placeholder="Concepto" value={f.concepto} onChange={(e) => setF({ ...f, concepto: e.target.value })} />
          <input placeholder="Importe" style={{ width: 100 }} value={f.importe} onChange={(e) => setF({ ...f, importe: e.target.value })} />
          <input placeholder="Moneda" style={{ width: 70 }} value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value })} />
          <input placeholder="TC pago" style={{ width: 90 }} value={f.tc} onChange={(e) => setF({ ...f, tc: e.target.value })} />
          <button className="btn btn-primary" onClick={crear}>Añadir</button>
        </div>
      )}
      <p className="t-body-sm">El TC del anticipo es el efectivo del pago (base del resultado por diferencia de cambio, que se calculará en una fase posterior).</p>
    </div>
  )
}

// ============ INDICADORES DE RESUMEN ============
export function ResumenIndicadoresI2({ impId }: { impId: string }) {
  const [landed, setLanded] = useState<LandedLinea[]>([])
  const [costes, setCostes] = useState<Coste[]>([])
  const [anticipos, setAnticipos] = useState<Anticipo[]>([])
  useEffect(() => {
    listLanded(impId).then(setLanded).catch(() => {})
    listCostes(impId).then(setCostes).catch(() => {})
    listAnticipos(impId).then(setAnticipos).catch(() => {})
  }, [impId])

  const est = landed.reduce((s, x) => s + (x.landed_est_cop ?? 0), 0)
  const prov = landed.reduce((s, x) => s + (x.landed_prov_cop ?? 0), 0)
  const provEst = landed.reduce((s, x) => s + (x.prov_desde_estimado_cop ?? 0), 0)
  const desvPct = est > 0 ? Math.round(((prov - est) / est) * 1000) / 10 : 0
  const pendientes = costes.filter((c) => c.capitalizable && c.importe_real == null && !c.sin_coste_real).length
  const saldoAnticipos = anticipos.reduce((s, a) => s + (a.saldo_cop ?? 0), 0)

  const items = useMemo(() => ([
    ['Landed estimado', cop(est)],
    ['Landed provisional', cop(prov)],
    ['Desviación prov. vs est.', `${desvPct > 0 ? '+' : ''}${desvPct}%`],
    ['Aún estimado', `${cop(provEst)} (${pct(provEst, prov)}%)`],
    ['Facturas pendientes', String(pendientes)],
    ['Saldo anticipos', cop(saldoAnticipos)],
  ] as [string, string][]), [est, prov, desvPct, provEst, pendientes, saldoAnticipos])

  return (
    <div className="card stack stack-3">
      <h2 className="t-heading">Coste (I-2)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {items.map(([k, v]) => (
          <div key={k} className="card-metric">
            <p className="card-metric__label">{k}</p>
            <p className="card-metric__value" style={{ fontSize: '1.1rem' }}>{v}</p>
          </div>
        ))}
      </div>
      {pendientes > 0 && <p className="t-body-sm">⚠ {pendientes} concepto(s) capitalizable(s) sin factura real: el landed sigue siendo provisional.</p>}
    </div>
  )
}
