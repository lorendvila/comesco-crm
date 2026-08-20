-- =====================================================================
-- 0039 — I-2: valoración REAL de la mercancía (precio real + TC real)
-- =====================================================================
-- Contexto: importacion_lineas ya tenía precio_compra_real y tc_real, pero
-- (a) no había forma de introducirlos y (b) las vistas hacían fallback silencioso
-- al estimado, de modo que "mercancía real" y "landed real" mostraban la ESTIMACIÓN
-- disfrazada de real. Con IMP-2026-001 sin ningún real introducido, la vista
-- devolvía mercancia_real = 1.800.000 y landed_real = 2.124.000: un "ahorro"
-- de 126.000 COP que no existe.
--
-- Corrección: semántica ESTRICTA de real. Un componente solo es real cuando su
-- real está COMPLETO; si no, la vista devuelve NULL (nunca 0, nunca el estimado).
-- El estimado se conserva SIEMPRE para poder medir desviaciones.
--
-- NO se modifica recalcular_reparto: la base de reparto sigue siendo
-- cantidad × precio_compra (estimado) × TC efectivo estimado. La llegada de
-- precios/TC reales NO redistribuye retrospectivamente los costes entre líneas.
-- READ-ONLY respecto a kardex, recepciones, inventario, referencia_costes y pedidos.

-- ---------------------------------------------------------------------
-- 1) Helper de TC real efectivo
--    Moneda COP => 1. Divisa => tc_real EXPLÍCITO, sin fallback a tc_estimado
--    ni al TC presupuestado de la cabecera: un TC real desconocido es NULL
--    ("pendiente de TC real"), no una estimación reciclada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tc_real_efectivo(p_moneda text, p_tc_real numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_moneda = 'COP' THEN 1 ELSE p_tc_real END;
$$;

COMMENT ON FUNCTION public.tc_real_efectivo(text, numeric) IS
  'TC real efectivo de una línea de mercancía: 1 para COP; para divisa, el tc_real explícito (NULL si no se ha informado). Sin fallback al TC estimado.';

-- ---------------------------------------------------------------------
-- 2) Guardas de datos de la valoración real
--    (precio_compra_real >= 0 ya existe desde I-2)
-- ---------------------------------------------------------------------
ALTER TABLE public.importacion_lineas
  DROP CONSTRAINT IF EXISTS importacion_lineas_tc_real_check;
ALTER TABLE public.importacion_lineas
  ADD CONSTRAINT importacion_lineas_tc_real_check
  CHECK (tc_real IS NULL OR tc_real > 0);

COMMENT ON COLUMN public.importacion_lineas.precio_compra_real IS
  'Precio de compra unitario REAL (moneda de la línea) según factura definitiva del proveedor. NULL = todavía no informado; nunca se sustituye por el estimado.';
COMMENT ON COLUMN public.importacion_lineas.tc_real IS
  'TC real aplicado a la mercancía de la línea. Obligatorio para considerar real una línea en divisa; irrelevante en COP (TC real = 1).';

