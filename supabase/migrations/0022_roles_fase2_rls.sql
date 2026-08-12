-- =====================================================================
-- 0022 — Rediseño de permisos · FASE 2 (reescritura de RLS por comando)
-- =====================================================================
-- Sustituye el modelo binario (is_admin() OR propietario) por policies por
-- comando usando las funciones de capacidad de la Fase 0.
--
-- Reglas:
--   dirección   -> lectura global, SIN escritura operativa.
--   backoffice  -> lectura global + escritura operativa.
--   comercial   -> escritura solo en su ámbito (propiedad), lectura solo lo suyo.
--   superadmin  -> todo. 'admin' legacy == superadmin durante la transición.
--   referencias/inventario -> el comercial CONSULTA, no modifica.
--
-- Patrón por tabla de cartera (2 policies permisivas, se combinan con OR):
--   *_select : SELECT  USING (can_read_all() OR <propietario>)
--   *_write  : ALL     USING/CHECK (can_manage_X() OR <propietario>)
--   (la *_write cubre INSERT/UPDATE/DELETE; para SELECT solo AÑADE el conjunto
--    operativo, que es subconjunto de can_read_all(), así que no amplía la
--    visibilidad más allá de lo previsto.)
--
-- La protección/separación de costes es de la Fase 3: aquí referencias.SELECT
-- sigue abierto (el comercial consulta precios/stock).

-- ---------------------------------------------------------------------
-- CARTERA · dominio comercial/cliente  (escritura: can_manage_clientes)
-- ---------------------------------------------------------------------

-- clientes
DROP POLICY IF EXISTS acceso_clientes ON clientes;
CREATE POLICY clientes_select ON clientes FOR SELECT
  USING (can_read_all() OR comercial_asignado_id = current_user_id());
CREATE POLICY clientes_write ON clientes FOR ALL
  USING (can_manage_clientes() OR comercial_asignado_id = current_user_id())
  WITH CHECK (can_manage_clientes() OR comercial_asignado_id = current_user_id());

