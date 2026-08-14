import { supabase } from '../lib/supabase'

// Capa de datos MÍNIMA de la Fase I-0 de Importaciones: solo lecturas de los
// catálogos ya sembrados y de operadores. La operativa (importaciones, líneas,
// costes, recepciones...) llega en fases posteriores.

export interface TipoCoste {
  codigo: string
  nombre: string
  capitalizable: boolean
  naturaleza: string
  criterio_reparto_default: string
  activo: boolean
  orden: number | null
}

export interface TipoRolOperador {
  codigo: string
  nombre: string
  activo: boolean
  orden: number | null
}

export interface Operador {
  id: string
  nombre: string
  nit: string | null
  pais: string | null
  activo: boolean
}

// Conceptos de coste activos (catálogo). Por RLS, un comercial recibe [].
export async function listTiposCoste(): Promise<TipoCoste[]> {
  const { data, error } = await supabase
    .from('importacion_tipos_coste')
    .select('codigo, nombre, capitalizable, naturaleza, criterio_reparto_default, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .returns<TipoCoste[]>()
  if (error) throw error
  return data ?? []
}

// Roles de operador activos (catálogo). Por RLS, un comercial recibe [].
export async function listTiposRolOperador(): Promise<TipoRolOperador[]> {
  const { data, error } = await supabase
    .from('operador_tipos_rol')
    .select('codigo, nombre, activo, orden')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .returns<TipoRolOperador[]>()
  if (error) throw error
  return data ?? []
}

// Operadores activos. Por RLS, un comercial recibe [].
export async function listOperadores(): Promise<Operador[]> {
  const { data, error } = await supabase
    .from('operadores')
    .select('id, nombre, nit, pais, activo')
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .returns<Operador[]>()
  if (error) throw error
  return data ?? []
}
