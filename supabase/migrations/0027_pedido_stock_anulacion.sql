-- =====================================================================
-- 0027 — Fase 6B (Bloque 1): ciclo de vida stock/anulación de pedidos
-- =====================================================================
-- Sustituye el borrado físico de pedidos por un ciclo de estado con reposición
-- de stock, y cierra la incoherencia de stock negativo.
--
-- Reglas:
--  - Un pedido "consumidor" (estado NOT IN anulado/cancelado) consume stock por
--    sus líneas (con almacén y no servicio).
--  - Transición consumidor -> no-consumidor: REPONE una vez. La inversa:
--    DESCUENTA una vez, validando disponibilidad de TODAS las líneas primero
--    (atómico: o entra completo o no entra).
--  - Nunca stock negativo: crear/editar/reactivar validan disponibilidad con
--    bloqueo de fila (FOR UPDATE) antes de descontar; si falta, error atómico.
--  - Pedidos anulados/cancelados: líneas INMUTABLES.
--  - Servicios y líneas/pedidos sin almacén: no afectan stock (igual que hoy).

-- 1) ¿El estado consume stock? ----------------------------------------
CREATE OR REPLACE FUNCTION public.pedido_consume_stock(est text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT est IS NOT NULL AND est NOT IN ('anulado','cancelado');
$$;

-- 2) Trigger de línea: consume solo si el pedido consume + no permite negativo -
CREATE OR REPLACE FUNCTION public.ajustar_inventario_linea()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_serv boolean; v_estado text; v_disp numeric;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.almacen_id IS NULL THEN RETURN OLD; END IF;
    SELECT es_servicio INTO v_serv FROM referencias WHERE id=OLD.referencia_id; IF v_serv THEN RETURN OLD; END IF;
    SELECT estado INTO v_estado FROM pedidos WHERE id=OLD.pedido_id; IF NOT pedido_consume_stock(v_estado) THEN RETURN OLD; END IF;
    UPDATE inventario SET cantidad_disponible=cantidad_disponible+OLD.cantidad, actualizado_at=now()
      WHERE referencia_id=OLD.referencia_id AND almacen_id=OLD.almacen_id;
    RETURN OLD;

  ELSIF TG_OP='INSERT' THEN
    IF NEW.almacen_id IS NULL THEN RETURN NEW; END IF;
    SELECT es_servicio INTO v_serv FROM referencias WHERE id=NEW.referencia_id; IF v_serv THEN RETURN NEW; END IF;
    SELECT estado INTO v_estado FROM pedidos WHERE id=NEW.pedido_id; IF NOT pedido_consume_stock(v_estado) THEN RETURN NEW; END IF;
    SELECT cantidad_disponible INTO v_disp FROM inventario
      WHERE referencia_id=NEW.referencia_id AND almacen_id=NEW.almacen_id FOR UPDATE;
    v_disp := COALESCE(v_disp,0);
    IF v_disp < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente: referencia % en almacén % (disponible %, necesario %).',
        NEW.referencia_id, NEW.almacen_id, v_disp, NEW.cantidad;
    END IF;
    UPDATE inventario SET cantidad_disponible=cantidad_disponible-NEW.cantidad, actualizado_at=now()
      WHERE referencia_id=NEW.referencia_id AND almacen_id=NEW.almacen_id;
    RETURN NEW;

  ELSIF TG_OP='UPDATE' THEN
    SELECT estado INTO v_estado FROM pedidos WHERE id=NEW.pedido_id;
    IF pedido_consume_stock(v_estado) THEN
      -- repone la anterior
      IF OLD.almacen_id IS NOT NULL THEN
        SELECT es_servicio INTO v_serv FROM referencias WHERE id=OLD.referencia_id;
        IF NOT v_serv THEN UPDATE inventario SET cantidad_disponible=cantidad_disponible+OLD.cantidad, actualizado_at=now()
          WHERE referencia_id=OLD.referencia_id AND almacen_id=OLD.almacen_id; END IF;
      END IF;
      -- valida + descuenta la nueva
      IF NEW.almacen_id IS NOT NULL THEN
        SELECT es_servicio INTO v_serv FROM referencias WHERE id=NEW.referencia_id;
        IF NOT v_serv THEN
          SELECT cantidad_disponible INTO v_disp FROM inventario
            WHERE referencia_id=NEW.referencia_id AND almacen_id=NEW.almacen_id FOR UPDATE;
          v_disp := COALESCE(v_disp,0);
          IF v_disp < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente: referencia % en almacén % (disponible %, necesario %).',
              NEW.referencia_id, NEW.almacen_id, v_disp, NEW.cantidad;
          END IF;
          UPDATE inventario SET cantidad_disponible=cantidad_disponible-NEW.cantidad, actualizado_at=now()
            WHERE referencia_id=NEW.referencia_id AND almacen_id=NEW.almacen_id;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $fn$;

