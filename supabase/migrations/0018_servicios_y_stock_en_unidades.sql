-- =====================================================================
-- COMESCO CRM — Referencias de servicio + stock/pedidos SIEMPRE en unidades
-- Peticiones:
--  1) "Transporte" y "Otros": conceptos de coste que el comercial añade al
--     pedido como una línea más. NO tienen inventario y NO descuentan stock.
--  2) Todo (inventario y pedidos) en UNIDADES de producto: la cantidad del
--     pedido son unidades, el precio es unitario y el stock se descuenta en
--     unidades (no en cajas). Se elimina la conversión cajas→unidades.
-- =====================================================================

-- 1) Marca de "servicio" (sin inventario) en el catálogo de referencias.
ALTER TABLE referencias ADD COLUMN IF NOT EXISTS es_servicio boolean NOT NULL DEFAULT false;

-- Alta de Transporte y Otros (IVA 0: el importe que teclee el comercial es el
-- que se suma; es ajustable). Solo se crean si no existen ya.
INSERT INTO referencias (nombre_producto, formato, categoria, unidad, iva_pct, es_servicio, sku)
SELECT v.nombre_producto, v.formato, v.categoria, v.unidad, v.iva_pct, v.es_servicio, v.sku
FROM (VALUES
  ('Transporte', 'Servicio', 'Servicios', 'unidades', 0, true, 'TRANSPORTE'),
  ('Otros',      'Servicio', 'Servicios', 'unidades', 0, true, 'OTROS')
) AS v(nombre_producto, formato, categoria, unidad, iva_pct, es_servicio, sku)
WHERE NOT EXISTS (
  SELECT 1 FROM referencias r WHERE r.nombre_producto = v.nombre_producto AND r.es_servicio = true
);

-- 2a) Al fijar el almacén de la línea, saltar los servicios (no van a ningún
--     almacén, así que su línea queda sin almacén y no mueve inventario).
CREATE OR REPLACE FUNCTION public.set_linea_almacen() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.almacen_id IS NULL
     AND NOT COALESCE((SELECT es_servicio FROM referencias WHERE id = NEW.referencia_id), false) THEN
    SELECT almacen_id INTO NEW.almacen_id FROM pedidos WHERE id = NEW.pedido_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2b) Descuento de stock EN UNIDADES (cantidad tal cual, sin ×unidades_por_caja).
--     Salta servicios y líneas sin almacén (pedidos históricos).
CREATE OR REPLACE FUNCTION public.ajustar_inventario_linea() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_serv boolean;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.almacen_id IS NULL THEN RETURN OLD; END IF;
      SELECT es_servicio INTO v_serv FROM referencias WHERE id = OLD.referencia_id;
      IF v_serv THEN RETURN OLD; END IF;
      UPDATE inventario SET cantidad_disponible = cantidad_disponible + OLD.cantidad, actualizado_at = now()
        WHERE referencia_id = OLD.referencia_id AND almacen_id = OLD.almacen_id;
      RETURN OLD;

    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.almacen_id IS NULL THEN RETURN NEW; END IF;
      SELECT es_servicio INTO v_serv FROM referencias WHERE id = NEW.referencia_id;
      IF v_serv THEN RETURN NEW; END IF;
      INSERT INTO inventario (referencia_id, almacen_id, cantidad_disponible, actualizado_at)
      VALUES (NEW.referencia_id, NEW.almacen_id, -NEW.cantidad, now())
      ON CONFLICT (referencia_id, almacen_id) DO UPDATE
        SET cantidad_disponible = inventario.cantidad_disponible - NEW.cantidad, actualizado_at = now();
      RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.almacen_id IS NOT NULL THEN
        SELECT es_servicio INTO v_serv FROM referencias WHERE id = OLD.referencia_id;
        IF NOT v_serv THEN
          UPDATE inventario SET cantidad_disponible = cantidad_disponible + OLD.cantidad, actualizado_at = now()
            WHERE referencia_id = OLD.referencia_id AND almacen_id = OLD.almacen_id;
        END IF;
      END IF;
      IF NEW.almacen_id IS NOT NULL THEN
        SELECT es_servicio INTO v_serv FROM referencias WHERE id = NEW.referencia_id;
        IF NOT v_serv THEN
          INSERT INTO inventario (referencia_id, almacen_id, cantidad_disponible, actualizado_at)
          VALUES (NEW.referencia_id, NEW.almacen_id, -NEW.cantidad, now())
          ON CONFLICT (referencia_id, almacen_id) DO UPDATE
            SET cantidad_disponible = inventario.cantidad_disponible - NEW.cantidad, actualizado_at = now();
        END IF;
      END IF;
      RETURN NEW;
    END IF;
    RETURN NULL;
  END;
$$;
