export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      actividades: {
        Row: {
          cliente_id: string
          created_at: string | null
          estado: string
          fecha: string | null
          id: string
          notas: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          notas?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          notas?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          canal: string | null
          ciudad: string | null
          codigo_facturacion_externo: string | null
          codigo_interno: string
          comercial_asignado_id: string | null
          created_at: string | null
          deleted_at: string | null
          direccion_entrega: string | null
          estado: string
          id: string
          nombre: string
          notas: string | null
          pais: string | null
          updated_at: string | null
        }
        Insert: {
          canal?: string | null
          ciudad?: string | null
          codigo_facturacion_externo?: string | null
          codigo_interno?: string
          comercial_asignado_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion_entrega?: string | null
          estado?: string
          id?: string
          nombre: string
          notas?: string | null
          pais?: string | null
          updated_at?: string | null
        }
        Update: {
          canal?: string | null
          ciudad?: string | null
          codigo_facturacion_externo?: string | null
          codigo_interno?: string
          comercial_asignado_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          direccion_entrega?: string | null
          estado?: string
          id?: string
          nombre?: string
          notas?: string | null
          pais?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contactos_cliente: {
        Row: {
          cargo: string | null
          cliente_id: string
          created_at: string | null
          email: string | null
          es_principal: boolean | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id: string
          created_at?: string | null
          email?: string | null
          es_principal?: boolean | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: string
          created_at?: string | null
          email?: string | null
          es_principal?: boolean | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      condiciones_comerciales: {
        Row: {
          cliente_id: string
          comision_pct: number | null
          created_at: string | null
          id: string
          pac_descuento_pct: number | null
          plazo_pago_dias: number | null
          precio_especial: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          comision_pct?: number | null
          created_at?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          precio_especial?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          comision_pct?: number | null
          created_at?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          precio_especial?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          cliente_id: string
          comision_pct: number | null
          created_at: string | null
          etapa: string
          fecha_cierre: string | null
          id: string
          pac_descuento_pct: number | null
          plazo_pago_dias: number | null
          probabilidad_cierre: number | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          cliente_id: string
          comision_pct?: number | null
          created_at?: string | null
          etapa?: string
          fecha_cierre?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          probabilidad_cierre?: number | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string
          comision_pct?: number | null
          created_at?: string | null
          etapa?: string
          fecha_cierre?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          probabilidad_cierre?: number | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      tareas: {
        Row: {
          cliente_id: string
          created_at: string | null
          descripcion: string
          estado: string | null
          fecha_limite: string | null
          id: string
          oportunidad_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descripcion: string
          estado?: string | null
          fecha_limite?: string | null
          id?: string
          oportunidad_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descripcion?: string
          estado?: string | null
          fecha_limite?: string | null
          id?: string
          oportunidad_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
