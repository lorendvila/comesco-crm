-- =====================================================================
-- COMESCO CRM — Seguridad por filas (RLS)
-- Patrón: admin ve/edita todo; comercial solo lo de SUS clientes.
-- La seguridad vive en la base de datos, no en el frontend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones de ayuda
-- SECURITY DEFINER: leen la tabla users sin aplicar su RLS, evitando el
-- bucle infinito (recursión) al comprobar el rol. search_path fijado por
-- seguridad (buena práctica en funciones SECURITY DEFINER).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- users: cada uno se ve a sí mismo; el admin ve y gestiona a todos.
-- ---------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_self_select" ON users
  FOR SELECT USING (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "users_admin_all" ON users
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- clientes: admin todo; comercial solo los suyos.
-- Un lead sin asignar (comercial_asignado_id IS NULL) solo lo ve el admin.
-- ---------------------------------------------------------------------
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_clientes" ON clientes FOR ALL USING (
  public.is_admin() OR comercial_asignado_id = public.current_user_id()
);

-- ---------------------------------------------------------------------
-- Tablas hijas de clientes: visibilidad heredada del cliente.
-- ---------------------------------------------------------------------
ALTER TABLE contactos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_contactos" ON contactos_cliente FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE condiciones_comerciales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_condiciones" ON condiciones_comerciales FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_oportunidades" ON oportunidades FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE actividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_actividades" ON actividades FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_tareas" ON tareas FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE comunicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_comunicaciones" ON comunicaciones FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE demanda_estimada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_demanda" ON demanda_estimada FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_pedidos" ON pedidos FOR ALL USING (
  public.is_admin() OR cliente_id IN (
    SELECT id FROM clientes WHERE comercial_asignado_id = public.current_user_id()
  )
);

-- ---------------------------------------------------------------------
-- Tablas "nietas" (líneas): visibilidad heredada vía su cabecera.
-- ---------------------------------------------------------------------
ALTER TABLE oportunidad_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_oportunidad_lineas" ON oportunidad_lineas FOR ALL USING (
  public.is_admin() OR oportunidad_id IN (
    SELECT o.id FROM oportunidades o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE c.comercial_asignado_id = public.current_user_id()
  )
);

ALTER TABLE pedido_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acceso_pedido_lineas" ON pedido_lineas FOR ALL USING (
  public.is_admin() OR pedido_id IN (
    SELECT p.id FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE c.comercial_asignado_id = public.current_user_id()
  )
);

-- ---------------------------------------------------------------------
-- referencias: catálogo común. Lectura para ambos roles; escritura solo admin.
-- ---------------------------------------------------------------------
ALTER TABLE referencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura_referencias" ON referencias FOR SELECT USING (true);
CREATE POLICY "insert_referencias" ON referencias FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "update_referencias" ON referencias FOR UPDATE USING (public.is_admin());
CREATE POLICY "delete_referencias" ON referencias FOR DELETE USING (public.is_admin());
