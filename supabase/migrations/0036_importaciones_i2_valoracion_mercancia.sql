-- =====================================================================
-- 0036 — Fix I-2: valoración COP de la mercancía por TC efectivo
-- =====================================================================
-- Bug: las columnas generadas de COP dependían de importacion_lineas.tc_estimado,
-- que nunca se rellena y NO puede ver el tc_presupuestado de la cabecera -> landed
-- estimado = NULL/0. Corrección: valorar la mercancía EN VIVO con el TC efectivo
-- = COALESCE(TC override de línea, tc_presupuestado de la cabecera); moneda COP -> 1;
-- si no hay ninguno (divisa) -> NULL ("Pendiente de TC", nunca 0). Sin copiar el TC
-- a las líneas ni backfill. READ-ONLY respecto a inventario/referencia_costes/pedidos/kardex.

-- 1) Helper de TC efectivo (moneda COP => 1; si no, override de línea o TC de cabecera; NULL si falta)
CREATE OR REPLACE FUNCTION public.tc_efectivo(p_moneda text, p_tc_linea numeric, p_tc_cabecera numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_moneda = 'COP' THEN 1 ELSE COALESCE(p_tc_linea, p_tc_cabecera) END;
$$;

-- 2) recalcular_reparto: el peso 'valor'/'directo(referencia)' se valora con el TC efectivo
--    (no con la columna generada, que se retira). Si una línea no puede valorarse (divisa
--    sin TC) -> peso NULL -> el propio motor lanza el error "faltan datos" listando la línea.
CREATE OR REPLACE FUNCTION public.recalcular_reparto(p_importacion_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; v_faltan text; v_cents_est bigint; v_cents_real bigint; v_has_real boolean; v_tp numeric;
BEGIN
  SELECT tc_presupuestado INTO v_tp FROM public.importaciones WHERE id = p_importacion_id;
  FOR c IN
    SELECT * FROM public.importacion_costes
    WHERE importacion_id = p_importacion_id AND deleted_at IS NULL
      AND COALESCE(capitalizable, false) = true AND criterio_reparto <> 'manual'
  LOOP
    DROP TABLE IF EXISTS _tgt;
    CREATE TEMP TABLE _tgt ON COMMIT DROP AS
    SELECT l.id AS linea_id,
      CASE c.criterio_reparto
        WHEN 'valor'    THEN l.cantidad_unidades * l.precio_compra * public.tc_efectivo(l.moneda, l.tc_estimado, v_tp)
        WHEN 'unidades' THEN l.cantidad_unidades
        WHEN 'cajas'    THEN l.cajas
        WHEN 'pallets'  THEN l.pallets
        WHEN 'peso'     THEN l.peso_kg
        WHEN 'volumen'  THEN l.volumen_m3
        WHEN 'directo'  THEN CASE
                               WHEN c.linea_directa_id IS NOT NULL THEN (CASE WHEN l.id = c.linea_directa_id THEN 1 ELSE NULL END)
                               ELSE l.cantidad_unidades * l.precio_compra * public.tc_efectivo(l.moneda, l.tc_estimado, v_tp)
                             END
      END AS peso
    FROM public.importacion_lineas l
    WHERE l.importacion_id = p_importacion_id
      AND (c.criterio_reparto <> 'directo'
           OR (c.linea_directa_id IS NOT NULL AND l.id = c.linea_directa_id)
           OR (c.referencia_id IS NOT NULL AND l.referencia_id = c.referencia_id));
    IF NOT EXISTS (SELECT 1 FROM _tgt) THEN
      RAISE EXCEPTION 'Coste % (%): no hay líneas objetivo para el reparto.', c.id, c.concepto;
    END IF;
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

-- 3) Retirar las vistas dependientes y las columnas generadas obsoletas.
DROP VIEW IF EXISTS public.v_importacion_landed_sku;
DROP VIEW IF EXISTS public.v_importacion_landed;
ALTER TABLE public.importacion_lineas
  DROP COLUMN IF EXISTS importe_mercancia_cop_est,
  DROP COLUMN IF EXISTS importe_mercancia_real,
  DROP COLUMN IF EXISTS importe_mercancia_cop_real;

