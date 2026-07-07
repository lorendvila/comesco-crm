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

export function labelDe(
  opciones: readonly { value: string; label: string }[],
  value: string | null,
): string {
  if (!value) return '—'
  return opciones.find((o) => o.value === value)?.label ?? value
}
