import type { ReactNode } from 'react'

// Badge con color opcional (borde + texto). Sin color = arena por defecto.
export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="badge" style={color ? { color, borderColor: color } : undefined}>
      {children}
    </span>
  )
}
