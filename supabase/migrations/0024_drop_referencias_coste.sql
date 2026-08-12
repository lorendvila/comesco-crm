-- =====================================================================
-- 0024 — Fase 3 (contract): elimina la columna coste de referencias
-- =====================================================================
-- Paso "contract" del expand/contract iniciado en 0023. El coste ya vive en
-- referencia_costes (protegida) y la columna de referencias está anulada.
--
-- APLICAR SOLO DESPUÉS de redesplegar el frontend nuevo (el que ya NO
-- selecciona referencias.coste_almacen_cop). Si se aplica antes, la app vieja
-- desplegada que aún seleccione esa columna daría error (columna inexistente).

ALTER TABLE referencias DROP COLUMN IF EXISTS coste_almacen_cop;
