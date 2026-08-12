-- =====================================================================
-- 0020 — Oportunidades por líneas: consumo mensual NETO por referencia
-- =====================================================================
-- La oportunidad pasa de un "valor estimado" a mano a una suma de líneas
-- (referencia × cantidad mensual × precio neto tras descuento). El valor es
-- SIEMPRE neto (sin IVA): el IVA no forma parte del potencial comercial.
--
-- La tabla `oportunidad_lineas` ya existía (0001) con RLS; solo se le añaden
-- el descuento y el subtotal. `precio_estimado_cop` se reutiliza como precio
-- unitario base neto (antes de descuento), en paralelo a
-- `pedido_lineas.precio_base_cop`.

ALTER TABLE oportunidad_lineas
  ADD COLUMN IF NOT EXISTS descuento_pct numeric,   -- % de descuento de la línea
  ADD COLUMN IF NOT EXISTS subtotal_cop numeric;    -- valor mensual NETO de la línea

-- Fecha prevista de inicio de suministro, distinta de la fecha de cierre.
ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS fecha_inicio_suministro date;
