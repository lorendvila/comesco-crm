-- =====================================================================
-- COMESCO CRM — NIT del cliente + protección de la capa de facturación
-- Peticiones de Diana (admin):
--  (1) NIT en la ficha de cliente (control de facturación y cobranza).
--  (2) Que solo el admin pueda tocar la facturación/cobro de un pedido,
--      para que un comercial no cambie nada "sin querer".
-- Ambos cambios son aditivos y no modifican datos existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NIT del cliente (identificación fiscal). Distinto de
--    codigo_facturacion_externo (reservado para la futura integración DIAN).
-- ---------------------------------------------------------------------
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS nit VARCHAR(50);

-- ---------------------------------------------------------------------
-- 2. Blindaje de la facturación (Capa 2 — la de verdad, en la base).
--    La UI ya oculta el bloque de cobro a los no-admin (Capa 1), pero
--    ocultar en pantalla no protege la API. Este trigger garantiza que
--    un usuario NO admin no pueda alterar los campos de facturación ni
--    llevar el pedido a un estado de facturación.
--
--    Comportamiento silencioso (no lanza error): si un no-admin intenta
--    cambiar estos campos, se conservan los valores anteriores. Así el
--    comercial puede seguir guardando el pedido y sus líneas con
--    normalidad; simplemente la parte de facturación queda intacta.
--
--    Estados permitidos a un comercial: 'recibido' y 'entregado'.
--    'facturado' / 'cobrado' / 'cancelado' son solo del admin.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pedidos_proteger_facturacion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- El admin puede hacer cualquier cambio.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un comercial no crea pedidos con datos de facturación ni en estado
    -- de facturación: se fuerzan a vacío / 'recibido'.
    NEW.numero_factura   := NULL;
    NEW.valor_factura    := NULL;
    NEW.pagado           := NULL;
    NEW.fecha_vencimiento := NULL;
    NEW.fecha_pago       := NULL;
    IF NEW.estado NOT IN ('recibido', 'entregado') THEN
      NEW.estado := 'recibido';
    END IF;
  ELSE -- UPDATE: se preservan los valores previos de facturación.
    NEW.numero_factura    := OLD.numero_factura;
    NEW.valor_factura     := OLD.valor_factura;
    NEW.pagado            := OLD.pagado;
    NEW.fecha_vencimiento := OLD.fecha_vencimiento;
    NEW.fecha_pago        := OLD.fecha_pago;
    -- El estado solo puede moverlo el comercial entre 'recibido'/'entregado'.
    -- Cualquier otro cambio (a facturado/cobrado/cancelado) se ignora.
    IF NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado NOT IN ('recibido', 'entregado') THEN
      NEW.estado := OLD.estado;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_proteger_facturacion ON pedidos;
CREATE TRIGGER trg_pedidos_proteger_facturacion
  BEFORE INSERT OR UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedidos_proteger_facturacion();
