-- =====================================================================
-- 0021 — Rediseño de permisos · FASE 0 (aditivo, sin cambio de comportamiento)
-- =====================================================================
-- Prepara el terreno para los 4 roles nuevos (superadmin, direccion, backoffice,
-- comercial) SIN tocar todavía policies, usuarios ni frontend.
--
--  1) Amplía el CHECK de users.role: añade los 3 roles nuevos y CONSERVA 'admin'
--     durante la transición (se retirará en la Fase 6, cuando no quede ninguno).
--  2) Crea la capa de funciones de capacidad que usarán las policies en la
--     Fase 2. NADA las referencia aún -> comportamiento idéntico al actual.
--
-- Decisiones:
--  - `app_role()` es la ÚNICA fuente del rol efectivo (y exige cuenta activa,
--    igual que hoy hace is_admin()).
--  - Las capacidades se definen POR ÁREA y por separado, aunque hoy varias
--    compartan el mismo conjunto de roles: así cada área evoluciona sin tocar
--    las demás (granularidad pedida).
--  - Devuelven booleano ESTRICTO (COALESCE(..., false)): sin sesión válida ->
--    false, no NULL, para que combinaciones como NOT can_see_costs() sean seguras.
--  - 'admin' (legacy) se incluye en TODOS los conjuntos = máxima capacidad
--    durante la transición, para no romper el acceso de los admins actuales.
--  - is_admin() se deja INTACTA (las policies actuales la siguen usando hasta
--    la Fase 2).

-- 1) CHECK de role -----------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'direccion', 'backoffice', 'comercial', 'admin'));

-- 2) Rol efectivo del llamante (solo si la cuenta está activa) ----------
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users
  WHERE auth_user_id = auth.uid() AND is_active = true;
$$;

-- 3) Capacidades por área ---------------------------------------------
-- Tier de control total.
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','admin']), false);
$$;

-- Visibilidad global de negocio (cartera/pipeline/pedidos/informes completos).
CREATE OR REPLACE FUNCTION public.can_read_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','direccion','backoffice','admin']), false);
$$;

-- Ver coste y margen.
CREATE OR REPLACE FUNCTION public.can_see_costs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','direccion','backoffice','admin']), false);
$$;

-- Operar clientes (crear/editar/reasignar comercial). Dirección NO opera.
CREATE OR REPLACE FUNCTION public.can_manage_clientes()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Operar pedidos.
CREATE OR REPLACE FUNCTION public.can_manage_pedidos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Operar facturación y cobros (crear/editar/anular factura, vencimientos, pagos).
CREATE OR REPLACE FUNCTION public.can_manage_facturacion()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Operar inventario (crear/editar/ajustar stock).
CREATE OR REPLACE FUNCTION public.can_manage_inventario()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Crear/editar referencias (maestro de producto).
CREATE OR REPLACE FUNCTION public.can_manage_referencias()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Crear/gestionar usuarios comerciales.
CREATE OR REPLACE FUNCTION public.can_manage_users()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice','admin']), false);
$$;

-- Crear/editar roles no-comerciales y configuración crítica. Solo superadmin.
CREATE OR REPLACE FUNCTION public.can_manage_privileged()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','admin']), false);
$$;
