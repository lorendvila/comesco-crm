-- =====================================================================
-- 0031 — Importaciones · FASE I-1 (núcleo: importación + mercancía + operadores)
-- =====================================================================
-- Aditivo. NO toca referencia_costes, inventario, triggers de pedidos ni kardex.
-- Reutiliza capacidades I-0 (can_access/manage_importaciones) y
-- bloquear_delete_fisico() (0029).
--
-- Contenido: importaciones (cabecera, 2 dimensiones de estado), importacion_lineas
-- (mercancía SIEMPRE por referencia, importe generado), importacion_operadores
-- (N:M con rol en ESA importación), numeración IMP-YYYY-NNN, guards y RLS.

-- ---------------------------------------------------------------------
-- 1) importaciones (cabecera)
-- ---------------------------------------------------------------------
CREATE TABLE public.importaciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              varchar(20) UNIQUE,                 -- IMP-YYYY-NNN (trigger)
  estado_logistico    varchar(20) NOT NULL DEFAULT 'borrador'
    CHECK (estado_logistico IN ('borrador','confirmada','en_transito','recepcion_parcial','recibida','anulada')),
  estado_coste        varchar(20) NOT NULL DEFAULT 'estimado'
    CHECK (estado_coste IN ('estimado','provisional','definitivo')),
  origen              varchar(160),
  destino             varchar(160),
  incoterm            varchar(10)
    CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  modalidad_transporte varchar(20)
    CHECK (modalidad_transporte IS NULL OR modalidad_transporte IN ('maritimo','aereo','terrestre','multimodal')),
  booking             varchar(60),
  bl                  varchar(60),
  contenedor          varchar(40),
  etd_prevista        date,
  etd_real            date,
  eta_prevista        date,
  eta_real            date,
  almacen_destino_id  uuid REFERENCES public.almacenes(id) ON DELETE RESTRICT,
  moneda              varchar(3) NOT NULL DEFAULT 'EUR',
  tc_presupuestado    numeric(18,6),                      -- preparado para I-2; no calcula nada aún
  observaciones       text,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX idx_importaciones_estado_log ON public.importaciones(estado_logistico);
CREATE INDEX idx_importaciones_eta ON public.importaciones(eta_prevista);
CREATE INDEX idx_importaciones_almacen ON public.importaciones(almacen_destino_id);

-- ---------------------------------------------------------------------
-- 2) importacion_lineas (mercancía SIEMPRE por referencia; importe generado)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_lineas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id        uuid NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  referencia_id         uuid NOT NULL REFERENCES public.referencias(id) ON DELETE RESTRICT,
  operador_proveedor_id uuid REFERENCES public.operadores(id) ON DELETE RESTRICT,
  cantidad_unidades     numeric(14,2) NOT NULL CHECK (cantidad_unidades > 0),
  cajas                 numeric(14,2),
  pallets               numeric(14,2),
  peso_kg               numeric(14,3),                    -- preparado para reparto por peso (I-2)
  volumen_m3            numeric(14,3),                    -- preparado para reparto por volumen (I-2)
  precio_compra         numeric(18,4) NOT NULL CHECK (precio_compra >= 0),
  moneda                varchar(3) NOT NULL DEFAULT 'EUR',
  importe_mercancia     numeric(18,2) GENERATED ALWAYS AS (round(cantidad_unidades * precio_compra, 2)) STORED,
  notas                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
CREATE INDEX idx_importacion_lineas_imp ON public.importacion_lineas(importacion_id);
CREATE INDEX idx_importacion_lineas_ref ON public.importacion_lineas(referencia_id);
CREATE INDEX idx_importacion_lineas_prov ON public.importacion_lineas(operador_proveedor_id);

-- ---------------------------------------------------------------------
-- 3) importacion_operadores (participantes ↔ rol en ESA importación)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_operadores (
  importacion_id uuid NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  operador_id    uuid NOT NULL REFERENCES public.operadores(id) ON DELETE RESTRICT,
  rol_codigo     varchar(30) NOT NULL REFERENCES public.operador_tipos_rol(codigo) ON DELETE RESTRICT,
  notas          text,
  created_at     timestamptz DEFAULT now(),
  PRIMARY KEY (importacion_id, operador_id, rol_codigo)
);
CREATE INDEX idx_importacion_operadores_op ON public.importacion_operadores(operador_id);

-- ---------------------------------------------------------------------
-- 4) Numeración IMP-YYYY-NNN (reinicio anual; patrón de numero_pedido)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.siguiente_codigo_importacion()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE y text := to_char(now(),'YYYY'); n int;
BEGIN
  SELECT COALESCE(max(substring(codigo from 10)::int), 0) + 1 INTO n
    FROM public.importaciones WHERE codigo LIKE 'IMP-'||y||'-%';
  RETURN 'IMP-'||y||'-'||lpad(n::text, 3, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_codigo_importacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('importaciones_codigo'));  -- serializa la asignación
    NEW.codigo := public.siguiente_codigo_importacion();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_set_codigo_importacion ON public.importaciones;
