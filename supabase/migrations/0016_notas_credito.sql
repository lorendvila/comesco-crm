-- =====================================================================
-- COMESCO CRM — Notas de Crédito (anulación de facturas)
-- Petición de Diana: una factura anulada con NC debe VERSE pero NO CONTAR
-- en facturado/cobrado ni en rotación/demanda.
-- Caso real: CECI-14 (pedido OC26013) anulada por la NC "NCRE3" (30/04/2026).
-- =====================================================================

-- 1) Campos de la nota de crédito en el pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nota_credito_numero VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nota_credito_fecha DATE;

-- 2) Nuevo estado 'anulado' (factura anulada por NC)
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('recibido','entregado','facturado','cobrado','cancelado','anulado'));

-- 3) La protección de facturación (solo admin) también cubre los campos de NC.
CREATE OR REPLACE FUNCTION public.pedidos_proteger_facturacion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.numero_factura     := NULL;
    NEW.valor_factura      := NULL;
    NEW.pagado             := NULL;
    NEW.fecha_vencimiento  := NULL;
    NEW.fecha_pago         := NULL;
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
$$;

-- 4) Marcar la factura real anulada (CECI-14 = OC26013). El trigger anterior
--    bloquearía este UPDATE (se ejecuta sin sesión de admin), así que se
--    desactiva puntualmente para el arreglo de datos.
ALTER TABLE pedidos DISABLE TRIGGER trg_pedidos_proteger_facturacion;
UPDATE pedidos
   SET estado = 'anulado',
       nota_credito_numero = 'NCRE3',
       nota_credito_fecha  = '2026-04-30'
 WHERE numero_pedido = 'OC26013';
ALTER TABLE pedidos ENABLE TRIGGER trg_pedidos_proteger_facturacion;
