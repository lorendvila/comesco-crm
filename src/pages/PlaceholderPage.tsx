export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder">
      <div className="ld-firma ld-firma--sm"></div>
      <h1 className="t-display">{title}</h1>
      <p className="t-body-sm">Este módulo se construirá próximamente.</p>
    </div>
  )
}
