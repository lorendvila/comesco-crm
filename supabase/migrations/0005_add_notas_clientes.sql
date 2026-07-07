-- =====================================================================
-- COMESCO CRM — Columna de notas en clientes
-- Guarda las observaciones e info adicional de cada lead (productos de
-- interés, volumen potencial, prioridad, próxima acción, segmento, fuente...)
-- que el resto del esquema todavía no estructura. Evita perder datos en la
-- importación inicial. Más adelante se podrá estructurar en su módulo.
-- =====================================================================
ALTER TABLE clientes ADD COLUMN notas TEXT;
