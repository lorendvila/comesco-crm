import { TareasPanel } from '../../components/TareasPanel'

export function TareasPage() {
  return (
    <div className="stack stack-6" style={{ maxWidth: 820 }}>
      <div>
        <h1 className="t-display">Tareas</h1>
        <p className="t-body-sm">Pendientes con fecha límite. Marca la casilla para completarlas.</p>
      </div>
      <TareasPanel />
    </div>
  )
}
