import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { listInventario, upsertInventario, updateCosteReferencia, updateTarifasReferencia } from '../../data/inventario'
import type { InventarioFila } from '../../data/inventario'
import { formatCOP, formatFechaHora, colorFamilia, costeConComision } from '../../data/constants'

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
  const isAdmin = profile?.role === 'admin'
  const [filas, setFilas] = useState<InventarioFila[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<InventarioFila | null>(null)
  const [form, setForm] = useState<FormState>({ cantidad_disponible: '', ubicacion: '', contenedor: '', coste: '', notas: '', precioFs: '', precioRetail: '', precioIndustria: '' })

  const cargar = () => {
    setLoading(true)
    listInventario()
      .then(setFilas)
      .catch(() => setError('No se pudo cargar el inventario.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const valorTotal = useMemo(
    () => filas.reduce((s, f) => s + (f.inv ? f.inv.cantidad_disponible * (costeConComision(f.coste_almacen_cop) ?? 0) : 0), 0),
    [filas],
  )

  const abrir = (f: InventarioFila) => {
    setForm({
      cantidad_disponible: f.inv ? String(f.inv.cantidad_disponible) : '',
      ubicacion: f.inv?.ubicacion ?? '',
      contenedor: f.inv?.contenedor ?? '',
      coste: f.coste_almacen_cop == null ? '' : String(f.coste_almacen_cop),
      notas: f.inv?.notas ?? '',
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
      await upsertInventario(editando.referencia_id, {
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
      setError('No se pudo guardar (¿tienes permisos de admin?).')
    }
  }

  return (
    <div className="stack stack-6">
      <div className="page-header">
        <div>
          <h1 className="t-display">Inventario</h1>
          <p className="t-body-sm">Stock actual por referencia. Se actualiza a mano (foto semanal del almacén).</p>
        </div>
      </div>

      <div className="summary-row">
        <div className="card-metric">
          <p className="card-metric__label">Valor total del inventario</p>
          <p className="card-metric__value">{formatCOP(valorTotal)}</p>
          <p className="card-metric__sub">Disponible × valor unitario</p>
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
                <th>Disponible</th>
                <th>Coste ud.</th>
                <th>Valor</th>
                <th>Ubicación</th>
                <th>Contenedor</th>
                <th>Actualizado</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.referencia_id}>
                  <td className="mono">{f.codigo_interno}</td>
                  <td className="mono">{f.sku ?? '—'}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFamilia(f.categoria), marginRight: 8 }} />
                    {f.nombre_producto}
                  </td>
                  <td>{f.formato}</td>
                  <td>{f.inv ? f.inv.cantidad_disponible : 0}</td>
                  <td>{formatCOP(costeConComision(f.coste_almacen_cop))}</td>
                  <td>{formatCOP((f.inv?.cantidad_disponible ?? 0) * (costeConComision(f.coste_almacen_cop) ?? 0))}</td>
                  <td>{f.inv?.ubicacion ?? '—'}</td>
                  <td>{f.inv?.contenedor ?? '—'}</td>
                  <td>{f.inv?.actualizado_at ? formatFechaHora(f.inv.actualizado_at) : '—'}</td>
                  {isAdmin && (
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
            <h2 className="t-heading" style={{ marginBottom: 'var(--sp-2)' }}>{editando.nombre_producto} · {editando.formato}</h2>
            <form className="form-grid" onSubmit={guardar}>
              <label className="field">
                <span className="field__label">Cantidad disponible</span>
                <input className="input" type="number" min="0" value={form.cantidad_disponible} onChange={(e) => setForm({ ...form, cantidad_disponible: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">Coste hasta almacén (COP)</span>
                <input className="input" type="number" min="0" value={form.coste} onChange={(e) => setForm({ ...form, coste: e.target.value })} />
              </label>
              <div className="field field--full">
                <span className="field__label">Tarifa base por canal (neto, sin IVA)</span>
                <div className="cluster cluster-3">
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Food Service</span>
                    <input className="input" type="number" min="0" value={form.precioFs} onChange={(e) => setForm({ ...form, precioFs: e.target.value })} />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Retail</span>
                    <input className="input" type="number" min="0" value={form.precioRetail} onChange={(e) => setForm({ ...form, precioRetail: e.target.value })} />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    <span className="t-caption">Industria</span>
                    <input className="input" type="number" min="0" value={form.precioIndustria} onChange={(e) => setForm({ ...form, precioIndustria: e.target.value })} />
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
              <div className="cluster cluster-3 field--full">
                <button className="btn btn-primary" type="submit">Guardar</button>
                <button className="btn btn-outline" type="button" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