-- ---------------------------------------------------------------------
-- 2 bis) Semántica de sin_coste_real: TRES estados de un coste, sin ambigüedad
--   El flag existía desde I-2 bajo el epígrafe "RESOLUCIÓN (cierre del concepto
--   sin factura real)" pero no tenía NINGÚN efecto económico: un coste marcado
--   aparecía como "Resuelto" y sin embargo seguía aportando su ESTIMADO al
--   provisional y al "% aún estimado", de modo que la importación nunca podía
--   converger a 0% estimado. Aquí se fija y se hace cumplir su significado.
--
--   1) DESCONOCIDO        importe_real NULL, sin_coste_real=false
--      -> provisional = ESTIMADO, sigue pendiente, cuenta en "% aún estimado".
--   2) CONFIRMADO SIN COSTE  importe_real NULL, sin_coste_real=true
--      -> real económico = 0, provisional = 0, resuelto, NO pendiente,
--         NO cuenta en "% aún estimado", desviación = 0 - estimado.
--   3) REAL CONOCIDO      importe_real informado, sin_coste_real=false
--      -> real = importe real, provisional = real, resuelto,
--         desviación = real - estimado.
--   No existe una cuarta situación: (2) y (3) son mutuamente excluyentes.
-- ---------------------------------------------------------------------
COMMENT ON COLUMN public.importacion_costes.sin_coste_real IS
  'CONFIRMADO SIN COSTE: el concepto se cierra con real económico = 0 porque finalmente NO se incurrió (no es "la factura aún no ha llegado"; para eso se deja importe_real NULL con el flag en false). Excluyente con importe_real informado (chk_sin_coste_real_excluyente). Tres estados: importe_real NULL + flag false = DESCONOCIDO (provisional usa el estimado); importe_real NULL + flag true = CONFIRMADO SIN COSTE (provisional 0, desviación = -estimado); importe_real informado + flag false = REAL CONOCIDO.';

-- "Confirmado sin coste" y "real conocido con importe" no pueden coexistir.
ALTER TABLE public.importacion_costes
  DROP CONSTRAINT IF EXISTS chk_sin_coste_real_excluyente;
ALTER TABLE public.importacion_costes
  ADD CONSTRAINT chk_sin_coste_real_excluyente
  CHECK (NOT (sin_coste_real AND importe_real IS NOT NULL));

-- ---------------------------------------------------------------------
-- 3) Guard de líneas: permitir informar la valoración REAL después de confirmada
--    Motivo: la factura definitiva del proveedor llega tarde (mercancía en
--    tránsito o ya recibida), igual que las facturas de costes. El guard actual
--    bloqueaba CUALQUIER UPDATE fuera de borrador/confirmada, lo que hacía
--    imposible registrar el coste real de la mercancía.
--    Se permite EXCLUSIVAMENTE cambiar precio_compra_real y tc_real, y solo si
--    la importación no está anulada ni con estado_coste=definitivo. Cualquier
--    otro cambio (cantidades, precio estimado, TC estimado, referencia...) sigue
--    bloqueado igual que antes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importacion_lineas_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estado text; v_estado_coste text; v_serv boolean; v_imp uuid; v_solo_real boolean;
BEGIN
  v_imp := COALESCE(NEW.importacion_id, OLD.importacion_id);
  SELECT estado_logistico, estado_coste INTO v_estado, v_estado_coste
    FROM public.importaciones WHERE id = v_imp;

  IF v_estado IS NOT NULL AND v_estado NOT IN ('borrador','confirmada') THEN
    -- ¿El UPDATE toca únicamente la valoración real? (se ignoran updated_at y la
    -- columna generada importe_mercancia, que en BEFORE aún no está calculada)
    v_solo_real := TG_OP = 'UPDATE' AND (
      (to_jsonb(NEW) - 'precio_compra_real' - 'tc_real' - 'updated_at' - 'importe_mercancia')
      = (to_jsonb(OLD) - 'precio_compra_real' - 'tc_real' - 'updated_at' - 'importe_mercancia')
    );
    IF NOT COALESCE(v_solo_real, false) THEN
      RAISE EXCEPTION 'La mercancía solo puede editarse mientras la importación está en borrador o confirmada (estado: %).', v_estado;
    END IF;
    IF v_estado = 'anulada' THEN
      RAISE EXCEPTION 'La importación está anulada: no se puede informar la valoración real de la mercancía.';
    END IF;
    IF v_estado_coste = 'definitivo' THEN
      RAISE EXCEPTION 'La valoración real de la mercancía es inmutable con estado_coste=definitivo. Reábrela a provisional primero.';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT es_servicio INTO v_serv FROM public.referencias WHERE id = NEW.referencia_id;
    IF v_serv THEN RAISE EXCEPTION 'Una referencia de servicio no puede ser mercancía de importación.'; END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- ---------------------------------------------------------------------
