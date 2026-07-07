# COMESCO CRM — Brief técnico para Claude Code

Este documento resume todo lo definido hasta ahora (infografía + contexto de negocio) en forma de especificación técnica. Se usa junto con `CLAUDE.md` (reglas de trabajo) y `Loren_Dionis-design-system.css` (look and feel).

---

## 1. Contexto de negocio (resumen)

- Importadora/distribuidora de alimentación en Colombia. Escalando tras Alimentek Bogotá.
- 3 canales de venta, **fijos por cliente**: `retail`, `food_service` (incluye distribuidores), `industria`.
- Cada referencia = producto + formato específico (ej. "AOVE vidrio 500ml" ≠ "AOVE lata 1L"). No se agrupan.
- Precios en COP únicamente.
- Facturación real se hace fuera del CRM (sistema DIAN, vía Distribuidora Andina). El CRM deja un campo preparado para conectarlo en el futuro, sin integrarlo ahora.

## 2. Roles y autenticación

**Códigos internos:** `clientes` y `referencias` tienen, además del `id` (UUID técnico), un `codigo_interno` legible y correlativo (`CLI-000001`, `REF-000001`...), generado automáticamente por la base de datos al crear cada fila. Mismo patrón para cualquier tabla futura que lo necesite. No sustituye al UUID (que sigue siendo la clave real de relación entre tablas) — es solo para que las personas puedan referirse a un cliente o referencia sin decir un UUID en voz alta.

Dos roles únicamente:

| Rol | Alcance |
|---|---|
| `admin` | Ve y edita todo. |
| `comercial` | Ve y edita solo los clientes con `comercial_asignado_id` = su propio usuario — incluidas sus condiciones comerciales, porque son ellos quienes las negocian. |

Autenticación vía Supabase Auth (email/password o Google Workspace SSO — a decidir). RLS activado en **todas** las tablas de negocio; la seguridad vive en la base de datos, no en el frontend.

## 3. Modelo de datos completo

```sql
-- Usuarios internos (mapea 1:1 con auth.users de Supabase)
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

-- Clientes / leads
CREATE SEQUENCE clientes_codigo_seq START 1;
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno VARCHAR(12) UNIQUE NOT NULL DEFAULT ('CLI-' || LPAD(nextval('clientes_codigo_seq')::text, 6, '0')),
  nombre VARCHAR(255) NOT NULL,
  canal VARCHAR(20) CHECK (canal IN ('retail','food_service','industria')), -- NULL = aún sin definir (lead incompleto)
  estado VARCHAR(20) NOT NULL DEFAULT 'lead' CHECK (estado IN ('lead','activo','inactivo')),
  comercial_asignado_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = sin asignar, gestiona un socio
  ciudad VARCHAR(100),
  pais VARCHAR(100) DEFAULT 'Colombia',
  direccion_entrega TEXT,
  codigo_facturacion_externo VARCHAR(50), -- reservado para futura integración DIAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_clientes_comercial ON clientes(comercial_asignado_id);
CREATE INDEX idx_clientes_canal ON clientes(canal);
CREATE INDEX idx_clientes_estado ON clientes(estado);

-- Contactos del cliente (puede haber varios: comprador, gerente, back office...)
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

-- Referencias (producto + formato, nunca agrupados)
CREATE SEQUENCE referencias_codigo_seq START 1;
CREATE TABLE referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno VARCHAR(12) UNIQUE NOT NULL DEFAULT ('REF-' || LPAD(nextval('referencias_codigo_seq')::text, 6, '0')),
  nombre_producto VARCHAR(255) NOT NULL,      -- ej. "Aceite de oliva virgen extra"
  formato VARCHAR(100) NOT NULL,               -- ej. "500ML"
  categoria VARCHAR(100),                      -- ej. "Aceite", "Aceitunas", "Vino"
  proveedor VARCHAR(255),                      -- ej. "Oleosandua"
  unidad VARCHAR(20) NOT NULL DEFAULT 'cajas',
  unidades_por_caja INTEGER,
  cajas_por_palet INTEGER,
  unidades_por_palet INTEGER,
  codigo_facturacion_externo VARCHAR(50),      -- reservado para futura integración DIAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Condiciones comerciales — SOLO ADMIN
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

-- Pipeline
CREATE TABLE oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  etapa VARCHAR(30) NOT NULL DEFAULT 'prospeccion'
    CHECK (etapa IN ('prospeccion','negociacion','cierre_ganado','cierre_perdido')),
  valor_estimado DECIMAL(12,2),
  fecha_cierre DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX idx_oportunidades_etapa ON oportunidades(etapa);

-- Actividad — log de seguimiento (lo ya hecho Y lo programado a futuro)
CREATE TABLE actividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('llamada','email','visita','comentario','otro')),
  fecha TIMESTAMPTZ DEFAULT NOW(), -- puede ser futura si es una acción programada
  estado VARCHAR(20) NOT NULL DEFAULT 'realizada' CHECK (estado IN ('realizada','programada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_actividades_cliente ON actividades(cliente_id, fecha DESC);

-- Tareas
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

-- Comunicaciones (referencia a Gmail, no copia del contenido)
CREATE TABLE comunicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  canal VARCHAR(30) NOT NULL DEFAULT 'gmail',
  referencia_externa TEXT NOT NULL, -- ID o enlace del email en Gmail
  asunto VARCHAR(255),
  fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comunicaciones_cliente ON comunicaciones(cliente_id);

-- Demanda estimada (intención vs. histórico)
CREATE TABLE demanda_estimada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  referencia_id UUID NOT NULL REFERENCES referencias(id) ON DELETE CASCADE,
  cantidad DECIMAL(12,2) NOT NULL,
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('intencion','historico')),
  periodo VARCHAR(20), -- ej. "2026-Q3"
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_demanda_cliente ON demanda_estimada(cliente_id);
CREATE INDEX idx_demanda_referencia ON demanda_estimada(referencia_id);
```

