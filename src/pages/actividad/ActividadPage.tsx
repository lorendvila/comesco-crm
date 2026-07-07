import { ActividadPanel } from '../../components/ActividadPanel'

export function ActividadPage() {
  return (
    <div className="stack stack-6" style={{ maxWidth: 820 }}>
      <div>
        <h1 className="t-display">Actividad</h1>
        <p className="t-body-sm">Log de seguimiento: lo hecho y lo programado, ordenado por fecha.</p>
      </div>
      <ActividadPanel />
    </div>
  )
}