-- 4) v_importacion_landed — semántica estricta de real
--    Se usa CREATE OR REPLACE (solo se AÑADEN columnas al final) para no perder
--    los GRANT existentes ni romper la vista dependiente _sku.
--
--    mercancia_estado: 'real' | 'pendiente_tc_real' | 'pendiente'
--    mercancia_real_cop : NULL salvo que el real esté COMPLETO.
--    costes_real_cop    : NULL si queda algún coste capitalizable sin resolver.
--    landed_real_cop    : NULL si mercancía o costes no están completos.
--    *_prov_cop         : usa el real SOLO si está completo; si no, el estimado.
--
--    Costes, según los tres estados fijados en (2 bis):
--      DESCONOCIDO           -> pendiente; prov = estimado; suma a prov_desde_est.
--      CONFIRMADO SIN COSTE  -> resuelto; real = 0; prov = 0; NO suma a prov_desde_est.
--      REAL CONOCIDO         -> resuelto; real = prov = importe real.
--    El ESTIMADO se conserva intacto en costes_est_cop/landed_est_cop en los tres
--    casos, de modo que la desviación de un confirmado sin coste es -estimado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_importacion_landed WITH (security_invoker = true) AS
WITH m AS (
  SELECT
    l.id AS linea_id, l.importacion_id, l.referencia_id, l.cantidad_unidades, l.moneda,
    public.tc_efectivo(l.moneda, l.tc_estimado, i.tc_presupuestado) AS tc_efectivo_est,
    CASE
      WHEN l.moneda = 'COP'              THEN 'cop'
      WHEN l.tc_estimado IS NOT NULL     THEN 'override'
      WHEN i.tc_presupuestado IS NOT NULL THEN 'cabecera'
      ELSE 'pendiente'
    END AS tc_origen_est,
    public.tc_real_efectivo(l.moneda, l.tc_real) AS tc_real_efectivo,
    CASE
      WHEN l.precio_compra_real IS NULL                              THEN 'pendiente'
      WHEN public.tc_real_efectivo(l.moneda, l.tc_real) IS NULL      THEN 'pendiente_tc_real'
      ELSE 'real'
    END AS mercancia_estado,
    round(l.cantidad_unidades * l.precio_compra
          * public.tc_efectivo(l.moneda, l.tc_estimado, i.tc_presupuestado), 2) AS mercancia_est_cop,
    CASE
      WHEN l.precio_compra_real IS NOT NULL
       AND public.tc_real_efectivo(l.moneda, l.tc_real) IS NOT NULL
      THEN round(l.cantidad_unidades * l.precio_compra_real
                 * public.tc_real_efectivo(l.moneda, l.tc_real), 2)
    END AS mercancia_real_cop
  FROM public.importacion_lineas l
  JOIN public.importaciones i ON i.id = l.importacion_id
)
SELECT
  m.linea_id,
  m.importacion_id,
  m.referencia_id,
  m.cantidad_unidades,
  m.moneda,
  m.tc_efectivo_est,
  m.tc_origen_est,
  m.mercancia_est_cop,
  m.mercancia_real_cop,
  COALESCE(m.mercancia_real_cop, m.mercancia_est_cop) AS mercancia_prov_cop,
  COALESCE(rep.est, 0) AS costes_est_cop,
  CASE WHEN COALESCE(rep.pendientes, 0) = 0 THEN COALESCE(rep.rea, 0) END AS costes_real_cop,
  COALESCE(rep.prov, 0) AS costes_prov_cop,
  m.mercancia_est_cop + COALESCE(rep.est, 0) AS landed_est_cop,
  CASE
    WHEN m.mercancia_estado = 'real' AND COALESCE(rep.pendientes, 0) = 0
    THEN m.mercancia_real_cop + COALESCE(rep.rea, 0)
  END AS landed_real_cop,
  COALESCE(m.mercancia_real_cop, m.mercancia_est_cop) + COALESCE(rep.prov, 0) AS landed_prov_cop,
  (CASE WHEN m.mercancia_estado = 'real' THEN 0 ELSE m.mercancia_est_cop END)
    + COALESCE(rep.prov_desde_est, 0) AS prov_desde_estimado_cop,
  round((COALESCE(m.mercancia_real_cop, m.mercancia_est_cop) + COALESCE(rep.prov, 0))
        / NULLIF(m.cantidad_unidades, 0), 4) AS landed_prov_unitario,
  -- ---- columnas nuevas (0039) ----
  m.tc_real_efectivo,
  m.mercancia_estado,
  COALESCE(rep.pendientes, 0)::int AS costes_pendientes_n,
  (m.mercancia_estado = 'real' AND COALESCE(rep.pendientes, 0) = 0) AS real_completo