-- 4) Vista de landed recomputada con TC efectivo (mercancía siempre valorada si hay TC).
CREATE VIEW public.v_importacion_landed WITH (security_invoker = true) AS
SELECT
  b.linea_id, b.importacion_id, b.referencia_id, b.cantidad_unidades, b.moneda,
  b.tc_efectivo_est, b.tc_origen_est,
  b.mercancia_est_cop, b.mercancia_real_cop, b.mercancia_prov_cop,
  COALESCE(rep.est, 0)  AS costes_est_cop,
  COALESCE(rep.rea, 0)  AS costes_real_cop,
  COALESCE(rep.prov, 0) AS costes_prov_cop,
  (b.mercancia_est_cop  + COALESCE(rep.est, 0))  AS landed_est_cop,
  (b.mercancia_real_cop + COALESCE(rep.rea, 0))  AS landed_real_cop,
  (b.mercancia_prov_cop + COALESCE(rep.prov, 0)) AS landed_prov_cop,
  (b.mercancia_prov_desde_est + COALESCE(rep.prov_desde_est, 0)) AS prov_desde_estimado_cop,
  round((b.mercancia_prov_cop + COALESCE(rep.prov, 0)) / NULLIF(b.cantidad_unidades, 0), 4) AS landed_prov_unitario
FROM (
  SELECT
    l.id AS linea_id, l.importacion_id, l.referencia_id, l.cantidad_unidades, l.moneda,
    public.tc_efectivo(l.moneda, l.tc_estimado, i.tc_presupuestado) AS tc_efectivo_est,
    CASE WHEN l.moneda = 'COP' THEN 'cop'
         WHEN l.tc_estimado IS NOT NULL THEN 'override'
         WHEN i.tc_presupuestado IS NOT NULL THEN 'cabecera'
         ELSE 'pendiente' END AS tc_origen_est,
    round(l.cantidad_unidades * l.precio_compra
          * public.tc_efectivo(l.moneda, l.tc_estimado, i.tc_presupuestado), 2) AS mercancia_est_cop,
    round(l.cantidad_unidades * COALESCE(l.precio_compra_real, l.precio_compra)
          * public.tc_efectivo(l.moneda, COALESCE(l.tc_real, l.tc_estimado), i.tc_presupuestado), 2) AS mercancia_real_cop,
    round(l.cantidad_unidades * (CASE WHEN l.precio_compra_real IS NOT NULL THEN l.precio_compra_real ELSE l.precio_compra END)
          * public.tc_efectivo(l.moneda,
              CASE WHEN l.precio_compra_real IS NOT NULL THEN COALESCE(l.tc_real, l.tc_estimado) ELSE l.tc_estimado END,
              i.tc_presupuestado), 2) AS mercancia_prov_cop,
    (CASE WHEN l.precio_compra_real IS NULL
          THEN round(l.cantidad_unidades * l.precio_compra * public.tc_efectivo(l.moneda, l.tc_estimado, i.tc_presupuestado), 2)
          ELSE 0 END) AS mercancia_prov_desde_est
  FROM public.importacion_lineas l
  JOIN public.importaciones i ON i.id = l.importacion_id
) b
LEFT JOIN LATERAL (
  SELECT
    sum(r.importe_estimado_cop) AS est,
    sum(r.importe_real_cop)     AS rea,
    sum(COALESCE(r.importe_real_cop, r.importe_estimado_cop)) AS prov,
    sum(CASE WHEN r.importe_real_cop IS NULL THEN r.importe_estimado_cop ELSE 0 END) AS prov_desde_est
  FROM public.importacion_coste_reparto r
  JOIN public.importacion_costes c ON c.id = r.coste_id AND COALESCE(c.capitalizable, false) = true AND c.deleted_at IS NULL
  WHERE r.importacion_linea_id = b.linea_id
) rep ON true;

CREATE VIEW public.v_importacion_landed_sku WITH (security_invoker = true) AS
SELECT importacion_id, referencia_id,
       sum(cantidad_unidades) AS unidades,
       sum(landed_est_cop)  AS landed_est_cop,
       sum(landed_real_cop) AS landed_real_cop,
       sum(landed_prov_cop) AS landed_prov_cop,
       sum(prov_desde_estimado_cop) AS prov_desde_estimado_cop,
       round(sum(landed_prov_cop) / NULLIF(sum(cantidad_unidades), 0), 4) AS landed_prov_unitario
FROM public.v_importacion_landed
GROUP BY importacion_id, referencia_id;

GRANT SELECT ON public.v_importacion_landed TO authenticated;
GRANT SELECT ON public.v_importacion_landed_sku TO authenticated;
