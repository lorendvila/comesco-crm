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

// Formato corto para dashboards: $177,8M · $27,8M · $950k
export function formatCOPcorto(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + 'M'
  if (abs >= 1e3) return '$' + (n / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 }) + 'k'
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

// Color por familia de producto (categoría). Tonos apagados que casan con la
// paleta (azul pizarra + arena). Se usan en gráficos, puntos de tabla, etc.
const COLOR_FAMILIA: Record<string, string> = {
  Aceite: '#D8C393',
  Aceitunas: '#A6B187',
  Vino: '#B98A96',
  Vinagre: '#CFA079',
  Tomate: '#C98A7E',
  Arroz: '#CDBE95',
  Queso: '#E2D9C6',
  Charcutería: '#B7A2AE',
}

export function colorFamilia(categoria: string | null): string {
  return (categoria && COLOR_FAMILIA[categoria]) || '#8FB0C4'
}

// Comisión estándar (%) que se suma al coste landed hasta almacén para obtener
// el coste real con el que se calcula el margen. Es un coste fijo de la
// compañía, igual para todos los clientes y canales.
export const COMISION_PCT = 5

// PAC (descuento de canal) por defecto de un pedido. El canal retail reserva un
// 10% que ya va incluido en su tarifa (columna J del maestro); food service e
// industria no llevan PAC. Un cliente con pac_descuento_pct pactado en sus
// condiciones sobrescribe este valor.
export function pacPorCanal(canal: string | null): number {
  return canal === 'retail' ? 10 : 0
}

// Coste real unitario NETO de una referencia: se le quita el IVA al coste del
// maestro (que lo lleva incluido) y se le suma la comisión.
// La comisión es "estilo margen" (col I del maestro = coste / (1 − 5%)), no un
// recargo del 5% sobre el coste, para que el margen del pedido reproduzca la
// columna L del Excel maestro al decimal.
export function costeRealNeto(costeAlmacenConIva: number | null, ivaPct: number): number | null {
  if (costeAlmacenConIva == null) return null
  return costeAlmacenConIva / (1 + ivaPct / 100) / (1 - COMISION_PCT / 100)
}

// Coste "de catálogo" de una referencia = columna I del maestro: coste hasta
// almacén CON IVA más la comisión de venta. Es lo que mostramos como "coste"
// en Inventario y en el valor de inventario del Dashboard.
export function costeConComision(costeAlmacenConIva: number | null): number | null {
  if (costeAlmacenConIva == null) return null
  return costeAlmacenConIva / (1 - COMISION_PCT / 100)
}

// Colores con significado (semánticos), para KPIs y estados.
export const COLOR_GOLD = '#D4C4A8'
export const COLOR_VERDE = '#A6B187' // cobrado / ok
export const COLOR_AMBAR = '#CFA079' // pendiente / atención
export const COLOR_AZUL = '#8FB0C4' // informativo
export const COLOR_GRIS = '#7C8794' // inactivo / cancelado

const COLOR_ESTADO_CLIENTE: Record<string, string> = {
  lead: COLOR_AZUL,
  activo: COLOR_VERDE,
  inactivo: COLOR_GRIS,
}
export function colorEstadoCliente(v: string): string {
  return COLOR_ESTADO_CLIENTE[v] ?? COLOR_GOLD
}

const COLOR_ESTADO_PEDIDO: Record<string, string> = {
  recibido: COLOR_AZUL,
  entregado: '#C9AE7E',
  facturado: COLOR_GOLD,
  cobrado: COLOR_VERDE,
  cancelado: COLOR_GRIS,
}
export function colorEstadoPedido(v: string): string {
  return COLOR_ESTADO_PEDIDO[v] ?? COLOR_GOLD
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
  { value: 'cobrado', label: 'Cobrado' },
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
