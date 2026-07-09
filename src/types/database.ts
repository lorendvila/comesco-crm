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
          razon_social: string | null
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
          razon_social?: string | null
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
          razon_social?: string | null
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
      pedidos: {
        Row: {
          canal_origen: string
          cliente_id: string
          codigo_facturacion_externo: string | null
          created_at: string | null
          estado: string
          fecha_entrega: string | null
          fecha_factura: string | null
          fecha_pago: string | null
          fecha_pedido: string
          fecha_vencimiento: string | null
          id: string
          notas: string | null
          numero_factura: string | null
          pagado: number | null
          total_cop: number | null
          updated_at: string | null
          valor_factura: number | null
        }
        Insert: {
          canal_origen?: string
          cliente_id: string
          codigo_facturacion_externo?: string | null
          created_at?: string | null
          estado?: string
          fecha_entrega?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_pedido?: string
          fecha_vencimiento?: string | null
          id?: string
          notas?: string | null
          numero_factura?: string | null
          pagado?: number | null
          total_cop?: number | null
          updated_at?: string | null
          valor_factura?: number | null
        }
        Update: {
          canal_origen?: string
          cliente_id?: string
          codigo_facturacion_externo?: string | null
          created_at?: string | null
          estado?: string
          fecha_entrega?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_pedido?: string
          fecha_vencimiento?: string | null
          id?: string
          notas?: string | null
          numero_factura?: string | null
          pagado?: number | null
          total_cop?: number | null
          updated_at?: string | null
          valor_factura?: number | null
        }
        Relationships: []
      }
      pedido_lineas: {
        Row: {
          cantidad: number
          created_at: string | null
          id: string
          pedido_id: string
          precio_unitario_cop: number | null
          referencia_id: string
          subtotal_cop: number | null
          unidad: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          id?: string
          pedido_id: string
          precio_unitario_cop?: number | null
          referencia_id: string
          subtotal_cop?: number | null
          unidad?: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          pedido_id?: string
          precio_unitario_cop?: number | null
          referencia_id?: string
          subtotal_cop?: number | null
          unidad?: string
        }
        Relationships: []
      }
      referencias: {
        Row: {
          cajas_por_palet: number | null
          categoria: string | null
          codigo_facturacion_externo: string | null
          codigo_interno: string
          created_at: string | null
          deleted_at: string | null
          formato: string
          id: string
          iva_pct: number
          nombre_producto: string
          proveedor: string | null
          sku: string | null
          unidad: string
          unidades_por_caja: number | null
          unidades_por_palet: number | null
          updated_at: string | null
        }
        Insert: {
          cajas_por_palet?: number | null
          categoria?: string | null
          codigo_facturacion_externo?: string | null
          codigo_interno?: string
          created_at?: string | null
          deleted_at?: string | null
          formato: string
          id?: string
          iva_pct?: number
          nombre_producto: string
          proveedor?: string | null
          sku?: string | null
          unidad?: string
          unidades_por_caja?: number | null
          unidades_por_palet?: number | null
          updated_at?: string | null
        }
        Update: {
          cajas_por_palet?: number | null
          categoria?: string | null
          codigo_facturacion_externo?: string | null
          codigo_interno?: string
          created_at?: string | null
          deleted_at?: string | null
          formato?: string
          id?: string
          iva_pct?: number
          nombre_producto?: string
          proveedor?: string | null
          sku?: string | null
          unidad?: string
          unidades_por_caja?: number | null
          unidades_por_palet?: number | null
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
