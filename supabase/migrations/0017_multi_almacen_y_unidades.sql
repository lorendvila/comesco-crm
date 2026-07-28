-- =====================================================================
-- COMESCO CRM — Multi-almacén + inventario en unidades
-- Peticiones de Diana:
--  - Stock por CIUDAD/ALMACÉN (empezamos por Medellín y Bogotá, ampliable).
--  - El inventario se maneja en UNIDADES; la venta es por CAJA.
--  - Un pedido sale de UN almacén; al guardar, convierte cajas→unidades y
--    descuenta del almacén elegido (no reparte entre ciudades).
-- =====================================================================

-- 1) Catálogo de almacenes -------------------------------------------
CREATE TABLE IF NOT EXISTS almacenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial (solo si está vacía)
INSERT INTO almacenes (nombre, ciudad)
SELECT v.n, v.c FROM (VALUES ('Medellín','Medellín'), ('Bogotá','Bogotá')) AS v(n, c)
WHERE NOT EXISTS (SELECT 1 FROM almacenes);

ALTER TABLE almacenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lectura_almacenes" ON almacenes;
DROP POLICY IF EXISTS "insert_almacenes" ON almacenes;
DROP POLICY IF EXISTS "update_almacenes" ON almacenes;
DROP POLICY IF EXISTS "delete_almacenes" ON almacenes;
CREATE POLICY "lectura_almacenes" ON almacenes FOR SELECT USING (true);
CREATE POLICY "insert_almacenes" ON almacenes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "update_almacenes" ON almacenes FOR UPDATE USING (public.is_admin());
CREATE POLICY "delete_almacenes" ON almacenes FOR DELETE USING (public.is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON almacenes TO authenticated;

-- 2) Inventario por (referencia, almacén) ----------------------------
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS almacen_id UUID REFERENCES almacenes(id);

-- Asignar el stock actual a su ciudad: vinagres → Medellín; resto (AOVE, vino) → Bogotá.
UPDATE inventario i
   SET almacen_id = (
     SELECT a.id FROM almacenes a
     WHERE a.ciudad = CASE
       WHEN (SELECT r.nombre_producto FROM referencias r WHERE r.id = i.referencia_id) ILIKE 'Vinagre%'
         THEN 'Medellín' ELSE 'Bogotá' END
     LIMIT 1)
 WHERE almacen_id IS NULL;

-- Reemplazar UNIQUE(referencia_id) por UNIQUE(referencia_id, almacen_id)
ALTER TABLE inventario DROP CONSTRAINT IF EXISTS inventario_referencia_id_key;
ALTER TABLE inventario ALTER COLUMN almacen_id SET NOT NULL;
ALTER TABLE inventario ADD CONSTRAINT inventario_ref_almacen_key UNIQUE (referencia_id, almacen_id);

-- 3) El pedido sale de un almacén ------------------------------------
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS almacen_id UUID REFERENCES almacenes(id);
-- Los 30 pedidos históricos quedan con almacen_id NULL: su stock ya estaba
-- descontado del inventario único, y el trigger nuevo ignora las líneas sin almacén.

-- 4) Cada línea guarda su almacén (para reponer donde se descontó) ----
ALTER TABLE pedido_lineas ADD COLUMN IF NOT EXISTS almacen_id UUID REFERENCES almacenes(id);

CREATE OR REPLACE FUNCTION public.set_linea_almacen() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.almacen_id IS NULL THEN
    SELECT almacen_id INTO NEW.almacen_id FROM pedidos WHERE id = NEW.pedido_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_linea_almacen ON pedido_lineas;
CREATE TRIGGER trg_set_linea_almacen BEFORE INSERT ON pedido_lineas
  FOR EACH ROW EXECUTE FUNCTION public.set_linea_almacen();

-- 5) Descuento de stock: convierte cajas→unidades y usa el almacén de la línea.
--    Si la línea no tiene almacén (pedidos antiguos) no ajusta nada.
CREATE OR REPLACE FUNCTION public.ajustar_inventario_linea() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE v_upc numeric; v_delta numeric;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.almacen_id IS NULL THEN RETURN OLD; END IF;
      SELECT COALESCE(unidades_por_caja, 1) INTO v_upc FROM referencias WHERE id = OLD.referencia_id;
      v_delta := OLD.cantidad * (CASE WHEN OLD.unidad = 'cajas' THEN v_upc ELSE 1 END);
      UPDATE inventario SET cantidad_disponible = cantidad_disponible + v_delta, actualizado_at = now()
        WHERE referencia_id = OLD.referencia_id AND almacen_id = OLD.almacen_id;
      RETURN OLD;

    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.almacen_id IS NULL THEN RETURN NEW; END IF;
      SELECT COALESCE(unidades_por_caja, 1) INTO v_upc FROM referencias WHERE id = NEW.referencia_id;
      v_delta := NEW.cantidad * (CASE WHEN NEW.unidad = 'cajas' THEN v_upc ELSE 1 END);
      INSERT INTO inventario (referencia_id, almacen_id, cantidad_disponible, actualizado_at)
      VALUES (NEW.referencia_id, NEW.almacen_id, -v_delta, now())
      ON CONFLICT (referencia_id, almacen_id) DO UPDATE
        SET cantidad_disponible = inventario.cantidad_disponible - v_delta, actualizado_at = now();
      RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
      -- Repone la línea vieja donde estaba
      IF OLD.almacen_id IS NOT NULL THEN
        SELECT COALESCE(unidades_por_caja, 1) INTO v_upc FROM referencias WHERE id = OLD.referencia_id;
        UPDATE inventario SET cantidad_disponible = cantidad_disponible
               + OLD.cantidad * (CASE WHEN OLD.unidad = 'cajas' THEN v_upc ELSE 1 END), actualizado_at = now()
          WHERE referencia_id = OLD.referencia_id AND almacen_id = OLD.almacen_id;
      END IF;
      -- Descuenta la nueva
      IF NEW.almacen_id IS NOT NULL THEN
        SELECT COALESCE(unidades_por_caja, 1) INTO v_upc FROM referencias WHERE id = NEW.referencia_id;
        v_delta := NEW.cantidad * (CASE WHEN NEW.unidad = 'cajas' THEN v_upc ELSE 1 END);
        INSERT INTO inventario (referencia_id, almacen_id, cantidad_disponible, actualizado_at)
        VALUES (NEW.referencia_id, NEW.almacen_id, -v_delta, now())
        ON CONFLICT (referencia_id, almacen_id) DO UPDATE
          SET cantidad_disponible = inventario.cantidad_disponible - v_delta, actualizado_at = now();
      END IF;
      RETURN NEW;
    END IF;
    RETURN NULL;
  END;
$$;
