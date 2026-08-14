-- =====================================================================
-- 0033 — Importaciones · FASE I-2 (costes + reparto + landed cost)
-- =====================================================================
-- READ-ONLY respecto a referencia_costes / inventario / kardex / pedidos:
-- NO los toca. Solo calcula/expone landed cost (vistas). Reutiliza el catálogo
-- importacion_tipos_coste (I-0). Definitivo NO se habilita en I-2 (reservado I-4).

-- ---------------------------------------------------------------------
-- 1) Valoración COP de la mercancía en la línea (estimado vs real separados)
-- ---------------------------------------------------------------------
ALTER TABLE public.importacion_lineas
  ADD COLUMN IF NOT EXISTS tc_estimado        numeric(18,6),
  ADD COLUMN IF NOT EXISTS precio_compra_real numeric(18,4) CHECK (precio_compra_real IS NULL OR precio_compra_real >= 0),
  ADD COLUMN IF NOT EXISTS tc_real            numeric(18,6);

ALTER TABLE public.importacion_lineas
  ADD COLUMN IF NOT EXISTS importe_mercancia_cop_est numeric(18,2)
    GENERATED ALWAYS AS (round(cantidad_unidades * precio_compra * tc_estimado, 2)) STORED,
  ADD COLUMN IF NOT EXISTS importe_mercancia_real numeric(18,2)
    GENERATED ALWAYS AS (round(cantidad_unidades * COALESCE(precio_compra_real, precio_compra), 2)) STORED,
  ADD COLUMN IF NOT EXISTS importe_mercancia_cop_real numeric(18,2)
    GENERATED ALWAYS AS (round(cantidad_unidades * COALESCE(precio_compra_real, precio_compra) * COALESCE(tc_real, tc_estimado), 2)) STORED;

-- ---------------------------------------------------------------------
-- 2) importacion_costes (add-ons; estimado y real conviven; nunca se sobrescriben)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_costes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id    uuid NOT NULL REFERENCES public.importaciones(id) ON DELETE CASCADE,
  tipo_coste_codigo varchar(40) NOT NULL REFERENCES public.importacion_tipos_coste(codigo) ON DELETE RESTRICT,
  capitalizable     boolean,                    -- default desde el tipo (trigger); editable por coste
  concepto          varchar(160),
  operador_id       uuid REFERENCES public.operadores(id) ON DELETE SET NULL,
  documento_id      uuid REFERENCES public.importacion_documentos(id) ON DELETE SET NULL,
  criterio_reparto  varchar(20) NOT NULL DEFAULT 'valor'
    CHECK (criterio_reparto IN ('valor','unidades','cajas','pallets','peso','volumen','directo','manual')),
  referencia_id     uuid REFERENCES public.referencias(id) ON DELETE RESTRICT,       -- directo a referencia
  linea_directa_id  uuid REFERENCES public.importacion_lineas(id) ON DELETE CASCADE, -- directo a una línea
  -- ESTIMADO
  importe_estimado     numeric(18,4) CHECK (importe_estimado IS NULL OR importe_estimado >= 0),
  moneda_estimado      varchar(3),
  tc_estimado          numeric(18,6),
  importe_estimado_cop numeric(18,2) GENERATED ALWAYS AS (round(importe_estimado * tc_estimado, 2)) STORED,
  -- REAL
  importe_real     numeric(18,4) CHECK (importe_real IS NULL OR importe_real >= 0),
  moneda_real      varchar(3),
  tc_real          numeric(18,6),
  importe_real_cop numeric(18,2) GENERATED ALWAYS AS (round(importe_real * tc_real, 2)) STORED,
  fecha_factura    date,
  -- RESOLUCIÓN (cierre del concepto sin factura real)
  sin_coste_real   boolean NOT NULL DEFAULT false,
  -- HECHOS FINANCIEROS (para rentabilidad/tesorería futura; no se calcula nada)
  fecha_devengo               date,
  fecha_pago                  date,
  fecha_recuperacion_estimada date,
  fecha_recuperacion_real     date,
  observaciones  text,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz,
  -- TC obligatorio cuando hay importe (COP bloqueado y reproducible)
  CONSTRAINT chk_tc_est  CHECK (importe_estimado IS NULL OR tc_estimado IS NOT NULL),
  CONSTRAINT chk_tc_real CHECK (importe_real IS NULL OR tc_real IS NOT NULL),
  -- 'directo' inequívoco: exactamente uno de {referencia, línea}; en otro criterio, ambos NULL
  CONSTRAINT chk_directo CHECK (
    CASE WHEN criterio_reparto = 'directo'
      THEN ((referencia_id IS NOT NULL)::int + (linea_directa_id IS NOT NULL)::int) = 1
      ELSE referencia_id IS NULL AND linea_directa_id IS NULL
    END
  )
);
CREATE INDEX idx_impcostes_imp ON public.importacion_costes(importacion_id);
CREATE INDEX idx_impcostes_tipo ON public.importacion_costes(tipo_coste_codigo);

