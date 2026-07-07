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

export const TIPOS_ACTIVIDAD = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'email', label: 'Email' },
  { value: 'visita', label: 'Visita' },
  { value: 'comentario', label: 'Comentario' },
  { value: 'otro', label: 'Otro' },
] as const

export const ESTADOS_ACTIVIDAD = [
  { value: 'realizada', label: 'Realizada' },
  { value: 'programada', label: 'Programada' },
] as const

export const CANALES_ORIGEN = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'visita', label: 'Visita' },
  { value: 'otro', label: 'Otro' },
] as const

export const ESTADOS_PEDIDO = [
  { value: 'recibido', label: 'Recibido' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'facturado', label: 'Facturado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const

const dtFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
const dFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })

// Fecha + hora (para timestamptz, p. ej. actividades.fecha)
export function formatFechaHora(iso: string | null): string {
  if (!iso) return '—'
  return dtFmt.format(new Date(iso))
}

// Solo fecha (para columnas DATE, p. ej. tareas.fecha_limite = "YYYY-MM-DD")
export function formatFecha(fecha: string | null): string {
  if (!fecha) return '—'
  return dFmt.format(new Date(fecha + 'T00:00:00'))
}