-- contactos_cliente
DROP POLICY IF EXISTS acceso_contactos ON contactos_cliente;
CREATE POLICY contactos_select ON contactos_cliente FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY contactos_write ON contactos_cliente FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- condiciones_comerciales
DROP POLICY IF EXISTS acceso_condiciones ON condiciones_comerciales;
CREATE POLICY condiciones_select ON condiciones_comerciales FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY condiciones_write ON condiciones_comerciales FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- actividades
DROP POLICY IF EXISTS acceso_actividades ON actividades;
CREATE POLICY actividades_select ON actividades FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY actividades_write ON actividades FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- tareas
DROP POLICY IF EXISTS acceso_tareas ON tareas;
CREATE POLICY tareas_select ON tareas FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY tareas_write ON tareas FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- comunicaciones
DROP POLICY IF EXISTS acceso_comunicaciones ON comunicaciones;
CREATE POLICY comunicaciones_select ON comunicaciones FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY comunicaciones_write ON comunicaciones FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- demanda_estimada
DROP POLICY IF EXISTS acceso_demanda ON demanda_estimada;
CREATE POLICY demanda_select ON demanda_estimada FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY demanda_write ON demanda_estimada FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- oportunidades
DROP POLICY IF EXISTS acceso_oportunidades ON oportunidades;
CREATE POLICY oportunidades_select ON oportunidades FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY oportunidades_write ON oportunidades FOR ALL
  USING (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- oportunidad_lineas (propiedad heredada de la oportunidad -> cliente)
DROP POLICY IF EXISTS acceso_oportunidad_lineas ON oportunidad_lineas;
CREATE POLICY oportunidad_lineas_select ON oportunidad_lineas FOR SELECT
  USING (can_read_all() OR oportunidad_id IN (
    SELECT o.id FROM oportunidades o JOIN clientes c ON c.id = o.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()));
CREATE POLICY oportunidad_lineas_write ON oportunidad_lineas FOR ALL
  USING (can_manage_clientes() OR oportunidad_id IN (
    SELECT o.id FROM oportunidades o JOIN clientes c ON c.id = o.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_clientes() OR oportunidad_id IN (
    SELECT o.id FROM oportunidades o JOIN clientes c ON c.id = o.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()));

-- ---------------------------------------------------------------------
-- CARTERA · pedidos  (escritura: can_manage_pedidos)
-- ---------------------------------------------------------------------

-- pedidos
DROP POLICY IF EXISTS acceso_pedidos ON pedidos;
CREATE POLICY pedidos_select ON pedidos FOR SELECT
  USING (can_read_all() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));
CREATE POLICY pedidos_write ON pedidos FOR ALL
  USING (can_manage_pedidos() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_pedidos() OR cliente_id IN (SELECT id FROM clientes WHERE comercial_asignado_id = current_user_id()));

-- pedido_lineas (propiedad heredada del pedido -> cliente)
DROP POLICY IF EXISTS acceso_pedido_lineas ON pedido_lineas;
CREATE POLICY pedido_lineas_select ON pedido_lineas FOR SELECT
  USING (can_read_all() OR pedido_id IN (
    SELECT p.id FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()));
CREATE POLICY pedido_lineas_write ON pedido_lineas FOR ALL
  USING (can_manage_pedidos() OR pedido_id IN (
    SELECT p.id FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()))
  WITH CHECK (can_manage_pedidos() OR pedido_id IN (
    SELECT p.id FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
    WHERE c.comercial_asignado_id = current_user_id()));

-- ---------------------------------------------------------------------
-- CATÁLOGO · lectura abierta, escritura por capacidad
-- (referencias.SELECT sigue abierto; su protección de coste es Fase 3)
-- ---------------------------------------------------------------------

-- referencias
DROP POLICY IF EXISTS insert_referencias ON referencias;
DROP POLICY IF EXISTS update_referencias ON referencias;
DROP POLICY IF EXISTS delete_referencias ON referencias;
CREATE POLICY referencias_insert ON referencias FOR INSERT WITH CHECK (can_manage_referencias());
CREATE POLICY referencias_update ON referencias FOR UPDATE USING (can_manage_referencias()) WITH CHECK (can_manage_referencias());
CREATE POLICY referencias_delete ON referencias FOR DELETE USING (can_manage_referencias());

-- inventario
DROP POLICY IF EXISTS insert_inventario ON inventario;
DROP POLICY IF EXISTS update_inventario ON inventario;
DROP POLICY IF EXISTS delete_inventario ON inventario;
CREATE POLICY inventario_insert ON inventario FOR INSERT WITH CHECK (can_manage_inventario());
CREATE POLICY inventario_update ON inventario FOR UPDATE USING (can_manage_inventario()) WITH CHECK (can_manage_inventario());
CREATE POLICY inventario_delete ON inventario FOR DELETE USING (can_manage_inventario());

-- almacenes
DROP POLICY IF EXISTS insert_almacenes ON almacenes;
DROP POLICY IF EXISTS update_almacenes ON almacenes;
DROP POLICY IF EXISTS delete_almacenes ON almacenes;
CREATE POLICY almacenes_insert ON almacenes FOR INSERT WITH CHECK (can_manage_inventario());
CREATE POLICY almacenes_update ON almacenes FOR UPDATE USING (can_manage_inventario()) WITH CHECK (can_manage_inventario());
CREATE POLICY almacenes_delete ON almacenes FOR DELETE USING (can_manage_inventario());

-- ---------------------------------------------------------------------
-- USERS · lectura (propio o visibilidad global); escritura solo superadmin
-- (la gestión por backoffice de comerciales se abre con guardas en Fase 4)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS users_self_select ON users;
DROP POLICY IF EXISTS users_admin_all ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (auth_user_id = auth.uid() OR can_read_all());
CREATE POLICY users_write ON users FOR ALL
  USING (is_superadmin()) WITH CHECK (is_superadmin());

-- ---------------------------------------------------------------------
-- TRIGGER de facturación: gate is_admin() -> can_manage_facturacion()
-- (sin esto, un backoffice futuro no podría tocar factura/cobros)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedidos_proteger_facturacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF public.can_manage_facturacion() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.numero_factura      := NULL;
    NEW.valor_factura       := NULL;
    NEW.pagado              := NULL;
    NEW.fecha_vencimiento   := NULL;
    NEW.fecha_pago          := NULL;
    NEW.nota_credito_numero := NULL;
    NEW.nota_credito_fecha  := NULL;
    IF NEW.estado NOT IN ('recibido', 'entregado') THEN
      NEW.estado := 'recibido';
    END IF;
  ELSE
    NEW.numero_factura      := OLD.numero_factura;
    NEW.valor_factura       := OLD.valor_factura;
    NEW.pagado              := OLD.pagado;
    NEW.fecha_vencimiento   := OLD.fecha_vencimiento;
    NEW.fecha_pago          := OLD.fecha_pago;
    NEW.nota_credito_numero := OLD.nota_credito_numero;
    NEW.nota_credito_fecha  := OLD.nota_credito_fecha;
    IF NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado NOT IN ('recibido', 'entregado') THEN
      NEW.estado := OLD.estado;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
