-- =====================================================================
-- 0012 — Número de pedido (OC…) autoincremental + descuento de stock
-- =====================================================================

-- 1) Número de pedido -------------------------------------------------
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_pedido varchar;

-- Rellena los pedidos ya importados con su código OC real (mapa OC<-factura)
UPDATE pedidos p SET numero_pedido = m.oc
FROM (VALUES
  ('CECI-2','OC26001'),('CECI-3','OC26002'),('CECI-4','OC26003'),('CECI-5','OC26004'),
  ('CECI-6','OC26005'),('CECI-7','OC26006'),('CECI-8','OC26007'),('CECI-9','OC26008'),
  ('CECI-10','OC26009'),('CECI-11','OC26010'),('CECI-12','OC26011'),('CECI-13','OC26012'),
  ('CECI-14','OC26013'),('CECI-15','OC26015'),('CECI-16','OC26016'),('CECI-17','OC26017'),
  ('CECI-18','OC26018'),('CECI-19','OC26019'),('CECI-20','OC26020'),('CECI-21','OC26021'),
  ('CECI-22','OC26022'),('CECI-23','OC26023'),('CECI-24','OC26024'),('CECI-25','OC26025'),
  ('CECI-26','OC26026'),('CECI-27','OC26027'),('CECI-28','OC26028'),('CECI-29','OC26029'),
  ('CECI-30','OC26030'),('CECI-31','OC26031')
) AS m(ceci, oc)
WHERE p.numero_factura = m.ceci AND p.numero_pedido IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_pedido_key
  ON pedidos (numero_pedido) WHERE numero_pedido IS NOT NULL;

-- Siguiente número: 'OC' + (mayor entero tras 'OC', base 26000) + 1
CREATE OR REPLACE FUNCTION public.siguiente_numero_pedido() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'OC' || (
    COALESCE(MAX((substring(numero_pedido from '^OC(\d+)$'))::int), 26000) + 1
  )::text
  FROM pedidos
  WHERE numero_pedido ~ '^OC\d+$';
$$;

-- Asigna el número automáticamente al crear si no viene dado
CREATE OR REPLACE FUNCTION public.set_numero_pedido() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
      NEW.numero_pedido := public.siguiente_numero_pedido();
    END IF;
    RETURN NEW;
  END;
$$;
DROP TRIGGER IF EXISTS trg_set_numero_pedido ON pedidos;
CREATE TRIGGER trg_set_numero_pedido BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_pedido();

-- 2) Descuento/reposición de stock según las líneas del pedido --------
-- Al crear una línea, descuenta del inventario; al borrarla, lo repone.
-- Nota: no distingue estado del pedido (un cancelado no repone solo).
CREATE OR REPLACE FUNCTION public.ajustar_inventario_linea() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO inventario (referencia_id, cantidad_disponible, actualizado_at)
      VALUES (NEW.referencia_id, -NEW.cantidad, now())
      ON CONFLICT (referencia_id) DO UPDATE
        SET cantidad_disponible = inventario.cantidad_disponible - NEW.cantidad,
            actualizado_at = now();
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE inventario SET cantidad_disponible = cantidad_disponible + OLD.cantidad, actualizado_at = now()
      WHERE referencia_id = OLD.referencia_id;
      RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.referencia_id = NEW.referencia_id THEN
        UPDATE inventario SET cantidad_disponible = cantidad_disponible - (NEW.cantidad - OLD.cantidad), actualizado_at = now()
        WHERE referencia_id = NEW.referencia_id;
      ELSE
        UPDATE inventario SET cantidad_disponible = cantidad_disponible + OLD.cantidad, actualizado_at = now()
        WHERE referencia_id = OLD.referencia_id;
        INSERT INTO inventario (referencia_id, cantidad_disponible, actualizado_at)
        VALUES (NEW.referencia_id, -NEW.cantidad, now())
        ON CONFLICT (referencia_id) DO UPDATE
          SET cantidad_disponible = inventario.cantidad_disponible - NEW.cantidad, actualizado_at = now();
      END IF;
      RETURN NEW;
    END IF;
    RETURN NULL;
  END;
$$;
DROP TRIGGER IF EXISTS trg_ajustar_inventario ON pedido_lineas;
CREATE TRIGGER trg_ajustar_inventario
  AFTER INSERT OR UPDATE OR DELETE ON pedido_lineas
  FOR EACH ROW EXECUTE FUNCTION public.ajustar_inventario_linea();
