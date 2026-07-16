-- =====================================================================
-- 0013 — Tarifa base (neto) por canal + trazabilidad de descuento
-- =====================================================================

-- Precio base NETO (sin IVA) por canal, en cada referencia.
ALTER TABLE referencias
  ADD COLUMN IF NOT EXISTS precio_food_service_cop numeric,
  ADD COLUMN IF NOT EXISTS precio_retail_cop numeric,
  ADD COLUMN IF NOT EXISTS precio_industria_cop numeric;

-- Trazabilidad del precio en cada línea de pedido:
--  precio_base_cop = tarifa neta del canal (antes de descuento)
--  descuento_pct   = % de descuento aplicado en esa línea
-- (precio_unitario_cop se mantiene = precio final unitario CON IVA)
ALTER TABLE pedido_lineas
  ADD COLUMN IF NOT EXISTS precio_base_cop numeric,
  ADD COLUMN IF NOT EXISTS descuento_pct numeric;
