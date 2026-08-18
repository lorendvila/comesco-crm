export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
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
        Relationships: [
          {
            foreignKeyName: "actividades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actividades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      almacenes: {
        Row: {
          activo: boolean
          ciudad: string
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          ciudad: string
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          ciudad?: string
          created_at?: string | null
          id?: string
          nombre?: string
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
          email_facturacion: string | null
          estado: string
          id: string
          nit: string | null
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
          email_facturacion?: string | null
          estado?: string
          id?: string
          nit?: string | null
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
          email_facturacion?: string | null
          estado?: string
          id?: string
          nit?: string | null
          nombre?: string
          notas?: string | null
          pais?: string | null
          razon_social?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_comercial_asignado_id_fkey"
            columns: ["comercial_asignado_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicaciones: {
        Row: {
          asunto: string | null
          canal: string
          cliente_id: string
          created_at: string | null
          fecha: string | null
          id: string
          referencia_externa: string
        }
        Insert: {
          asunto?: string | null
          canal?: string
          cliente_id: string
          created_at?: string | null
          fecha?: string | null
          id?: string
          referencia_externa: string
        }
        Update: {
          asunto?: string | null
          canal?: string
          cliente_id?: string
          created_at?: string | null
          fecha?: string | null
          id?: string
          referencia_externa?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      condiciones_comerciales: {
        Row: {
          cliente_id: string
          comision_pct: number | null
          created_at: string | null
          id: string
          pac_descuento_pct: number | null
          plazo_pago_dias: number | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          comision_pct?: number | null
          created_at?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          comision_pct?: number | null
          created_at?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condiciones_comerciales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_estimada: {
        Row: {
          cantidad: number
          cliente_id: string
          created_at: string | null
          id: string
          origen: string
          periodo: string | null
          referencia_id: string
        }
        Insert: {
          cantidad: number
          cliente_id: string
          created_at?: string | null
          id?: string
          origen?: string
          periodo?: string | null
          referencia_id: string
        }
        Update: {
          cantidad?: number
          cliente_id?: string
          created_at?: string | null
          id?: string
          origen?: string
          periodo?: string | null
          referencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demanda_estimada_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demanda_estimada_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      importacion_anticipo_aplicaciones: {
        Row: {
          anticipo_id: string
          anulada_at: string | null
          anulada_por: string | null
          coste_id: string | null
          created_at: string | null
          created_by: string | null
          documento_id: string | null
          fecha: string | null
          id: string
          importe: number
          motivo_anulacion: string | null
          notas: string | null
        }
        Insert: {
          anticipo_id: string
          anulada_at?: string | null
          anulada_por?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          documento_id?: string | null
          fecha?: string | null
          id?: string
          importe: number
          motivo_anulacion?: string | null
          notas?: string | null
        }
        Update: {
          anticipo_id?: string
          anulada_at?: string | null
          anulada_por?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          documento_id?: string | null
          fecha?: string | null
          id?: string
          importe?: number
          motivo_anulacion?: string | null
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "importacion_anticipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_anticipo_id_fkey"
            columns: ["anticipo_id"]
            isOneToOne: false
            referencedRelation: "v_importacion_anticipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_anulada_por_fkey"
            columns: ["anulada_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_coste_id_fkey"
            columns: ["coste_id"]
            isOneToOne: false
            referencedRelation: "importacion_costes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipo_aplicaciones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "importacion_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      importacion_anticipos: {
        Row: {
          concepto: string | null
          coste_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          documento_id: string | null
          estado: string
          fecha_pago: string | null
          fecha_solicitud: string | null
          id: string
          importacion_id: string
          importe: number
          importe_cop: number | null
          importe_utilizado: number
          moneda: string
          notas: string | null
          operador_id: string | null
          tc: number | null
          updated_at: string | null
        }
        Insert: {
          concepto?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          documento_id?: string | null
          estado?: string
          fecha_pago?: string | null
          fecha_solicitud?: string | null
          id?: string
          importacion_id: string
          importe: number
          importe_cop?: number | null
          importe_utilizado?: number
          moneda?: string
          notas?: string | null
          operador_id?: string | null
          tc?: number | null
          updated_at?: string | null
        }
        Update: {
          concepto?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          documento_id?: string | null
          estado?: string
          fecha_pago?: string | null
          fecha_solicitud?: string | null
          id?: string
          importacion_id?: string
          importe?: number
          importe_cop?: number | null
          importe_utilizado?: number
          moneda?: string
          notas?: string | null
          operador_id?: string | null
          tc?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_anticipos_coste_id_fkey"
            columns: ["coste_id"]
            isOneToOne: false
            referencedRelation: "importacion_costes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "importacion_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      importacion_coste_reparto: {
        Row: {
          base_reparto: number | null
          coste_id: string
          created_at: string | null
          importacion_linea_id: string
          importe_estimado_cop: number | null
          importe_real_cop: number | null
          manual: boolean
          updated_at: string | null
        }
        Insert: {
          base_reparto?: number | null
          coste_id: string
          created_at?: string | null
          importacion_linea_id: string
          importe_estimado_cop?: number | null
          importe_real_cop?: number | null
          manual?: boolean
          updated_at?: string | null
        }
        Update: {
          base_reparto?: number | null
          coste_id?: string
          created_at?: string | null
          importacion_linea_id?: string
          importe_estimado_cop?: number | null
          importe_real_cop?: number | null
          manual?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_coste_reparto_coste_id_fkey"
            columns: ["coste_id"]
            isOneToOne: false
            referencedRelation: "importacion_costes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_coste_reparto_importacion_linea_id_fkey"
            columns: ["importacion_linea_id"]
            isOneToOne: false
            referencedRelation: "importacion_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_coste_reparto_importacion_linea_id_fkey"
            columns: ["importacion_linea_id"]
            isOneToOne: false
            referencedRelation: "v_importacion_landed"
            referencedColumns: ["linea_id"]
          },
        ]
      }
      importacion_costes: {
        Row: {
          capitalizable: boolean | null
          concepto: string | null
          created_at: string | null
          created_by: string | null
          criterio_reparto: string
          deleted_at: string | null
          documento_id: string | null
          fecha_devengo: string | null
          fecha_factura: string | null
          fecha_pago: string | null
          fecha_recuperacion_estimada: string | null
          fecha_recuperacion_real: string | null
          id: string
          importacion_id: string
          importe_estimado: number | null
          importe_estimado_cop: number | null
          importe_real: number | null
          importe_real_cop: number | null
          linea_directa_id: string | null
          moneda_estimado: string | null
          moneda_real: string | null
          observaciones: string | null
          operador_id: string | null
          referencia_id: string | null
          sin_coste_real: boolean
          tc_estimado: number | null
          tc_real: number | null
          tipo_coste_codigo: string
          updated_at: string | null
        }
        Insert: {
          capitalizable?: boolean | null
          concepto?: string | null
          created_at?: string | null
          created_by?: string | null
          criterio_reparto?: string
          deleted_at?: string | null
          documento_id?: string | null
          fecha_devengo?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_recuperacion_estimada?: string | null
          fecha_recuperacion_real?: string | null
          id?: string
          importacion_id: string
          importe_estimado?: number | null
          importe_estimado_cop?: number | null
          importe_real?: number | null
          importe_real_cop?: number | null
          linea_directa_id?: string | null
          moneda_estimado?: string | null
          moneda_real?: string | null
          observaciones?: string | null
          operador_id?: string | null
          referencia_id?: string | null
          sin_coste_real?: boolean
          tc_estimado?: number | null
          tc_real?: number | null
          tipo_coste_codigo: string
          updated_at?: string | null
        }
        Update: {
          capitalizable?: boolean | null
          concepto?: string | null
          created_at?: string | null
          created_by?: string | null
          criterio_reparto?: string
          deleted_at?: string | null
          documento_id?: string | null
          fecha_devengo?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_recuperacion_estimada?: string | null
          fecha_recuperacion_real?: string | null
          id?: string
          importacion_id?: string
          importe_estimado?: number | null
          importe_estimado_cop?: number | null
          importe_real?: number | null
          importe_real_cop?: number | null
          linea_directa_id?: string | null
          moneda_estimado?: string | null
          moneda_real?: string | null
          observaciones?: string | null
          operador_id?: string | null
          referencia_id?: string | null
          sin_coste_real?: boolean
          tc_estimado?: number | null
          tc_real?: number | null
          tipo_coste_codigo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_costes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "importacion_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_linea_directa_id_fkey"
            columns: ["linea_directa_id"]
            isOneToOne: false
            referencedRelation: "importacion_lineas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_linea_directa_id_fkey"
            columns: ["linea_directa_id"]
            isOneToOne: false
            referencedRelation: "v_importacion_landed"
            referencedColumns: ["linea_id"]
          },
          {
            foreignKeyName: "importacion_costes_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_costes_tipo_coste_codigo_fkey"
            columns: ["tipo_coste_codigo"]
            isOneToOne: false
            referencedRelation: "importacion_tipos_coste"
            referencedColumns: ["codigo"]
          },
        ]
      }
      importacion_documentos: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          estado: string
          fecha: string | null
          id: string
          importacion_id: string
          mime_type: string | null
          nombre_archivo: string | null
          notas: string | null
          operador_id: string | null
          reemplaza_a: string | null
          storage_bucket: string
          storage_path: string | null
          subido_por: string | null
          tamano_bytes: number | null
          tipo_codigo: string | null
          updated_at: string | null
          validado_at: string | null
          validado_por: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          importacion_id: string
          mime_type?: string | null
          nombre_archivo?: string | null
          notas?: string | null
          operador_id?: string | null
          reemplaza_a?: string | null
          storage_bucket?: string
          storage_path?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_codigo?: string | null
          updated_at?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          estado?: string
          fecha?: string | null
          id?: string
          importacion_id?: string
          mime_type?: string | null
          nombre_archivo?: string | null
          notas?: string | null
          operador_id?: string | null
          reemplaza_a?: string | null
          storage_bucket?: string
          storage_path?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo_codigo?: string | null
          updated_at?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_documentos_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_documentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_documentos_reemplaza_a_fkey"
            columns: ["reemplaza_a"]
            isOneToOne: false
            referencedRelation: "importacion_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_documentos_tipo_codigo_fkey"
            columns: ["tipo_codigo"]
            isOneToOne: false
            referencedRelation: "importacion_tipos_documento"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "importacion_documentos_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      importacion_lineas: {
        Row: {
          cajas: number | null
          cantidad_unidades: number
          created_at: string | null
          id: string
          importacion_id: string
          importe_mercancia: number | null
          moneda: string
          notas: string | null
          operador_proveedor_id: string | null
          pallets: number | null
          peso_kg: number | null
          precio_compra: number
          precio_compra_real: number | null
          referencia_id: string
          tc_estimado: number | null
          tc_real: number | null
          updated_at: string | null
          volumen_m3: number | null
        }
        Insert: {
          cajas?: number | null
          cantidad_unidades: number
          created_at?: string | null
          id?: string
          importacion_id: string
          importe_mercancia?: number | null
          moneda?: string
          notas?: string | null
          operador_proveedor_id?: string | null
          pallets?: number | null
          peso_kg?: number | null
          precio_compra: number
          precio_compra_real?: number | null
          referencia_id: string
          tc_estimado?: number | null
          tc_real?: number | null
          updated_at?: string | null
          volumen_m3?: number | null
        }
        Update: {
          cajas?: number | null
          cantidad_unidades?: number
          created_at?: string | null
          id?: string
          importacion_id?: string
          importe_mercancia?: number | null
          moneda?: string
          notas?: string | null
          operador_proveedor_id?: string | null
          pallets?: number | null
          peso_kg?: number | null
          precio_compra?: number
          precio_compra_real?: number | null
          referencia_id?: string
          tc_estimado?: number | null
          tc_real?: number | null
          updated_at?: string | null
          volumen_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_lineas_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_lineas_operador_proveedor_id_fkey"
            columns: ["operador_proveedor_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_lineas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      importacion_operadores: {
        Row: {
          created_at: string | null
          importacion_id: string
          notas: string | null
          operador_id: string
          rol_codigo: string
        }
        Insert: {
          created_at?: string | null
          importacion_id: string
          notas?: string | null
          operador_id: string
          rol_codigo: string
        }
        Update: {
          created_at?: string | null
          importacion_id?: string
          notas?: string | null
          operador_id?: string
          rol_codigo?: string
        }
        Relationships: [
          {
            foreignKeyName: "importacion_operadores_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_operadores_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_operadores_rol_codigo_fkey"
            columns: ["rol_codigo"]
            isOneToOne: false
            referencedRelation: "operador_tipos_rol"
            referencedColumns: ["codigo"]
          },
        ]
      }
      importacion_tipos_coste: {
        Row: {
          activo: boolean
          capitalizable: boolean
          codigo: string
          criterio_reparto_default: string
          naturaleza: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean
          capitalizable?: boolean
          codigo: string
          criterio_reparto_default?: string
          naturaleza?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean
          capitalizable?: boolean
          codigo?: string
          criterio_reparto_default?: string
          naturaleza?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      importacion_tipos_documento: {
        Row: {
          activo: boolean
          codigo: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      importaciones: {
        Row: {
          almacen_destino_id: string | null
          bl: string | null
          booking: string | null
          codigo: string | null
          contenedor: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          destino: string | null
          estado_coste: string
          estado_logistico: string
          eta_prevista: string | null
          eta_real: string | null
          etd_prevista: string | null
          etd_real: string | null
          id: string
          incoterm: string | null
          modalidad_transporte: string | null
          moneda: string
          observaciones: string | null
          origen: string | null
          tc_presupuestado: number | null
          updated_at: string | null
        }
        Insert: {
          almacen_destino_id?: string | null
          bl?: string | null
          booking?: string | null
          codigo?: string | null
          contenedor?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          destino?: string | null
          estado_coste?: string
          estado_logistico?: string
          eta_prevista?: string | null
          eta_real?: string | null
          etd_prevista?: string | null
          etd_real?: string | null
          id?: string
          incoterm?: string | null
          modalidad_transporte?: string | null
          moneda?: string
          observaciones?: string | null
          origen?: string | null
          tc_presupuestado?: number | null
          updated_at?: string | null
        }
        Update: {
          almacen_destino_id?: string | null
          bl?: string | null
          booking?: string | null
          codigo?: string | null
          contenedor?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          destino?: string | null
          estado_coste?: string
          estado_logistico?: string
          eta_prevista?: string | null
          eta_real?: string | null
          etd_prevista?: string | null
          etd_real?: string | null
          id?: string
          incoterm?: string | null
          modalidad_transporte?: string | null
          moneda?: string
          observaciones?: string | null
          origen?: string | null
          tc_presupuestado?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importaciones_almacen_destino_id_fkey"
            columns: ["almacen_destino_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importaciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario: {
        Row: {
          actualizado_at: string | null
          almacen_id: string
          cantidad_disponible: number
          contenedor: string | null
          created_at: string | null
          id: string
          notas: string | null
          referencia_id: string
          ubicacion: string | null
        }
        Insert: {
          actualizado_at?: string | null
          almacen_id: string
          cantidad_disponible?: number
          contenedor?: string | null
          created_at?: string | null
          id?: string
          notas?: string | null
          referencia_id: string
          ubicacion?: string | null
        }
        Update: {
          actualizado_at?: string | null
          almacen_id?: string
          cantidad_disponible?: number
          contenedor?: string | null
          created_at?: string | null
          id?: string
          notas?: string | null
          referencia_id?: string
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventario_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      operador_documentos: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          estado: string
          fecha_caducidad: string | null
          fecha_emision: string | null
          id: string
          mime_type: string | null
          nombre_archivo: string | null
          notas: string | null
          operador_id: string
          reemplaza_a: string | null
          storage_bucket: string
          storage_path: string | null
          subido_por: string | null
          tamano_bytes: number | null
          tipo: string | null
          updated_at: string | null
          validado_at: string | null
          validado_por: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          estado?: string
          fecha_caducidad?: string | null
          fecha_emision?: string | null
          id?: string
          mime_type?: string | null
          nombre_archivo?: string | null
          notas?: string | null
          operador_id: string
          reemplaza_a?: string | null
          storage_bucket?: string
          storage_path?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo?: string | null
          updated_at?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          estado?: string
          fecha_caducidad?: string | null
          fecha_emision?: string | null
          id?: string
          mime_type?: string | null
          nombre_archivo?: string | null
          notas?: string | null
          operador_id?: string
          reemplaza_a?: string | null
          storage_bucket?: string
          storage_path?: string | null
          subido_por?: string | null
          tamano_bytes?: number | null
          tipo?: string | null
          updated_at?: string | null
          validado_at?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operador_documentos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operador_documentos_reemplaza_a_fkey"
            columns: ["reemplaza_a"]
            isOneToOne: false
            referencedRelation: "operador_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operador_documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operador_documentos_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operador_roles: {
        Row: {
          created_at: string | null
          operador_id: string
          rol_codigo: string
        }
        Insert: {
          created_at?: string | null
          operador_id: string
          rol_codigo: string
        }
        Update: {
          created_at?: string | null
          operador_id?: string
          rol_codigo?: string
        }
        Relationships: [
          {
            foreignKeyName: "operador_roles_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operador_roles_rol_codigo_fkey"
            columns: ["rol_codigo"]
            isOneToOne: false
            referencedRelation: "operador_tipos_rol"
            referencedColumns: ["codigo"]
          },
        ]
      }
      operador_tipos_rol: {
        Row: {
          activo: boolean
          codigo: string
          nombre: string
          orden: number | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          nombre: string
          orden?: number | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      operadores: {
        Row: {
          activo: boolean
          created_at: string | null
          email: string | null
          id: string
          nit: string | null
          nombre: string
          notas: string | null
          pais: string | null
          telefono: string | null
          updated_at: string | null
          web: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          email?: string | null
          id?: string
          nit?: string | null
          nombre: string
          notas?: string | null
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
          web?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          email?: string | null
          id?: string
          nit?: string | null
          nombre?: string
          notas?: string | null
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
          web?: string | null
        }
        Relationships: []
      }
      oportunidad_lineas: {
        Row: {
          cantidad: number
          created_at: string | null
          descuento_pct: number | null
          id: string
          oportunidad_id: string
          precio_estimado_cop: number | null
          referencia_id: string
          subtotal_cop: number | null
          unidad: string
          updated_at: string | null
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          descuento_pct?: number | null
          id?: string
          oportunidad_id: string
          precio_estimado_cop?: number | null
          referencia_id: string
          subtotal_cop?: number | null
          unidad?: string
          updated_at?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          descuento_pct?: number | null
          id?: string
          oportunidad_id?: string
          precio_estimado_cop?: number | null
          referencia_id?: string
          subtotal_cop?: number | null
          unidad?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidad_lineas_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidad_lineas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          cliente_id: string
          comision_pct: number | null
          created_at: string | null
          deleted_at: string | null
          etapa: string
          fecha_cierre: string | null
          fecha_inicio_suministro: string | null
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
          deleted_at?: string | null
          etapa?: string
          fecha_cierre?: string | null
          fecha_inicio_suministro?: string | null
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
          deleted_at?: string | null
          etapa?: string
          fecha_cierre?: string | null
          fecha_inicio_suministro?: string | null
          id?: string
          pac_descuento_pct?: number | null
          plazo_pago_dias?: number | null
          probabilidad_cierre?: number | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_lineas: {
        Row: {
          almacen_id: string | null
          cantidad: number
          created_at: string | null
          descuento_pct: number | null
          id: string
          pedido_id: string
          precio_base_cop: number | null
          precio_unitario_cop: number | null
          referencia_id: string
          subtotal_cop: number | null
          unidad: string
        }
        Insert: {
          almacen_id?: string | null
          cantidad: number
          created_at?: string | null
          descuento_pct?: number | null
          id?: string
          pedido_id: string
          precio_base_cop?: number | null
          precio_unitario_cop?: number | null
          referencia_id: string
          subtotal_cop?: number | null
          unidad?: string
        }
        Update: {
          almacen_id?: string | null
          cantidad?: number
          created_at?: string | null
          descuento_pct?: number | null
          id?: string
          pedido_id?: string
          precio_base_cop?: number | null
          precio_unitario_cop?: number | null
          referencia_id?: string
          subtotal_cop?: number | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_lineas_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_lineas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_lineas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          almacen_id: string | null
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
          nota_credito_fecha: string | null
          nota_credito_numero: string | null
          notas: string | null
          numero_factura: string | null
          numero_pedido: string | null
          pagado: number | null
          total_cop: number | null
          updated_at: string | null
          valor_factura: number | null
        }
        Insert: {
          almacen_id?: string | null
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
          nota_credito_fecha?: string | null
          nota_credito_numero?: string | null
          notas?: string | null
          numero_factura?: string | null
          numero_pedido?: string | null
          pagado?: number | null
          total_cop?: number | null
          updated_at?: string | null
          valor_factura?: number | null
        }
        Update: {
          almacen_id?: string | null
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
          nota_credito_fecha?: string | null
          nota_credito_numero?: string | null
          notas?: string | null
          numero_factura?: string | null
          numero_pedido?: string | null
          pagado?: number | null
          total_cop?: number | null
          updated_at?: string | null
          valor_factura?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_almacen_id_fkey"
            columns: ["almacen_id"]
            isOneToOne: false
            referencedRelation: "almacenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      referencia_costes: {
        Row: {
          coste_almacen_cop: number | null
          referencia_id: string
          updated_at: string | null
        }
        Insert: {
          coste_almacen_cop?: number | null
          referencia_id: string
          updated_at?: string | null
        }
        Update: {
          coste_almacen_cop?: number | null
          referencia_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referencia_costes_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: true
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      referencias: {
        Row: {
          cajas_por_palet: number | null
          categoria: string | null
          codigo_facturacion_externo: string | null
          codigo_interno: string
          created_at: string | null
          deleted_at: string | null
          es_servicio: boolean
          formato: string
          id: string
          iva_pct: number
          nombre_producto: string
          precio_food_service_cop: number | null
          precio_industria_cop: number | null
          precio_retail_cop: number | null
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
          es_servicio?: boolean
          formato: string
          id?: string
          iva_pct?: number
          nombre_producto: string
          precio_food_service_cop?: number | null
          precio_industria_cop?: number | null
          precio_retail_cop?: number | null
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
          es_servicio?: boolean
          formato?: string
          id?: string
          iva_pct?: number
          nombre_producto?: string
          precio_food_service_cop?: number | null
          precio_industria_cop?: number | null
          precio_retail_cop?: number | null
          proveedor?: string | null
          sku?: string | null
          unidad?: string
          unidades_por_caja?: number | null
          unidades_por_palet?: number | null
          updated_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "tareas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_cambio: {
        Row: {
          created_at: string | null
          fecha: string
          fuente: string | null
          id: string
          par: string
          tipo: number
        }
        Insert: {
          created_at?: string | null
          fecha: string
          fuente?: string | null
          id?: string
          par?: string
          tipo: number
        }
        Update: {
          created_at?: string | null
          fecha?: string
          fuente?: string | null
          id?: string
          par?: string
          tipo?: number
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
    Views: {
      v_importacion_anticipos: {
        Row: {
          concepto: string | null
          coste_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          documento_id: string | null
          estado: string | null
          fecha_pago: string | null
          fecha_solicitud: string | null
          grado_aplicacion: string | null
          id: string | null
          importacion_id: string | null
          importe: number | null
          importe_cop: number | null
          importe_utilizado: number | null
          moneda: string | null
          notas: string | null
          operador_id: string | null
          saldo: number | null
          saldo_cop: number | null
          tc: number | null
          updated_at: string | null
        }
        Insert: {
          concepto?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          documento_id?: string | null
          estado?: string | null
          fecha_pago?: string | null
          fecha_solicitud?: string | null
          grado_aplicacion?: never
          id?: string | null
          importacion_id?: string | null
          importe?: number | null
          importe_cop?: number | null
          importe_utilizado?: number | null
          moneda?: string | null
          notas?: string | null
          operador_id?: string | null
          saldo?: never
          saldo_cop?: never
          tc?: number | null
          updated_at?: string | null
        }
        Update: {
          concepto?: string | null
          coste_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          documento_id?: string | null
          estado?: string | null
          fecha_pago?: string | null
          fecha_solicitud?: string | null
          grado_aplicacion?: never
          id?: string | null
          importacion_id?: string | null
          importe?: number | null
          importe_cop?: number | null
          importe_utilizado?: number | null
          moneda?: string | null
          notas?: string | null
          operador_id?: string | null
          saldo?: never
          saldo_cop?: never
          tc?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_anticipos_coste_id_fkey"
            columns: ["coste_id"]
            isOneToOne: false
            referencedRelation: "importacion_costes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "importacion_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_anticipos_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_importacion_landed: {
        Row: {
          cantidad_unidades: number | null
          costes_est_cop: number | null
          costes_prov_cop: number | null
          costes_real_cop: number | null
          importacion_id: string | null
          landed_est_cop: number | null
          landed_prov_cop: number | null
          landed_prov_unitario: number | null
          landed_real_cop: number | null
          linea_id: string | null
          mercancia_est_cop: number | null
          mercancia_prov_cop: number | null
          mercancia_real_cop: number | null
          moneda: string | null
          prov_desde_estimado_cop: number | null
          referencia_id: string | null
          tc_efectivo_est: number | null
          tc_origen_est: string | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_lineas_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_lineas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
      v_importacion_landed_sku: {
        Row: {
          importacion_id: string | null
          landed_est_cop: number | null
          landed_prov_cop: number | null
          landed_prov_unitario: number | null
          landed_real_cop: number | null
          prov_desde_estimado_cop: number | null
          referencia_id: string | null
          unidades: number | null
        }
        Relationships: [
          {
            foreignKeyName: "importacion_lineas_importacion_id_fkey"
            columns: ["importacion_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "importacion_lineas_referencia_id_fkey"
            columns: ["referencia_id"]
            isOneToOne: false
            referencedRelation: "referencias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_role: { Args: never; Returns: string }
      can_access_importaciones: { Args: never; Returns: boolean }
      can_manage_clientes: { Args: never; Returns: boolean }
      can_manage_facturacion: { Args: never; Returns: boolean }
      can_manage_importaciones: { Args: never; Returns: boolean }
      can_manage_importaciones_config: { Args: never; Returns: boolean }
      can_manage_inventario: { Args: never; Returns: boolean }
      can_manage_pedidos: { Args: never; Returns: boolean }
      can_manage_privileged: { Args: never; Returns: boolean }
      can_manage_referencias: { Args: never; Returns: boolean }
      can_manage_users: { Args: never; Returns: boolean }
      can_read_all: { Args: never; Returns: boolean }
      can_see_costs: { Args: never; Returns: boolean }
      current_user_id: { Args: never; Returns: string }
      importacion_costes_resueltos: {
        Args: { p_importacion_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: never; Returns: boolean }
      pedido_consume_stock: { Args: { est: string }; Returns: boolean }
      recalcular_reparto: {
        Args: { p_importacion_id: string }
        Returns: undefined
      }
      reconciliar_costes: {
        Args: { p_importacion_id: string }
        Returns: {
          coste_id: string
          esperado_est: number
          esperado_real: number
          suma_est: number
          suma_real: number
          tipo: string
        }[]
      }
      siguiente_codigo_importacion: { Args: never; Returns: string }
      siguiente_numero_pedido: { Args: never; Returns: string }
      tc_efectivo: {
        Args: { p_moneda: string; p_tc_cabecera: number; p_tc_linea: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
