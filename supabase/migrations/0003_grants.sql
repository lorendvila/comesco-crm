-- =====================================================================
-- COMESCO CRM — Permisos de tabla (grants)
-- La RLS (0002) decide QUÉ FILAS ve cada uno. Estos grants conceden el
-- permiso base para acceder a las TABLAS al rol de usuarios logueados.
--   authenticated = usuario logueado (admin o comercial) -> acceso, luego RLS filtra
--   anon          = visitante sin login -> SIN acceso (CRM privado)
-- Idempotente: volver a ejecutarlo no causa error.
-- =====================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Que las tablas/secuencias que creemos en el futuro hereden el permiso.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
