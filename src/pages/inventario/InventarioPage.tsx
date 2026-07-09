import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { listInventario, upsertInventario } from '../../data/inventario'
import type { InventarioFila } from '../../data/inventario'
import { formatCOP, formatFechaHora } from '../../data/constants'

interface FormState {
  cantidad_disponible: string
  ubicacion: string
  contenedor: string
  valor_unitario: string
  notas: string
}

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
  const [form, setForm] = useState<FormState>({ cantidad_disponible: '', ubicacion: '', contenedor: '', valor_unitario: '', notas: '' })

  const cargar = () => {
    setLoading(true)
    listInventario()
      .then(setFilas)
      .catch(() => setError('No se pudo cargar el inventario.'))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const valorTotal = useMemo(
    () => filas.reduce((s, f) => s + (f.inv ? f.inv.cantidad_disponible * (f.inv.valor_unitario_cop ?? 0) : 0), 0),
    [filas],
  )

  const abrir = (f: InventarioFila) => {
    setForm({
      cantidad_disponible: f.inv ? String(f.inv.cantidad_disponible) : '',
      ubicacion: f.inv?.ubicacion ?? '',
      contenedor: f.inv?.contenedor ?? '',
      valor_unitario: f.inv?.valor_unitario_cop == null ? '' : String(f.inv.valor_unitario_cop),
      notas: f.inv?.notas ?? '',
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
        valor_unitario_cop: form.valor_unitario === '' ? null : num(form.valor_unitario),
        notas: form.notas.trim() || null,
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
                  <td>{f.nombre_producto}</td>
                  <td>{f.formato}</td>
                  <td>{f.inv ? f.inv.cantidad_disponible : 0}</td>
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
                <span className="field__label">Valor unitario (COP)</span>
                <input className="input" type="number" min="0" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} />
              </label>
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