CREATE TRIGGER trg_set_codigo_importacion BEFORE INSERT ON public.importaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_codigo_importacion();

-- ---------------------------------------------------------------------
-- 5) Guard de estados (2 dimensiones independientes; reservas de I-4/I-2)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importaciones_guard_estados()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- estado_coste: en I-1 permanece en 'estimado' (provisional/definitivo = I-2/I-4)
  IF NEW.estado_coste IS DISTINCT FROM OLD.estado_coste THEN
    RAISE EXCEPTION 'El estado de coste se gestiona en fases posteriores; permanece en "estimado".';
  END IF;
  -- estado_logistico: recepción reservada al motor de recepciones (I-4)
  IF NEW.estado_logistico IS DISTINCT FROM OLD.estado_logistico THEN
    IF NEW.estado_logistico IN ('recepcion_parcial','recibida') THEN
      RAISE EXCEPTION 'Los estados de recepción se establecen desde el motor de recepciones (I-4), no manualmente.';
    END IF;
    IF NOT (
         (OLD.estado_logistico = 'borrador'    AND NEW.estado_logistico IN ('confirmada','anulada'))
      OR (OLD.estado_logistico = 'confirmada'  AND NEW.estado_logistico IN ('borrador','en_transito','anulada'))
      OR (OLD.estado_logistico = 'en_transito' AND NEW.estado_logistico = 'anulada')
    ) THEN
      RAISE EXCEPTION 'Transición de estado logístico no permitida: % -> %.', OLD.estado_logistico, NEW.estado_logistico;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_importaciones_guard_estados ON public.importaciones;
CREATE TRIGGER trg_importaciones_guard_estados BEFORE UPDATE ON public.importaciones
  FOR EACH ROW EXECUTE FUNCTION public.importaciones_guard_estados();

-- ---------------------------------------------------------------------
-- 6) Guard de líneas (mercancía editable solo en borrador/confirmada; no servicios)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importacion_lineas_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estado text; v_serv boolean; v_imp uuid;
BEGIN
  v_imp := COALESCE(NEW.importacion_id, OLD.importacion_id);
  SELECT estado_logistico INTO v_estado FROM public.importaciones WHERE id = v_imp;
  IF v_estado IS NOT NULL AND v_estado NOT IN ('borrador','confirmada') THEN
    RAISE EXCEPTION 'La mercancía solo puede editarse mientras la importación está en borrador o confirmada (estado: %).', v_estado;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT es_servicio INTO v_serv FROM public.referencias WHERE id = NEW.referencia_id;
    IF v_serv THEN RAISE EXCEPTION 'Una referencia de servicio no puede ser mercancía de importación.'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_importacion_lineas_guard ON public.importacion_lineas;
CREATE TRIGGER trg_importacion_lineas_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.importacion_lineas
  FOR EACH ROW EXECUTE FUNCTION public.importacion_lineas_guard();

-- ---------------------------------------------------------------------
-- 7) No-delete físico + archivado (barrera dura, como 0029)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_no_delete_fisico ON public.importaciones;
CREATE TRIGGER trg_no_delete_fisico BEFORE DELETE ON public.importaciones
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_fisico();

-- Nota: no hace falta guard de archivado como en 0029 (clientes/referencias/
-- oportunidades tenían escritura por propietario). En importaciones la única
-- escritura posible es can_manage_importaciones(), que ES exactamente el permiso
-- para archivar -> la RLS ya restringe archivar/restaurar a Backoffice/Superadmin.

-- ---------------------------------------------------------------------
-- 8) RLS + GRANTs
-- ---------------------------------------------------------------------
ALTER TABLE public.importaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY importaciones_select ON public.importaciones FOR SELECT USING (can_access_importaciones());
CREATE POLICY importaciones_ins    ON public.importaciones FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY importaciones_upd    ON public.importaciones FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importaciones TO authenticated;

ALTER TABLE public.importacion_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY implin_select ON public.importacion_lineas FOR SELECT USING (can_access_importaciones());
CREATE POLICY implin_ins    ON public.importacion_lineas FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY implin_upd    ON public.importacion_lineas FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY implin_del    ON public.importacion_lineas FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_lineas TO authenticated;

ALTER TABLE public.importacion_operadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY impop_select ON public.importacion_operadores FOR SELECT USING (can_access_importaciones());
CREATE POLICY impop_ins    ON public.importacion_operadores FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY impop_upd    ON public.importacion_operadores FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY impop_del    ON public.importacion_operadores FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_operadores TO authenticated;