FROM m
LEFT JOIN LATERAL (
  SELECT
    sum(r.importe_estimado_cop) AS est,
    -- "sin coste real" aporta 0 al real, no el estimado
    sum(CASE WHEN c.sin_coste_real THEN 0 ELSE r.importe_real_cop END) AS rea,
    sum(COALESCE(CASE WHEN c.sin_coste_real THEN 0 ELSE r.importe_real_cop END,
                 r.importe_estimado_cop)) AS prov,
    sum(CASE WHEN r.importe_real_cop IS NULL AND NOT c.sin_coste_real
             THEN r.importe_estimado_cop ELSE 0 END) AS prov_desde_est,
    count(*) FILTER (WHERE r.importe_real_cop IS NULL AND NOT c.sin_coste_real) AS pendientes
  FROM public.importacion_coste_reparto r
  JOIN public.importacion_costes c
    ON c.id = r.coste_id
   AND COALESCE(c.capitalizable, false) = true
   AND c.deleted_at IS NULL
  WHERE r.importacion_linea_id = m.linea_id
) rep ON true;

COMMENT ON VIEW public.v_importacion_landed IS
  'Landed cost por línea de mercancía. Real ESTRICTO: mercancia_real_cop/costes_real_cop/landed_real_cop son NULL mientras el componente no esté completo (nunca 0 ni el estimado). El provisional usa el real solo si está completo; prov_desde_estimado_cop mide cuánto sigue siendo estimación. La base de reparto de costes se mantiene sobre el valor ESTIMADO (ver recalcular_reparto).';

-- ---------------------------------------------------------------------
-- 5) v_importacion_landed_sku — la agregación también es estricta
--    sum() ignora los NULL, así que un total "real" con líneas incompletas
--    parecería cerrado: se anula explícitamente si alguna línea no está completa.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_importacion_landed_sku WITH (security_invoker = true) AS
SELECT
  importacion_id,
  referencia_id,
  sum(cantidad_unidades) AS unidades,
  sum(landed_est_cop) AS landed_est_cop,
  CASE WHEN bool_and(real_completo) THEN sum(landed_real_cop) END AS landed_real_cop,
  sum(landed_prov_cop) AS landed_prov_cop,
  sum(prov_desde_estimado_cop) AS prov_desde_estimado_cop,
  round(sum(landed_prov_cop) / NULLIF(sum(cantidad_unidades), 0), 4) AS landed_prov_unitario,
  -- ---- columnas nuevas (0039) ----
  bool_and(real_completo) AS real_completo,
  sum(mercancia_est_cop) AS mercancia_est_cop,
  CASE WHEN bool_and(mercancia_estado = 'real') THEN sum(mercancia_real_cop) END AS mercancia_real_cop,
  sum(mercancia_prov_cop) AS mercancia_prov_cop
FROM public.v_importacion_landed
GROUP BY importacion_id, referencia_id;

COMMENT ON VIEW public.v_importacion_landed_sku IS
  'Agregado del landed cost por referencia. Los totales reales son NULL si alguna línea de la referencia sigue incompleta.';