-- ---------------------------------------------------------------------
-- 3) importacion_coste_reparto (asignación explícita y reproducible)
-- ---------------------------------------------------------------------
CREATE TABLE public.importacion_coste_reparto (
  coste_id             uuid NOT NULL REFERENCES public.importacion_costes(id) ON DELETE CASCADE,
  importacion_linea_id uuid NOT NULL REFERENCES public.importacion_lineas(id) ON DELETE CASCADE,
  base_reparto         numeric(18,4),
  importe_estimado_cop numeric(18,2),
  importe_real_cop     numeric(18,2),
  manual               boolean NOT NULL DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  PRIMARY KEY (coste_id, importacion_linea_id)
);

-- ---------------------------------------------------------------------
-- 4) Trigger de costes: default capitalizable, validaciones, inmutabilidad
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importacion_costes_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estado_coste text; v_imp uuid; v_lin_imp uuid;
BEGIN
  v_imp := COALESCE(NEW.importacion_id, OLD.importacion_id);
  SELECT estado_coste INTO v_estado_coste FROM public.importaciones WHERE id = v_imp;

  -- Inmutabilidad en definitivo (preparado; en I-2 definitivo no se alcanza).
  IF v_estado_coste = 'definitivo' THEN
    RAISE EXCEPTION 'Los costes son inmutables con la importación en estado_coste=definitivo. Reábrela a provisional primero.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.importe_real IS NOT NULL THEN
      RAISE EXCEPTION 'Un coste con importe real es un hecho económico: no se borra físicamente. Archívalo (deleted_at).'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- Default capitalizable desde el tipo si no se indicó.
  IF NEW.capitalizable IS NULL THEN
    SELECT capitalizable INTO NEW.capitalizable FROM public.importacion_tipos_coste WHERE codigo = NEW.tipo_coste_codigo;
  END IF;

  -- La línea de 'directo a línea' debe pertenecer a esta importación.
  IF NEW.linea_directa_id IS NOT NULL THEN
    SELECT importacion_id INTO v_lin_imp FROM public.importacion_lineas WHERE id = NEW.linea_directa_id;
    IF v_lin_imp IS DISTINCT FROM NEW.importacion_id THEN
      RAISE EXCEPTION 'linea_directa_id no pertenece a esta importación.';
    END IF;
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_importacion_costes_guard ON public.importacion_costes;
CREATE TRIGGER trg_importacion_costes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.importacion_costes
  FOR EACH ROW EXECUTE FUNCTION public.importacion_costes_guard();

