-- =====================================================================
-- COMESCO CRM — Esquema inicial (Fase 1)
-- 13 tablas + índices. Single-tenant (COMESCO es la única organización).
-- La seguridad (RLS) vive en 0002_rls.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users — usuarios internos (mapea 1:1 con auth.users de Supabase)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'comercial' CHECK (role IN ('admin','comercial')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. clientes — clientes / leads (ficha central)
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  canal VARCHAR(20) CHECK (canal IN ('retail','food_service','industria')), -- NULL = lead sin definir
  estado VARCHAR(20) NOT NULL DEFAULT 'lead' CHECK (estado IN ('lead','activo','inactivo')),
  comercial_asignado_id UUID REFERENCES users(id) ON DELETE SET NULL,       -- NULL = sin asignar
  ciudad VARCHAR(100),
  pais VARCHAR(100) DEFAULT 'Colombia',
  direccion_entrega TEXT,
  codigo_facturacion_externo VARCHAR(50),  -- reservado para futura integración DIAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_clientes_comercial ON clientes(comercial_asignado_id);
CREATE INDEX idx_clientes_canal ON clientes(canal);
CREATE INDEX idx_clientes_estado ON clientes(estado);

-- ---------------------------------------------------------------------
-- 3. contactos_cliente — personas de contacto de cada cliente
-- ---------------------------------------------------------------------
CREATE TABLE contactos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  telefono VARCHAR(50),
  email VARCHAR(255),
  es_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contactos_cliente ON contactos_cliente(cliente_id);

-- ---------------------------------------------------------------------
-- 4. referencias — catálogo de productos (producto + formato)
-- ---------------------------------------------------------------------
CREATE TABLE referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_producto VARCHAR(255) NOT NULL,
  formato VARCHAR(100) NOT NULL,
  categoria VARCHAR(100),
  proveedor VARCHAR(255),
  unidad VARCHAR(20) NOT NULL DEFAULT 'cajas',
  unidades_por_caja INTEGER,
  cajas_por_palet INTEGER,
  unidades_por_palet INTEGER,
  codigo_facturacion_externo VARCHAR(50),  -- reservado para futura integración DIAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- 5. condiciones_comerciales — condiciones negociadas por cliente
-- ---------------------------------------------------------------------
CREATE TABLE condiciones_comerciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plazo_pago_dias INTEGER,
  comision_pct DECIMAL(5,2),
  pac_descuento_pct DECIMAL(5,2),
  precio_especial DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_condiciones_cliente ON condiciones_comerciales(cliente_id);

-- ---------------------------------------------------------------------
-- 6. oportunidades — pipeline de ventas
--    (+ probabilidad_cierre, comision_pct, pac_descuento_pct, plazo_pago_dias)
-- ---------------------------------------------------------------------
CREATE TABLE oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  etapa VARCHAR(30) NOT NULL DEFAULT 'prospeccion'
    CHECK (etapa IN ('prospeccion','negociacion','cierre_ganado','cierre_perdido')),
  probabilidad_cierre INTEGER CHECK (probabilidad_cierre BETWEEN 0 AND 100), -- % editable en el tiempo
  valor_estimado DECIMAL(12,2),        -- total (suma de líneas o ajuste manual)
  comision_pct DECIMAL(5,2),           -- opcional, a nivel de oportunidad
  pac_descuento_pct DECIMAL(5,2),      -- opcional
  plazo_pago_dias INTEGER,             -- opcional
  fecha_cierre DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX idx_oportunidades_etapa ON oportunidades(etapa);

-- ---------------------------------------------------------------------
-- 7. oportunidad_lineas — volumen/valor por referencia dentro de una oportunidad
-- ---------------------------------------------------------------------
CREATE TABLE oportunidad_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id UUID NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  referencia_id UUID NOT NULL REFERENCES referencias(id) ON DELETE RESTRICT, -- no borrar producto usado
  cantidad DECIMAL(12,2) NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'cajas',  -- cajas / unidades
  precio_estimado_cop DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_oportunidad_lineas_oportunidad ON oportunidad_lineas(oportunidad_id);
CREATE INDEX idx_oportunidad_lineas_referencia ON oportunidad_lineas(referencia_id);

-- ---------------------------------------------------------------------
-- 8. actividades — log de seguimiento (realizado y programado)
-- ---------------------------------------------------------------------
CREATE TABLE actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('llamada','email','visita','comentario','otro')),
  fecha TIMESTAMPTZ DEFAULT NOW(),  -- puede ser futura (acción programada)
  estado VARCHAR(20) NOT NULL DEFAULT 'realizada' CHECK (estado IN ('realizada','programada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_actividades_cliente ON actividades(cliente_id, fecha DESC);

-- ---------------------------------------------------------------------
-- 9. tareas
-- ---------------------------------------------------------------------
CREATE TABLE tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  fecha_limite DATE,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','completada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tareas_cliente ON tareas(cliente_id);

-- ---------------------------------------------------------------------
-- 10. comunicaciones — referencia a Gmail (no copia el contenido)
-- ---------------------------------------------------------------------
CREATE TABLE comunicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  canal VARCHAR(30) NOT NULL DEFAULT 'gmail',
  referencia_externa TEXT NOT NULL,  -- ID o enlace del email en Gmail
  asunto VARCHAR(255),
  fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comunicaciones_cliente ON comunicaciones(cliente_id);

-- ---------------------------------------------------------------------
-- 11. demanda_estimada — solo INTENCIÓN (el histórico real sale de pedidos)
-- ---------------------------------------------------------------------
CREATE TABLE demanda_estimada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  referencia_id UUID NOT NULL REFERENCES referencias(id) ON DELETE CASCADE,
  cantidad DECIMAL(12,2) NOT NULL,
  origen VARCHAR(20) NOT NULL DEFAULT 'intencion' CHECK (origen IN ('intencion','historico')),
  periodo VARCHAR(20),  -- ej. "2026-Q3"
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_demanda_cliente ON demanda_estimada(cliente_id);
CREATE INDEX idx_demanda_referencia ON demanda_estimada(referencia_id);

-- ---------------------------------------------------------------------
-- 12. pedidos — pedidos reales (registro manual; sin integración WhatsApp)
-- ---------------------------------------------------------------------
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  canal_origen VARCHAR(30) NOT NULL DEFAULT 'whatsapp'
    CHECK (canal_origen IN ('whatsapp','email','telefono','visita','otro')),
  estado VARCHAR(20) NOT NULL DEFAULT 'recibido'
    CHECK (estado IN ('recibido','entregado','facturado','cancelado')),
  total_cop DECIMAL(14,2),  -- suma de líneas o ajuste manual
  notas TEXT,
  codigo_facturacion_externo VARCHAR(50),  -- reservado para futura integración DIAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido DESC);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);

-- ---------------------------------------------------------------------
-- 13. pedido_lineas — detalle por referencia de cada pedido
-- ---------------------------------------------------------------------
CREATE TABLE pedido_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  referencia_id UUID NOT NULL REFERENCES referencias(id) ON DELETE RESTRICT, -- no borrar producto usado
  cantidad DECIMAL(12,2) NOT NULL,
  unidad VARCHAR(20) NOT NULL DEFAULT 'cajas',  -- cajas / unidades
  precio_unitario_cop DECIMAL(12,2),
  subtotal_cop DECIMAL(14,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pedido_lineas_pedido ON pedido_lineas(pedido_id);
CREATE INDEX idx_pedido_lineas_referencia ON pedido_lineas(referencia_id);
