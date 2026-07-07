// Opciones de negocio compartidas por los formularios y las etiquetas.

export const CANALES = [
  { value: 'retail', label: 'Retail' },
  { value: 'food_service', label: 'Food service' },
  { value: 'industria', label: 'Industria' },
] as const

export const ESTADOS = [
  { value: 'lead', label: 'Lead' },
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
] as const

export const ETAPAS = [
  { value: 'prospeccion', label: 'Prospección' },
  { value: 'negociacion', label: 'Negociación' },
  { value: 'cierre_ganado', label: 'Ganado' },
  { value: 'cierre_perdido', label: 'Perdido' },
] as const

// Etapas "vivas" que cuentan para la proyección de facturación.
export const ETAPAS_ABIERTAS: string[] = ['prospeccion', 'negociacion']

export function labelDe(
  opciones: readonly { value: string; label: string }[],
  value: string | null,
): string {
  if (!value) return '—'
  return opciones.find((o) => o.value === value)?.label ?? value
}

const copFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatCOP(n: number | null | undefined): string {
  if (n == null) return '—'
  return copFmt.format(n)
}
