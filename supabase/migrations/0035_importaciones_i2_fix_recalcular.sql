-- =====================================================================
-- 0035 — Hotfix I-2: recalcular_reparto
-- =====================================================================
-- El INSERT ... SELECT de recalcular_reparto (0033) omitía `coste_id` (c.id)
-- como primera columna -> "INSERT has more target columns than expressions".
-- Ya está corregido dentro de 0033; este fichero replica el hotfix aplicado en
-- producción (migración `importaciones_i2_fix_recalcular`) para que el ledger
-- del repo coincida con el de prod. Idempotente (CREATE OR REPLACE).

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
                               ELSE l.importe_mercancia_cop_est
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