## 4. RLS — patrón único a replicar en cada tabla

```sql
-- Función helper
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- clientes: admin ve todo. comercial ve solo los suyos.
-- Un lead sin asignar (comercial_asignado_id IS NULL) solo lo ve admin, hasta que se asigne.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_clientes" ON clientes FOR ALL USING (
  is_admin() OR comercial_asignado_id = current_user_id()
);

-- contactos_cliente: mismo patrón que las tablas hijas
ALTER TABLE contactos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_contactos" ON contactos_cliente FOR ALL USING (
  is_admin() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id())
);

-- tablas hijas (actividades, oportunidades, tareas, comunicaciones, demanda_estimada):
-- mismo patrón, verificando el cliente_id contra la visibilidad de "clientes"
ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_actividades" ON actividades FOR ALL USING (
  is_admin() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id())
);
-- repetir para oportunidades, tareas, comunicaciones, demanda_estimada

-- condiciones_comerciales: admin ve todo; comercial ve solo las de sus propios clientes
ALTER TABLE condiciones_comerciales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_condiciones" ON condiciones_comerciales FOR ALL USING (
  is_admin() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id())
);

-- referencias: lectura para ambos roles, escritura solo admin
ALTER TABLE referencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura_referencias" ON referencias FOR SELECT USING (true);
CREATE POLICY "escritura_referencias" ON referencias FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "edicion_referencias" ON referencias FOR UPDATE USING (is_admin());
```

## 5. Módulos frontend ↔ tablas

| Módulo | Tabla(s) | Visible para |
|---|---|---|
| Ficha de cliente | `clientes` | Ambos (filtrado) |
| Contactos del cliente | `contactos_cliente` | Ambos (filtrado) |
| Pipeline | `oportunidades` | Ambos (filtrado) |
| Actividad (log de seguimiento) | `actividades` | Ambos (filtrado) |
| Tareas | `tareas` | Ambos (filtrado) |
| Comunicación (Gmail) | `comunicaciones` | Ambos (filtrado) |
| Análisis de demanda | `demanda_estimada`, `referencias` | Ambos (filtrado por cliente) |
| Condiciones comerciales | `condiciones_comerciales` | Ambos (filtrado) |
| Informes/dashboard | Lectura agregada de todo | Admin ve global; comercial ve solo lo suyo |

## 6. Integraciones

- **Gmail**: OAuth conectado por el admin. Se guarda solo `referencia_externa` (ID/enlace) + `asunto` en `comunicaciones`. No sincroniza el buzón completo — vinculación manual o por regla, bajo demanda.
- **DIAN**: no se integra ahora. Los campos `codigo_facturacion_externo` en `clientes` y `referencias` quedan vacíos y preparados.

## 7. Stack técnico

- Frontend: React + TypeScript + Vite (conforme a `modern-web-crm-stack`)
- Backend: Supabase (Postgres + Auth + RLS), conforme a `supabase-data-architecture`, adaptado a single-tenant (sin tabla `companies` — COMESCO es la única organización)
- Estilos: `Loren_Dionis-design-system.css` — modo oscuro por defecto (`data-mode="dark"` o sin atributo) para la app; modo claro reservado para documentos/propuestas exportadas, no para el CRM en sí
- Tipografía del sistema: DM Serif Display (títulos) + DM Sans (cuerpo) — ya definida, no reinterpretar

