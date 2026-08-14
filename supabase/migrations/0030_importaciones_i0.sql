-- =====================================================================
-- 0030 — Importaciones · FASE I-0 (fundaciones)
-- =====================================================================
-- Puramente ADITIVO. Crea catálogos + capacidades + RLS + no-delete para el
-- futuro módulo de Importaciones. NO toca NINGUNA tabla, trigger o policy
-- existente: pedidos, inventario, referencia_costes y todos sus triggers
-- quedan intactos. Superficie de regresión sobre lo existente = 0.
--
-- Alcance aprobado por Loren:
--  - operadores: entidad independiente de clientes (NO se unifica con clientes).
--  - operador_tipos_rol + operador_roles: roles N:M (una empresa, varios roles).
--  - importacion_tipos_coste: catálogo de conceptos de coste; `capitalizable`
--    editable. El tipo 'otro' entra como NO capitalizable por defecto.
--  - tipos_cambio: serie de referencia EUR/COP; se crea VACÍA. Escritura
--    reservada a Superadmin (can_manage_importaciones_config), porque la
--    alimentará una fuente externa más adelante.
--  - Capacidades: can_access_importaciones (super/direccion/backoffice),
--    can_manage_importaciones (super/backoffice), can_manage_importaciones_config
--    (solo super). Comercial: SIN acceso -> 0 filas por API en todas las tablas.
--
-- Reutiliza public.bloquear_delete_fisico() (mig 0029) para la barrera no-delete.

-- =====================================================================
-- 1) Capacidades (mismo patrón que 0021: SECURITY DEFINER, booleano estricto)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.can_access_importaciones()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','direccion','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_importaciones()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

-- Configuración crítica del módulo (serie de TC, y en el futuro Gmail/automatización).
CREATE OR REPLACE FUNCTION public.can_manage_importaciones_config()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = 'superadmin', false);
$$;

-- =====================================================================
-- 2) Tablas
-- =====================================================================

-- 2.1 operadores — proveedores/navieras/aduana/almacenes/etc. (independiente de clientes)
CREATE TABLE public.operadores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     varchar(255) NOT NULL,
  nit        varchar(50),               -- identificación fiscal; NULL para extranjeros
  pais       varchar(100),
  email      varchar(255),
  telefono   varchar(50),
  web        varchar(255),
  notas      text,
  activo     boolean NOT NULL DEFAULT true,   -- baja lógica (no se borra físicamente)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX operadores_nit_uidx ON public.operadores(nit) WHERE nit IS NOT NULL;
CREATE INDEX idx_operadores_activo ON public.operadores(activo);

-- 2.2 operador_tipos_rol — catálogo de roles (data-driven, sin CHECK hardcodeado)
CREATE TABLE public.operador_tipos_rol (
  codigo varchar(30) PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden  int
);

-- 2.3 operador_roles — N:M operador <-> rol
CREATE TABLE public.operador_roles (
  operador_id uuid NOT NULL REFERENCES public.operadores(id) ON DELETE RESTRICT,
  rol_codigo  varchar(30) NOT NULL REFERENCES public.operador_tipos_rol(codigo) ON DELETE RESTRICT,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (operador_id, rol_codigo)
);
CREATE INDEX idx_operador_roles_rol ON public.operador_roles(rol_codigo);

-- 2.4 importacion_tipos_coste — catálogo de conceptos de coste
CREATE TABLE public.importacion_tipos_coste (
  codigo                    varchar(40) PRIMARY KEY,
  nombre                    varchar(120) NOT NULL,
  capitalizable             boolean NOT NULL DEFAULT true,     -- entra en landed cost
  naturaleza                varchar(30) NOT NULL DEFAULT 'logistico'
    CHECK (naturaleza IN ('logistico','aduanero','impuesto_recuperable','financiero','comercial','otro')),
  criterio_reparto_default  varchar(20) NOT NULL DEFAULT 'valor'
    CHECK (criterio_reparto_default IN ('unidades','pallets','valor','peso','volumen','directo','manual')),
  activo                    boolean NOT NULL DEFAULT true,
  orden                     int
);

-- 2.5 tipos_cambio — serie de referencia EUR/COP (VACÍA en I-0)
CREATE TABLE public.tipos_cambio (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  par        varchar(7) NOT NULL DEFAULT 'EUR/COP',
  fecha      date NOT NULL,
  tipo       numeric(18,6) NOT NULL,          -- COP por 1 EUR
  fuente     varchar(50),                     -- SIN acoplar a ninguna API
  created_at timestamptz DEFAULT now(),
  UNIQUE (par, fecha)
);

-- =====================================================================
-- 3) RLS + GRANTs
--    SELECT = can_access_importaciones (super/direccion/backoffice).
--    Escritura = can_manage_importaciones (super/backoffice), salvo:
--      - tipos_cambio: escritura solo Superadmin (can_manage_importaciones_config).
--    Comercial no está en ningún conjunto -> 0 filas por API.
-- =====================================================================

-- 3.1 operadores (con no-delete físico como en 0029)
ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY operadores_select ON public.operadores FOR SELECT USING (can_access_importaciones());
CREATE POLICY operadores_ins    ON public.operadores FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY operadores_upd    ON public.operadores FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operadores TO authenticated;

DROP TRIGGER IF EXISTS trg_no_delete_fisico ON public.operadores;
CREATE TRIGGER trg_no_delete_fisico BEFORE DELETE ON public.operadores
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_fisico();

