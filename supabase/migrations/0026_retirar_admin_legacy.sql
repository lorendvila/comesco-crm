-- =====================================================================
-- 0026 — Fase 6A: retirada de `admin` legacy
-- =====================================================================
-- Ya no queda ningún usuario con rol 'admin' (migración de roles Fase 5). Se
-- retira 'admin' de las funciones de capacidad, se elimina la función huérfana
-- is_admin() (ninguna policy/trigger/función/RPC la usa) y se saca 'admin' del
-- CHECK de users.role. Comportamiento idéntico: nadie era 'admin'.

-- 1) Funciones de capacidad SIN 'admin' -------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_read_all()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','direccion','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_see_costs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','direccion','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_clientes()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_pedidos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_facturacion()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_inventario()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_referencias()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_users()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin','backoffice']), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_privileged()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = ANY (ARRAY['superadmin']), false);
$$;

-- 2) Eliminar la función huérfana is_admin() --------------------------
DROP FUNCTION IF EXISTS public.is_admin();

-- 3) CHECK de users.role sin 'admin' ----------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'direccion', 'backoffice', 'comercial'));