-- 3) Trigger de frontera de estado en pedidos --------------------------
CREATE OR REPLACE FUNCTION public.pedidos_ajustar_stock_estado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE old_c boolean; new_c boolean; r record; v_disp numeric;
BEGIN
  old_c := pedido_consume_stock(OLD.estado);
  new_c := pedido_consume_stock(NEW.estado);
  IF old_c = new_c THEN RETURN NEW; END IF;

  IF old_c AND NOT new_c THEN
    -- consumidor -> no consumidor: REPONE cada línea (una vez)
    FOR r IN SELECT pl.referencia_id, pl.almacen_id, pl.cantidad
             FROM pedido_lineas pl JOIN referencias rf ON rf.id=pl.referencia_id
             WHERE pl.pedido_id=NEW.id AND pl.almacen_id IS NOT NULL AND NOT rf.es_servicio LOOP
      UPDATE inventario SET cantidad_disponible=cantidad_disponible+r.cantidad, actualizado_at=now()
        WHERE referencia_id=r.referencia_id AND almacen_id=r.almacen_id;
    END LOOP;
  ELSE
    -- no consumidor -> consumidor: valida TODAS (FOR UPDATE) y luego descuenta
    FOR r IN SELECT pl.referencia_id, pl.almacen_id, SUM(pl.cantidad) AS need
             FROM pedido_lineas pl JOIN referencias rf ON rf.id=pl.referencia_id
             WHERE pl.pedido_id=NEW.id AND pl.almacen_id IS NOT NULL AND NOT rf.es_servicio
             GROUP BY pl.referencia_id, pl.almacen_id LOOP
      SELECT cantidad_disponible INTO v_disp FROM inventario
        WHERE referencia_id=r.referencia_id AND almacen_id=r.almacen_id FOR UPDATE;
      v_disp := COALESCE(v_disp,0);
      IF v_disp < r.need THEN
        RAISE EXCEPTION 'No se puede reactivar: stock insuficiente en referencia % almacén % (disponible %, necesario %).',
          r.referencia_id, r.almacen_id, v_disp, r.need;
      END IF;
    END LOOP;
    FOR r IN SELECT pl.referencia_id, pl.almacen_id, pl.cantidad
             FROM pedido_lineas pl JOIN referencias rf ON rf.id=pl.referencia_id
             WHERE pl.pedido_id=NEW.id AND pl.almacen_id IS NOT NULL AND NOT rf.es_servicio LOOP
      UPDATE inventario SET cantidad_disponible=cantidad_disponible-r.cantidad, actualizado_at=now()
        WHERE referencia_id=r.referencia_id AND almacen_id=r.almacen_id;
    END LOOP;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_pedidos_stock_estado ON pedidos;
CREATE TRIGGER trg_pedidos_stock_estado
  AFTER UPDATE OF estado ON pedidos FOR EACH ROW EXECUTE FUNCTION pedidos_ajustar_stock_estado();

-- 4) Inmutabilidad de líneas de pedidos no consumidores ----------------
CREATE OR REPLACE FUNCTION public.pedido_lineas_inmutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_estado text; v_pid uuid;
BEGIN
  v_pid := COALESCE(NEW.pedido_id, OLD.pedido_id);
  SELECT estado INTO v_estado FROM pedidos WHERE id=v_pid;
  IF v_estado IS NOT NULL AND NOT pedido_consume_stock(v_estado) THEN
    RAISE EXCEPTION 'Las líneas de un pedido % (%) son inmutables. Reactívalo primero.', v_pid, v_estado;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $fn$;

DROP TRIGGER IF EXISTS trg_pedido_lineas_inmutable ON pedido_lineas;
CREATE TRIGGER trg_pedido_lineas_inmutable
  BEFORE INSERT OR UPDATE OR DELETE ON pedido_lineas FOR EACH ROW EXECUTE FUNCTION pedido_lineas_inmutable();

-- 5) Freeze de cabecera de pedidos anulados/cancelados -----------------
-- Mientras el pedido está en estado no consumidor, sus campos económicos e
-- históricos son inmutables: se RECHAZA la operación con error explícito (no
-- se sustituye silenciosamente por OLD). Sí se permiten notas/documentación/NC
-- y el cambio de `estado` (necesario para la reactivación controlada, que
-- pasa por la validación de stock del trigger de frontera).
CREATE OR REPLACE FUNCTION public.pedidos_freeze_cabecera()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  IF NOT pedido_consume_stock(OLD.estado) THEN
    IF NEW.cliente_id       IS DISTINCT FROM OLD.cliente_id
    OR NEW.almacen_id       IS DISTINCT FROM OLD.almacen_id
    OR NEW.total_cop        IS DISTINCT FROM OLD.total_cop
    OR NEW.valor_factura    IS DISTINCT FROM OLD.valor_factura
    OR NEW.pagado           IS DISTINCT FROM OLD.pagado
    OR NEW.numero_factura   IS DISTINCT FROM OLD.numero_factura
    OR NEW.fecha_factura    IS DISTINCT FROM OLD.fecha_factura
    OR NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento
    OR NEW.fecha_pago       IS DISTINCT FROM OLD.fecha_pago
    OR NEW.fecha_pedido     IS DISTINCT FROM OLD.fecha_pedido
    OR NEW.fecha_entrega    IS DISTINCT FROM OLD.fecha_entrega
    OR NEW.canal_origen     IS DISTINCT FROM OLD.canal_origen
    THEN
      RAISE EXCEPTION 'Pedido % (%): los campos económicos/históricos son inmutables en un pedido anulado/cancelado (permitido: notas, documentación, NC y reactivación).',
        OLD.numero_pedido, OLD.estado;
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_pedidos_freeze_cabecera ON pedidos;
CREATE TRIGGER trg_pedidos_freeze_cabecera
  BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION pedidos_freeze_cabecera();
