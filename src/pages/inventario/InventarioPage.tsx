import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { permisos } from '../../auth/permisos'
import { listInventario, upsertInventario, updateCosteReferencia, updateTarifasReferencia } from '../../data/inventario'
import type { InventarioFila } from '../../data/inventario'
import { descatalogarReferencia, restaurarReferencia } from '../../data/referencias'
import { formatCOP, formatFechaHora, colorFamilia, costeConComision } from '../../data/constants'
import { downloadCSV } from '../../lib/csv'

const hoyISO = () => new Date().toISOString().slice(0, 10)

interface FormState {
  cantidad_disponible: string
  ubicacion: string
  contenedor: string
  coste: string
  notas: string
  precioFs: string
  precioRetail: string
  precioIndustria: string
}

const strOrEmpty = (n: number | null) => (n == null ? '' : String(n))

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function InventarioPage() {
  const { profile } = useAuth()
  // El modal edita stock (inventario) + coste/tarifas (referencias): requiere
  // operar cualquiera de las dos áreas. (La protección del coste llega en Fase 3.)
  const puedeEditar = permisos.manageInventario(profile) || permisos.manageReferencias(profile)
  const puedeDescatalogar = permisos.manageReferencias(profile) // descatalogar/restaurar referencias
  const puedeVerCostes = permisos.seeCosts(profile) // coste/valor de stock: no para comercial
  const [filas, setFilas] = useState<InventarioFila[]>([])
  const [ciudad, setCiudad] = useState<string>('') // '' = todas
  const [verDescatalogadas, setVerDescatalogadas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<InventarioFila | null>(null)
  const [form, setForm] = useState<FormState>({ cantidad_disponible: '', ubicacion: '', contenedor: '', coste: '', notas: '', precioFs: '', precioRetail: '', precioIndustria: '' })

  const cargar = () => {
    setLoading(true)
    listInventario(verDescatalogadas)
      .then(setFilas)
      .catch(() => setError('No se pudo cargar el inventario.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [verDescatalogadas])

  const ciudades = useMemo(() => [...new Set(filas.map((f) => f.almacen.ciudad))].sort(), [filas])
  const visibles = useMemo(() => (ciudad ? filas.filter((f) => f.almacen.ciudad === ciudad) : filas), [filas, ciudad])

  // Valor del stock a la vista (respeta el filtro de ciudad). En unidades × coste.
  const valorTotal = useMemo(
    () => visibles.reduce((s, f) => s + f.cantidad_disponible * (costeConComision(f.coste_almacen_cop) ?? 0), 0),
    [visibles],
  )

  const abrir = (f: InventarioFila) => {
    setForm({
      cantidad_disponible: String(f.cantidad_disponible),
      ubicacion: f.ubicacion ?? '',
      contenedor: f.contenedor ?? '',
      coste: f.coste_almacen_cop == null ? '' : String(f.coste_almacen_cop),
      notas: f.notas ?? '',
      precioFs: strOrEmpty(f.precio_food_service_cop),
      precioRetail: strOrEmpty(f.precio_retail_cop),
      precioIndustria: strOrEmpty(f.precio_industria_cop),
    })
    setEditando(f)
  }

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!editando) return
    try {
      await upsertInventario(editando.referencia_id, editando.almacen.id, {
        cantidad_disponible: num(form.cantidad_disponible),
        ubicacion: form.ubicacion.trim() || null,
        contenedor: form.contenedor.trim() || null,
        notas: form.notas.trim() || null,
      })
      await updateCosteReferencia(editando.referencia_id, form.coste === '' ? null : num(form.coste))
      await updateTarifasReferencia(editando.referencia_id, {
        precio_food_service_cop: form.precioFs === '' ? null : num(form.precioFs),
        precio_retail_cop: form.precioRetail === '' ? null : num(form.precioRetail),
        precio_industria_cop: form.precioIndustria === '' ? null : num(form.precioIndustria),
      })
      setEditando(null)
      cargar()
    } catch {
      setError('No se pudo guardar (¿tienes permisos suficientes?).')
    }
  }

  // Exporta el inventario a CSV (una fila por producto y ciudad). Importes en
  // entero COP para que Excel los sume sin líos de separadores.
  const exportar = () => {
    // Las columnas de coste solo salen si el rol puede verlas (no comercial).
    const cabeceras = ['Código', 'SKU', 'Producto', 'Formato', 'Categoría', 'Ciudad', 'Disponible (uds)',
      ...(puedeVerCostes ? ['Coste ud. COP', 'Valor total COP'] : []),
      'Ubicación', 'Contenedor', 'Actualizado']
    downloadCSV(
      `inventario_${hoyISO()}.csv`,
      cabeceras,
      visibles.map((f) => {
        const costeUd = costeConComision(f.coste_almacen_cop)
        return [
          f.codigo_interno,
          f.sku ?? '',
          f.nombre_producto,
          f.formato,
          f.categoria ?? '',
          f.almacen.ciudad,
          f.cantidad_disponible,
          ...(puedeVerCostes ? [
            costeUd == null ? '' : Math.round(costeUd),
            costeUd == null ? '' : Math.round(f.cantidad_disponible * costeUd),
          ] : []),
          f.ubicacion ?? '',
          f.contenedor ?? '',
          f.actualizado_at ? formatFechaHora(f.actualizado_at) : '',
        ]
      }),
    )
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <div>
          <h1 className="t-display">Inventario</h1>
          <p className="t-body-sm">Stock actual por referencia y almacén, en unidades. Se actualiza a mano (foto semanal).</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportar} disabled={visibles.length === 0}>
          Exportar inventario (CSV)
        </button>
      </div>

      <div className="card stack stack-3">
        <div className="cluster cluster-3" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 200 }}>
            <span className="field__label">Almacén / ciudad</span>
            <select className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)}>
              <option value="">Todas</option>
              {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {puedeDescatalogar && (
            <label className="cluster cluster-1" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={verDescatalogadas} onChange={(e) => setVerDescatalogadas(e.target.checked)} />
              <span className="t-body-sm">Mostrar descatalogadas</span>
            </label>
          )}
          {puedeVerCostes && (
            <div className="card-metric" style={{ marginLeft: 'auto' }}>
              <p className="card-metric__label">Valor del stock{ciudad ? ` · ${ciudad}` : ' · todas'}</p>
              <p className="card-metric__value">{formatCOP(valorTotal)}</p>
              <p className="card-metric__sub">Disponible × valor unitario</p>
            </div>
          )}
        </div>
      </div>

      {loading && <p className="t-body-sm">Cargando…</p>}
      {error && <p className="login-error">{error}</p>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>SKU</th>
                <th>Producto</th>
                <th>Formato</th>
                <th>Ciudad</th>
                <th>Disponible (uds)</th>
                {puedeVerCostes && <th>Coste ud.</th>}
                {puedeVerCostes && <th>Valor</th>}
                <th>Ubicación</th>
                <th>Contenedor</th>
                <th>Actualizado</th>
                {puedeEditar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={`${f.referencia_id}-${f.almacen.id}`} style={f.descatalogada ? { opacity: 0.55 } : undefined}>
                  <td className="mono">{f.codigo_interno}</td>
                  <td className="mono">{f.sku ?? '—'}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFamilia(f.categoria), marginRight: 8 }} />
                    {f.nombre_producto}
                    {f.descatalogada && <span className="badge" style={{ marginLeft: 8 }}>Descatalogada</span>}
                  </td>
                  <td>{f.formato}</td>
                  <td>{f.almacen.ciudad}</td>
                  <td>{f.cantidad_disponible}</td>
                  {puedeVerCostes && <td>{formatCOP(costeConComision(f.coste_almacen_cop))}</td>}
                  {puedeVerCostes && <td>{formatCOP(f.cantidad_disponible * (costeConComision(f.coste_almacen_cop) ?? 0))}</td>}
                  <td>{f.ubicacion ?? '—'}</td>
                  <td>{f.contenedor ?? '—'}</td>
                  <td>{f.actualizado_at ? formatFechaHora(f.actualizado_at) : '—'}</td>
                  {puedeEditar && (
                    <td><button className="btn btn-sm btn-outline" onClick={() => abrir(f)}>Editar</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="t-heading" style={{ marginBottom: 'var(--sp-1)' }}>{editando.nombre_producto} · {editando.formato}</h2>
            <p className="t-body-sm" style={{ marginBottom: 'var(--sp-2)' }}>Almacén: <strong>{editando.almacen.ciudad}</strong></p>
            <form className="form-grid" onSubmit={guardar}>
              <label className="field">
                <span className="field__label">Cantidad disponible (unidades)</span>
                <input className="input" type="number" min="0" step="any" value={form.cantidad_disponible} onChange={(e) => setForm({ ...form, cantidad_disponible: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">Coste hasta almacén (COP)</span>
                <input className="input" type="number" min="0" step="any" value={form.coste} onChange={(e) => setForm({ ...form, coste: e.target.value })} />
              </label>
              <div className="field field--full">
                <span className="field__label">Tarifa base por canal (neto, sin IVA)</span>
                <div className="cluster cluster-3">
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Food Service</span>
                    <input className="input" type="number" min="0" step="any" value={form.precioFs} onChange={(e) => setForm({ ...form, precioFs: e.target.value })} />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Retail</span>
                    <input className="input" type="number" min="0" step="any" value={form.precioRetail} onChange={(e) => setForm({ ...form, precioRetail: e.target.value })} />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Industria</span>
                    <input className="input" type="number" min="0" step="any" value={form.precioIndustria} onChange={(e) => setForm({ ...form, precioIndustria: e.target.value })} />
                  </label>
                </div>
              </div>
              <label className="field">
                <span className="field__label">Ubicación</span>
                <input className="input" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">Contenedor</span>
                <input className="input" value={form.contenedor} onChange={(e) => setForm({ ...form, contenedor: e.target.value })} />
              </label>
              <label className="field field--full">
                <span className="field__label">Notas</span>
                <textarea className="textarea" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </label>
              <div className="cluster cluster-3 field--full" style={{ justifyContent: 'space-between' }}>
                <div className="cluster cluster-3">
                  <button className="btn btn-primary" type="submit">Guardar</button>
                  <button className="btn btn-outline" type="button" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
                {puedeDescatalogar && (
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={async () => {
                      const ref = editando
                      const msg = ref.descatalogada
                        ? '¿Restaurar esta referencia al catálogo?'
                        : '¿Descatalogar esta referencia? Sale del catálogo operativo; el histórico que la use se conserva.'
                      if (!confirm(msg)) return
                      try {
                        if (ref.descatalogada) await restaurarReferencia(ref.referencia_id)
                        else await descatalogarReferencia(ref.referencia_id)
                        setEditando(null)
                        cargar()
                      } catch {
                        setError('No se pudo cambiar el estado de catálogo (¿permisos suficientes?).')
                      }
                    }}
                  >
                    {editando.descatalogada ? 'Restaurar al catálogo' : 'Descatalogar'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
