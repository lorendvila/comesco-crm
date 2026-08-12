-- =====================================================================
-- 0023 — Rediseño de permisos · FASE 3 (protección real de costes)
-- =====================================================================
-- Saca el coste de la exposición general de `referencias` (SELECT abierto a
-- todos) y lo lleva a `referencia_costes`, protegida por RLS: solo lo consultan
-- superadmin/dirección/backoffice (can_see_costs). El comercial NO puede leerlo
-- ni por API, y por tanto no puede reconstruir márgenes.
--
-- Patrón expand/contract (para no romper la app desplegada que aún lee
-- referencias.coste_almacen_cop):
--   0023 (expand+seguro): crea la tabla, copia el coste, RLS, y ANULA la
--        columna vieja (cierra la fuga ya; la app vieja lee null, degradada).
--   0024 (contract): DROP de la columna, tras el redespliegue del frontend.

-- 1) Tabla protegida de costes -----------------------------------------
CREATE TABLE IF NOT EXISTS referencia_costes (
  referencia_id     uuid PRIMARY KEY REFERENCES referencias(id) ON DELETE CASCADE,
  coste_almacen_cop numeric,           -- coste hasta almacén CON IVA (del maestro)
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE referencia_costes ENABLE ROW LEVEL SECURITY;

-- Lectura: quien puede ver costes (superadmin/dirección/backoffice/admin).
CREATE POLICY referencia_costes_select ON referencia_costes FOR SELECT
  USING (can_see_costs());
-- Escritura: quien gestiona el maestro de producto (superadmin/backoffice/admin).
-- Dirección ve costes pero NO los modifica.
CREATE POLICY referencia_costes_write ON referencia_costes FOR ALL
  USING (can_manage_referencias()) WITH CHECK (can_manage_referencias());

-- 2) Copia del coste actual --------------------------------------------
INSERT INTO referencia_costes (referencia_id, coste_almacen_cop)
SELECT id, coste_almacen_cop FROM referencias WHERE coste_almacen_cop IS NOT NULL
ON CONFLICT (referencia_id) DO UPDATE SET coste_almacen_cop = EXCLUDED.coste_almacen_cop;

-- 3) Cierra la fuga en la columna abierta (dato ya salvado arriba) ------
-- La app desplegada que aún seleccione referencias.coste_almacen_cop leerá NULL
-- (degradado, sin error) hasta que se redespliegue el frontend nuevo.
UPDATE referencias SET coste_almacen_cop = NULL WHERE coste_almacen_cop IS NOT NULL;