-- ---------------------------------------------------------------------
-- 5) Motor de reparto: mayor resto (Σ reparto = coste, sin fugas)
--    Solo costes capitalizables y NO 'manual'. 'manual' lo escribe la UI.
--    Dato ausente para el criterio -> ERROR explícito (nunca fallback).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_reparto(p_importacion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; v_faltan text; v_cents_est bigint; v_cents_real bigint; v_has_real boolean;
BEGIN
  FOR c IN
    SELECT * FROM public.importacion_costes
    WHERE importacion_id = p_importacion_id AND deleted_at IS NULL
      AND COALESCE(capitalizable, false) = true AND criterio_reparto <> 'manual'
  LOOP
    -- 1) Conjunto de líneas objetivo + peso, según criterio.
    DROP TABLE IF EXISTS _tgt;
    CREATE TEMP TABLE _tgt ON COMMIT DROP AS
    SELECT l.id AS linea_id,
      CASE c.criterio_reparto
        WHEN 'valor'    THEN l.importe_mercancia_cop_est
        WHEN 'unidades' THEN l.cantidad_unidades
        WHEN 'cajas'    THEN l.cajas
        WHEN 'pallets'  THEN l.pallets
        WHEN 'peso'     THEN l.peso_kg
        WHEN 'volumen'  THEN l.volumen_m3
        WHEN 'directo'  THEN CASE
                               WHEN c.linea_directa_id IS NOT NULL THEN (CASE WHEN l.id = c.linea_directa_id THEN 1 ELSE NULL END)
                               ELSE l.importe_mercancia_cop_est  -- directo a referencia: por valor entre sus líneas
                             END
      END AS peso
    FROM public.importacion_lineas l
    WHERE l.importacion_id = p_importacion_id
      AND (c.criterio_reparto <> 'directo'
           OR (c.linea_directa_id IS NOT NULL AND l.id = c.linea_directa_id)
           OR (c.referencia_id IS NOT NULL AND l.referencia_id = c.referencia_id));

    -- Sin líneas objetivo (p.ej. directo a referencia sin líneas de esa referencia).
    IF NOT EXISTS (SELECT 1 FROM _tgt) THEN
      RAISE EXCEPTION 'Coste % (%): no hay líneas objetivo para el reparto.', c.id, c.concepto;
    END IF;

    -- Dato ausente: alguna línea objetivo con peso NULL -> error listando líneas.
    SELECT string_agg(linea_id::text, ', ') INTO v_faltan FROM _tgt WHERE peso IS NULL;
    IF v_faltan IS NOT NULL THEN
      RAISE EXCEPTION 'Coste % (criterio %): faltan datos para el reparto en las líneas: %.', c.id, c.criterio_reparto, v_faltan;
    END IF;
    IF (SELECT COALESCE(sum(peso),0) FROM _tgt) <= 0 THEN
      RAISE EXCEPTION 'Coste % (criterio %): la suma de pesos es 0; no se puede repartir.', c.id, c.criterio_reparto;
    END IF;

    v_cents_est  := round(COALESCE(c.importe_estimado_cop, 0) * 100)::bigint;
    v_has_real   := c.importe_real_cop IS NOT NULL;
    v_cents_real := round(COALESCE(c.importe_real_cop, 0) * 100)::bigint;

    -- 2) Reemplaza el reparto de este coste (no manual).
    DELETE FROM public.importacion_coste_reparto WHERE coste_id = c.id;

    INSERT INTO public.importacion_coste_reparto (coste_id, importacion_linea_id, base_reparto, importe_estimado_cop, importe_real_cop, manual)
    WITH w AS (SELECT linea_id, peso FROM _tgt),
    tot AS (SELECT sum(peso) tw FROM w),
    calc AS (
      SELECT w.linea_id, w.peso,
        floor(v_cents_est  * w.peso / tot.tw) AS base_est,
        (v_cents_est  * w.peso / tot.tw) - floor(v_cents_est  * w.peso / tot.tw) AS frac_est,
        floor(v_cents_real * w.peso / tot.tw) AS base_real,
        (v_cents_real * w.peso / tot.tw) - floor(v_cents_real * w.peso / tot.tw) AS frac_real
      FROM w, tot
    ),
    ranked AS (
      SELECT *,
        v_cents_est  - sum(base_est)  OVER () AS left_est,
        v_cents_real - sum(base_real) OVER () AS left_real,
        row_number() OVER (ORDER BY frac_est  DESC, peso DESC, linea_id) AS rn_est,
        row_number() OVER (ORDER BY frac_real DESC, peso DESC, linea_id) AS rn_real
      FROM calc
    )
    SELECT c.id, linea_id, peso,
      (base_est  + CASE WHEN rn_est  <= left_est  THEN 1 ELSE 0 END) / 100.0,
      CASE WHEN v_has_real THEN (base_real + CASE WHEN rn_real <= left_real THEN 1 ELSE 0 END) / 100.0 ELSE NULL END,
      false
    FROM ranked;
  END LOOP;
