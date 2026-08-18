-- =====================================================================
-- 0037 — Fix I-2: chk_directo solo aplica a costes capitalizables
-- =====================================================================
-- Bug: chk_directo exigía destino de 'directo' también a costes NO capitalizables,
-- que nunca se reparten (recalcular_reparto los filtra). El tipo iva_importacion
-- trae criterio_reparto_default='directo' -> la UI ponía 'directo' y, sin destino,
-- el INSERT de un IVA no capitalizable violaba la constraint.
--
-- Corrección: la regla de destino de 'directo' se exige ÚNICAMENTE a los
-- capitalizables. Un no capitalizable puede existir sin criterio/destino de reparto.
-- Para capitalizables el comportamiento es IDÉNTICO al anterior (sin regresión).
-- `capitalizable` está poblado por el trigger BEFORE antes de validar la constraint.
-- Solo DDL de constraint: no toca filas, ni reparto, ni landed, ni nada fuera de alcance.

ALTER TABLE public.importacion_costes DROP CONSTRAINT chk_directo;
ALTER TABLE public.importacion_costes ADD CONSTRAINT chk_directo CHECK (
  NOT COALESCE(capitalizable, false)                       -- no capitalizable: sin reglas de reparto
  OR CASE WHEN criterio_reparto = 'directo'
       THEN ((referencia_id IS NOT NULL)::int + (linea_directa_id IS NOT NULL)::int) = 1
       ELSE referencia_id IS NULL AND linea_directa_id IS NULL
     END
);