-- 3.2 operador_tipos_rol (catálogo; ciclo de vida por `activo`, sin DELETE)
ALTER TABLE public.operador_tipos_rol ENABLE ROW LEVEL SECURITY;
CREATE POLICY otr_select ON public.operador_tipos_rol FOR SELECT USING (can_access_importaciones());
CREATE POLICY otr_ins    ON public.operador_tipos_rol FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY otr_upd    ON public.operador_tipos_rol FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE ON public.operador_tipos_rol TO authenticated;

-- 3.3 operador_roles (asignación N:M; desasignar SÍ permitido -> DELETE por policy)
ALTER TABLE public.operador_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY or_select ON public.operador_roles FOR SELECT USING (can_access_importaciones());
CREATE POLICY or_ins    ON public.operador_roles FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY or_upd    ON public.operador_roles FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY or_del    ON public.operador_roles FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operador_roles TO authenticated;

-- 3.4 importacion_tipos_coste (catálogo; ciclo de vida por `activo`, sin DELETE)
ALTER TABLE public.importacion_tipos_coste ENABLE ROW LEVEL SECURITY;
CREATE POLICY itc_select ON public.importacion_tipos_coste FOR SELECT USING (can_access_importaciones());
CREATE POLICY itc_ins    ON public.importacion_tipos_coste FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY itc_upd    ON public.importacion_tipos_coste FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE ON public.importacion_tipos_coste TO authenticated;

-- 3.5 tipos_cambio (serie financiera; escritura SOLO Superadmin)
ALTER TABLE public.tipos_cambio ENABLE ROW LEVEL SECURITY;
CREATE POLICY tc_select ON public.tipos_cambio FOR SELECT USING (can_access_importaciones());
CREATE POLICY tc_ins    ON public.tipos_cambio FOR INSERT WITH CHECK (can_manage_importaciones_config());
CREATE POLICY tc_upd    ON public.tipos_cambio FOR UPDATE
  USING (can_manage_importaciones_config()) WITH CHECK (can_manage_importaciones_config());
GRANT SELECT, INSERT, UPDATE ON public.tipos_cambio TO authenticated;

-- =====================================================================
-- 4) Seeds de catálogos (idempotentes)
-- =====================================================================

-- 4.1 Roles de operador
INSERT INTO public.operador_tipos_rol (codigo, nombre, orden) VALUES
  ('proveedor',      'Proveedor / Productor',            10),
  ('agente_aduanal', 'Agente aduanal',                   20),
  ('naviera',        'Naviera',                          30),
  ('forwarder',      'Freight forwarder',                40),
  ('consignatario',  'Consignatario',                    50),
  ('transportista',  'Transportista',                    60),
  ('almacen',        'Almacén / depósito',               70),
  ('etiquetado',     'Etiquetado / reacondicionamiento', 80),
  ('inspeccion',     'Inspección / análisis',            90),
  ('financiero',     'Financiero / financiación',       100),
  ('otro',           'Otro',                            999)
ON CONFLICT (codigo) DO NOTHING;

-- 4.2 Conceptos de coste.
--     Capitalizables = necesarios para poner la mercancía disponible en almacén.
--     NO capitalizables = impuestos recuperables, comerciales, financieros
--     (se conservan para el futuro módulo de rentabilidad/tesorería; NUNCA
--      entran en landed cost). 'otro' entra como NO capitalizable por defecto:
--     un coste sin clasificar no debe capitalizarse hasta que se determine.
INSERT INTO public.importacion_tipos_coste
  (codigo, nombre, capitalizable, naturaleza, criterio_reparto_default, orden) VALUES
  ('transporte_origen',        'Transporte en origen',            true,  'logistico',           'valor',    10),
  ('flete',                    'Flete internacional',             true,  'logistico',           'valor',    20),
  ('seguro_transporte',        'Seguro de transporte',            true,  'logistico',           'valor',    30),
  ('puerto',                   'Gastos de puerto',                true,  'logistico',           'pallets',  40),
  ('desconsolidacion',         'Desconsolidación',                true,  'logistico',           'pallets',  50),
  ('aranceles',                'Aranceles',                       true,  'aduanero',            'valor',    60),
  ('agente_aduanal',           'Agente aduanal',                  true,  'aduanero',            'valor',    70),
  ('inspeccion_analisis',      'Inspección / análisis',           true,  'aduanero',            'directo',  80),
  ('almacenaje_importacion',   'Almacenaje durante importación',  true,  'logistico',           'pallets',  90),
  ('zona_franca',              'Zona franca',                     true,  'aduanero',            'valor',   100),
  ('etiquetado',               'Etiquetado',                      true,  'logistico',           'unidades',110),
  ('reacondicionamiento',      'Reacondicionamiento',             true,  'logistico',           'unidades',120),
  ('manipulacion',             'Manipulaciones',                  true,  'logistico',           'pallets', 130),
  ('transporte_puerto_almacen','Transporte puerto → almacén',     true,  'logistico',           'valor',   140),
  ('iva_importacion',          'IVA de importación (recuperable)',false, 'impuesto_recuperable','directo', 200),
  ('pac',                      'PAC',                             false, 'comercial',           'manual',  210),
  ('comision_comercial',       'Comisión comercial',              false, 'comercial',           'manual',  220),
  ('marketing',                'Marketing / promociones',         false, 'comercial',           'manual',  230),
  ('coste_financiero',         'Coste financiero',                false, 'financiero',          'manual',  240),
  ('diferencia_cambio',        'Diferencia de cambio',            false, 'financiero',          'manual',  250),
  ('otro',                     'Otro (sin clasificar)',           false, 'otro',                'manual',  999)
ON CONFLICT (codigo) DO NOTHING;