END; $$;

-- ---------------------------------------------------------------------
-- 6) Reconciliación: Σ reparto = coste (debe devolver 0 filas)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconciliar_costes(p_importacion_id uuid)
RETURNS TABLE (coste_id uuid, tipo text, esperado_est numeric, suma_est numeric, esperado_real numeric, suma_real numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.tipo_coste_codigo,
         c.importe_estimado_cop, COALESCE(sum(r.importe_estimado_cop),0),
         c.importe_real_cop,     COALESCE(sum(r.importe_real_cop),0)
  FROM public.importacion_costes c
  LEFT JOIN public.importacion_coste_reparto r ON r.coste_id = c.id
  WHERE c.importacion_id = p_importacion_id AND c.deleted_at IS NULL
    AND COALESCE(c.capitalizable,false) = true AND c.criterio_reparto <> 'manual'
  GROUP BY c.id, c.tipo_coste_codigo, c.importe_estimado_cop, c.importe_real_cop
  HAVING COALESCE(c.importe_estimado_cop,0) <> COALESCE(sum(r.importe_estimado_cop),0)
      OR COALESCE(c.importe_real_cop,0)     <> COALESCE(sum(r.importe_real_cop),0);
$$;

-- ---------------------------------------------------------------------
-- 7) Condición de costes resueltos (PREPARADA para I-4; el guard I-2 no la usa)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importacion_costes_resueltos(p_importacion_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.importacion_costes
    WHERE importacion_id = p_importacion_id AND deleted_at IS NULL
      AND COALESCE(capitalizable,false) = true
      AND importe_real IS NULL AND sin_coste_real = false
  );
$$;

-- ---------------------------------------------------------------------
-- 8) Vistas de landed cost (security_invoker: la RLS del llamante aplica)
--    landed provisional = fallback real->estimado POR COMPONENTE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_importacion_landed WITH (security_invoker = true) AS
SELECT
  l.id AS linea_id, l.importacion_id, l.referencia_id, l.cantidad_unidades,
  l.importe_mercancia_cop_est  AS mercancia_est_cop,
  l.importe_mercancia_cop_real AS mercancia_real_cop,
  (CASE WHEN l.precio_compra_real IS NOT NULL THEN l.importe_mercancia_cop_real ELSE l.importe_mercancia_cop_est END) AS mercancia_prov_cop,
  COALESCE(rep.est, 0)  AS costes_est_cop,
  COALESCE(rep.rea, 0)  AS costes_real_cop,
  COALESCE(rep.prov, 0) AS costes_prov_cop,
  -- Landed
  (l.importe_mercancia_cop_est + COALESCE(rep.est,0)) AS landed_est_cop,
  (l.importe_mercancia_cop_real + COALESCE(rep.rea,0)) AS landed_real_cop,
  ((CASE WHEN l.precio_compra_real IS NOT NULL THEN l.importe_mercancia_cop_real ELSE l.importe_mercancia_cop_est END) + COALESCE(rep.prov,0)) AS landed_prov_cop,
  -- Cuánto del provisional procede AÚN de estimaciones
  ((CASE WHEN l.precio_compra_real IS NULL THEN l.importe_mercancia_cop_est ELSE 0 END) + COALESCE(rep.prov_desde_est,0)) AS prov_desde_estimado_cop,
  -- Unitarios
  round(((CASE WHEN l.precio_compra_real IS NOT NULL THEN l.importe_mercancia_cop_real ELSE l.importe_mercancia_cop_est END) + COALESCE(rep.prov,0)) / NULLIF(l.cantidad_unidades,0), 4) AS landed_prov_unitario