## 8. Fases de construcción sugeridas

1. **Schema + RLS** en Supabase (todo el SQL de arriba) — sin frontend todavía. Verificar con un usuario de prueba `comercial` que el filtrado funciona antes de seguir.
2. **Datos semilla**: importar las 21 referencias y los 95 leads depurados (sin asignar a nadie).
3. **Auth + layout base** aplicando el design system (shell de la app, navegación, modo oscuro).
4. **Ficha de cliente + Contactos + Pipeline + Actividad/log + Tareas** (el núcleo diario).
5. **Comunicaciones (Gmail)** — depende de OAuth.
6. **Análisis de demanda** (referencias + demanda_estimada).
7. **Condiciones comerciales** (filtrado por rol).
8. **Informes/dashboard** — al final, porque lee de todo lo anterior.

## 9. Prompt inicial sugerido para Claude Code

```
Lee CLAUDE.md antes de nada. Vamos a construir el CRM de COMESCO siguiendo
el brief técnico en COMESCO_CRM_brief_tecnico.md y el look and feel de
Loren_Dionis-design-system.css.

Empezamos por la Fase 1: crea las migraciones de Supabase con el esquema
completo (tablas, índices, RLS) tal como está en el brief. No toques
frontend todavía. Dame el plan antes de ejecutar, como indica CLAUDE.md.
```

## 10. Datos semilla

### 10.1 Importación de leads (Alimentek)

Se importan **todos** los leads depurados excepto la pestaña `Excluir_no_son_clientes` (95 de 99): `Listos_para_importar`, `Revisar_canal` e `Incompletos` entran todos como `clientes` con:
- `estado = 'lead'`
- `comercial_asignado_id = NULL` (sin asignar — solo visible para admin hasta que un socio lo reparta)
- `canal = NULL` para los que no lo tienen definido (pestaña Incompletos), en vez de bloquear la importación

Los contactos de cada fila (columna "Contacto principal", a veces con 2 nombres separados por "/") se separan en filas independientes de `contactos_cliente`, marcando el primero como `es_principal = true`.

### 10.2 Catálogo maestro de referencias (seed inicial — 21 referencias)

```sql
INSERT INTO referencias (proveedor, nombre_producto, formato, categoria, unidades_por_caja, cajas_por_palet, unidades_por_palet) VALUES
('Oleosandua','Aceite de oliva virgen extra','5L','Aceite',3,60,180),
('Oleosandua','Aceite de oliva virgen extra','3L','Aceite',6,52,312),
('Oleosandua','Aceite de oliva virgen extra','500ML','Aceite',12,144,1728),
('Bella San Marzano','Tomate pelado San Marzano alta calidad','2,5KG','Tomate',6,50,300),
('Ecovinal','Vinagre balsámico','250ML','Vinagre',6,560,3360),
('Ecovinal','Vinagre de sidra de manzana eco','500ML','Vinagre',12,105,1260),
('Ecovinal','Vinagre balsámico','5L','Vinagre',2,84,168),
('Maestros Aceituneros','Aceitunas Embrujos','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas Maestro Andaluz','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas El Cóctel','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas Embrujos','370ML','Aceitunas',12,168,2016),
('Maestros Aceituneros','Aceitunas Maestro Andaluz','370ML','Aceitunas',12,168,2016),
('Maestros Aceituneros','Aceitunas El Cóctel','370ML','Aceitunas',12,168,2016),
('Vinigalicia','Vino tinto Madera Raigal','750ML','Vino',12,130,1560),
('Vinigalicia','Vino blanco Raigal','750ML','Vino',12,130,1560),
('Vinigalicia','Vino rosado Raigal','750ML','Vino',12,130,1560),
('Agroalcinca','Arroz Carnaroli Monterino','1KG','Arroz',10,50,500),
('Entrepinares','Queso burger institucional (84 lonchas)','1,05KG','Queso',10,77,770),
('La Pirenaica','Jamón serrano loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Chorizo loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Salchichón loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Tapas mix','150G','Charcutería',10,110,1100);
```

**Pendiente de tu validación:** normalicé "Bella San Marzano" y "Agroelcinca" (tal como venían escritos) a nombres de proveedor consistentes. Confírmame si el proveedor real de alguno es distinto al que aparece aquí.
