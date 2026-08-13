-- =====================================================================
-- 0029 — Fase 6B (Bloque 2): no-DELETE físico + archivado con barrera dura
-- =====================================================================
-- Principio: los hechos económicos u operativos que ya ocurrieron no se borran
-- físicamente (ni Superadmin ni service_role). Se cancelan/anulan/archivan/
-- desactivan dejando trazabilidad.
--
-- Decisiones (aprobadas por Loren):
--  1) comunicaciones/condiciones_comerciales/demanda_estimada: mantienen DELETE.
--  2) almacenes: se BLOQUEA el DELETE físico (usar `activo`).
--  3) Archivar/restaurar (deleted_at) de clientes/referencias/oportunidades:
--     barrera DURA en BD -> solo Backoffice/Superadmin, ni comercial por API.
--  4) FKs peligrosas clientes->pedidos y referencias->inventario: CASCADE -> RESTRICT.
--
-- Distinción mantenida: oportunidades.etapa='cierre_perdido' = resultado comercial
-- (permanece en histórico/reporting); oportunidades.deleted_at = archivada.
--
-- Doble capa: (a) trigger BEFORE DELETE que lanza excepción -> barrera real,
-- cubre service_role y cascadas y da error explícito; (b) RLS sin DELETE ->
-- denegación en la capa de política para `authenticated`.

-- 0) Columna de archivado para oportunidades (clientes/referencias ya la tienen).
ALTER TABLE public.oportunidades ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 1) Barrera dura: prohibición de DELETE físico ---------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_delete_fisico()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'DELETE físico no permitido en "%": es un hecho económico/operativo. Usa cancelar/anular/archivar/desactivar según corresponda.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END; $fn$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos','inventario','clientes','referencias','oportunidades','users','almacenes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_no_delete_fisico ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_no_delete_fisico BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_fisico()', t);
  END LOOP;
END $$;

-- 2) RLS: retirar la capacidad de DELETE ---------------------------------------
--    Se parten las policies FOR ALL en INSERT + UPDATE copiando EXACTAMENTE su
--    USING/WITH CHECK actual (solo se elimina el DELETE; ningún otro cambio).

-- pedidos: (can_manage_pedidos() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
DROP POLICY IF EXISTS pedidos_write ON pedidos;
CREATE POLICY pedidos_write_ins ON pedidos FOR INSERT
  WITH CHECK (can_manage_pedidos() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()));
CREATE POLICY pedidos_write_upd ON pedidos FOR UPDATE
  USING      (can_manage_pedidos() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_pedidos() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()));

-- clientes: (can_manage_clientes() OR comercial_asignado_id = current_user_id())
DROP POLICY IF EXISTS clientes_write ON clientes;
CREATE POLICY clientes_write_ins ON clientes FOR INSERT
  WITH CHECK (can_manage_clientes() OR comercial_asignado_id = current_user_id());
CREATE POLICY clientes_write_upd ON clientes FOR UPDATE
  USING      (can_manage_clientes() OR comercial_asignado_id = current_user_id())
  WITH CHECK (can_manage_clientes() OR comercial_asignado_id = current_user_id());

-- oportunidades: (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
DROP POLICY IF EXISTS oportunidades_write ON oportunidades;
CREATE POLICY oportunidades_write_ins ON oportunidades FOR INSERT
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()));
CREATE POLICY oportunidades_write_upd ON oportunidades FOR UPDATE
  USING      (can_manage_clientes() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT clientes.id FROM clientes WHERE clientes.comercial_asignado_id = current_user_id()));

-- users: (is_superadmin() OR (app_role() = 'backoffice' AND role = 'comercial'))
DROP POLICY IF EXISTS users_write ON users;
CREATE POLICY users_write_ins ON users FOR INSERT
  WITH CHECK (is_superadmin() OR (app_role() = 'backoffice' AND (role)::text = 'comercial'));
CREATE POLICY users_write_upd ON users FOR UPDATE
  USING      (is_superadmin() OR (app_role() = 'backoffice' AND (role)::text = 'comercial'))
  WITH CHECK (is_superadmin() OR (app_role() = 'backoffice' AND (role)::text = 'comercial'));

-- inventario / referencias / almacenes: quitar la policy DELETE explícita.
DROP POLICY IF EXISTS inventario_delete ON inventario;
DROP POLICY IF EXISTS referencias_delete ON referencias;
DROP POLICY IF EXISTS almacenes_delete ON almacenes;

-- 3) Archivar/restaurar: barrera dura (solo Backoffice/Superadmin) --------------
--    Vigila la transición de `deleted_at` en clientes/referencias/oportunidades.
CREATE OR REPLACE FUNCTION public.guard_archivado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE ok boolean;
BEGIN
  IF NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW; -- no cambia el archivado
  END IF;
  IF TG_TABLE_NAME = 'referencias' THEN
    ok := public.can_manage_referencias();
  ELSE
    ok := public.can_manage_clientes(); -- clientes y oportunidades
  END IF;
  IF NOT ok THEN
    RAISE EXCEPTION 'Solo Backoffice/Superadmin pueden archivar o restaurar "%".', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $fn$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','referencias','oportunidades']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_archivado ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guard_archivado BEFORE UPDATE OF deleted_at ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_archivado()', t);
  END LOOP;
END $$;

-- 4) FKs peligrosas: CASCADE -> RESTRICT ---------------------------------------
--    Que la estructura de la BD refleje la regla: borrar un maestro no puede
--    destruir histórico económico/operativo.
ALTER TABLE public.pedidos    DROP CONSTRAINT pedidos_cliente_id_fkey;
ALTER TABLE public.pedidos    ADD  CONSTRAINT pedidos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT;
ALTER TABLE public.inventario DROP CONSTRAINT inventario_referencia_id_fkey;
ALTER TABLE public.inventario ADD  CONSTRAINT inventario_referencia_id_fkey
  FOREIGN KEY (referencia_id) REFERENCES public.referencias(id) ON DELETE RESTRICT;