FROM public.importacion_lineas l
LEFT JOIN LATERAL (
  SELECT
    sum(r.importe_estimado_cop) AS est,
    sum(r.importe_real_cop)     AS rea,
    sum(COALESCE(r.importe_real_cop, r.importe_estimado_cop)) AS prov,
    sum(CASE WHEN r.importe_real_cop IS NULL THEN r.importe_estimado_cop ELSE 0 END) AS prov_desde_est
  FROM public.importacion_coste_reparto r
  JOIN public.importacion_costes c ON c.id = r.coste_id AND COALESCE(c.capitalizable,false) = true AND c.deleted_at IS NULL
  WHERE r.importacion_linea_id = l.id
) rep ON true;

CREATE OR REPLACE VIEW public.v_importacion_landed_sku WITH (security_invoker = true) AS
SELECT importacion_id, referencia_id,
       sum(cantidad_unidades) AS unidades,
       sum(landed_est_cop)  AS landed_est_cop,
       sum(landed_real_cop) AS landed_real_cop,
       sum(landed_prov_cop) AS landed_prov_cop,
       sum(prov_desde_estimado_cop) AS prov_desde_estimado_cop,
       round(sum(landed_prov_cop) / NULLIF(sum(cantidad_unidades),0), 4) AS landed_prov_unitario
FROM public.v_importacion_landed
GROUP BY importacion_id, referencia_id;

-- ---------------------------------------------------------------------
-- 9) Reemplazo del guard de estados: reglas LOGÍSTICAS de I-1 INTACTAS +
--    reglas de estado_coste (I-2: solo estimado<->provisional; definitivo NO).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importaciones_guard_estados()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- estado_coste (I-2)
  IF NEW.estado_coste IS DISTINCT FROM OLD.estado_coste THEN
    IF NEW.estado_coste = 'definitivo' THEN
      RAISE EXCEPTION 'estado_coste=definitivo se habilita en I-4 (motor de recepciones).';
    END IF;
    IF NOT ((OLD.estado_coste = 'estimado'    AND NEW.estado_coste = 'provisional')
         OR (OLD.estado_coste = 'provisional' AND NEW.estado_coste = 'estimado')) THEN
      RAISE EXCEPTION 'Transición de estado_coste no permitida: % -> %.', OLD.estado_coste, NEW.estado_coste;
    END IF;
    IF OLD.estado_coste = 'estimado' AND NEW.estado_coste = 'provisional'
       AND NOT EXISTS (SELECT 1 FROM public.importacion_costes
                       WHERE importacion_id = NEW.id AND importe_real IS NOT NULL AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Para pasar a provisional debe existir al menos un coste con importe real.';
    END IF;
  END IF;

  -- estado_logistico (I-1, sin cambios)
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
-- (el trigger trg_importaciones_guard_estados ya existe de 0031; CREATE OR REPLACE de la función basta)

-- ---------------------------------------------------------------------
-- 10) RLS + GRANTs
-- ---------------------------------------------------------------------
ALTER TABLE public.importacion_costes ENABLE ROW LEVEL SECURITY;
CREATE POLICY impcostes_select ON public.importacion_costes FOR SELECT USING (can_access_importaciones());
CREATE POLICY impcostes_ins    ON public.importacion_costes FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY impcostes_upd    ON public.importacion_costes FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY impcostes_del    ON public.importacion_costes FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_costes TO authenticated;

ALTER TABLE public.importacion_coste_reparto ENABLE ROW LEVEL SECURITY;
CREATE POLICY imprep_select ON public.importacion_coste_reparto FOR SELECT USING (can_access_importaciones());
CREATE POLICY imprep_ins    ON public.importacion_coste_reparto FOR INSERT WITH CHECK (can_manage_importaciones());
CREATE POLICY imprep_upd    ON public.importacion_coste_reparto FOR UPDATE
  USING (can_manage_importaciones()) WITH CHECK (can_manage_importaciones());
CREATE POLICY imprep_del    ON public.importacion_coste_reparto FOR DELETE USING (can_manage_importaciones());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacion_coste_reparto TO authenticated;

GRANT SELECT ON public.v_importacion_landed TO authenticated;
GRANT SELECT ON public.v_importacion_landed_sku TO authenticated;
