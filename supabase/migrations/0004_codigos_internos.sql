-- =====================================================================
-- COMESCO CRM — Códigos internos legibles y correlativos
-- Añade codigo_interno a clientes (CLI-000001...) y referencias (REF-000001...).
-- Lo genera la base de datos automáticamente en cada alta, vía una secuencia.
-- El UUID sigue siendo la clave real de relación; el código es solo para personas.
-- La base está vacía, así que añadir la columna no afecta a datos existentes.
-- =====================================================================

-- ---- clientes ----
CREATE SEQUENCE clientes_codigo_seq START 1;
ALTER TABLE clientes
  ADD COLUMN codigo_interno VARCHAR(12) UNIQUE NOT NULL
  DEFAULT ('CLI-' || LPAD(nextval('clientes_codigo_seq')::text, 6, '0'));
ALTER SEQUENCE clientes_codigo_seq OWNED BY clientes.codigo_interno;
GRANT USAGE, SELECT ON SEQUENCE clientes_codigo_seq TO authenticated;

-- ---- referencias ----
CREATE SEQUENCE referencias_codigo_seq START 1;
ALTER TABLE referencias
  ADD COLUMN codigo_interno VARCHAR(12) UNIQUE NOT NULL
  DEFAULT ('REF-' || LPAD(nextval('referencias_codigo_seq')::text, 6, '0'));
ALTER SEQUENCE referencias_codigo_seq OWNED BY referencias.codigo_interno;
GRANT USAGE, SELECT ON SEQUENCE referencias_codigo_seq TO authenticated;
