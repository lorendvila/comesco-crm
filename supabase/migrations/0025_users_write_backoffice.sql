-- =====================================================================
-- 0025 — Fase 4: gestión de usuarios por backoffice (RLS = barrera real)
-- =====================================================================
-- El Edge admin-users escribe public.users con el JWT del que llama (la service
-- key NO salta RLS en este proyecto), así que la RLS decide de verdad quién
-- puede tocar qué fila de users. Esta policy es la barrera anti-escalada:
--
--   superadmin/admin : escritura total sobre users.
--   backoffice       : SOLO filas cuyo rol es 'comercial', y el resultado debe
--                      seguir siendo 'comercial' (WITH CHECK) -> no puede crear
--                      privilegiados, ni elevar un comercial, ni tocar su propia
--                      fila (backoffice) ni la de dirección/backoffice/superadmin.
--   dirección/comercial : ninguna escritura (no entran en la condición).
--
-- El guard de "no quedarse sin superadmin activo" y las operaciones de GoTrue
-- (alta de cuenta, reset de contraseña, que la RLS no cubre) se validan además
-- en el Edge.

DROP POLICY IF EXISTS users_write ON users;
CREATE POLICY users_write ON users FOR ALL
  USING      (is_superadmin() OR (app_role() = 'backoffice' AND role = 'comercial'))
  WITH CHECK (is_superadmin() OR (app_role() = 'backoffice' AND role = 'comercial'));
