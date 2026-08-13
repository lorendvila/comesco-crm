-- =====================================================================
-- 0028 — Fase 6B (Bloque 1): barrera de BD para el ciclo de vida de pedidos
-- =====================================================================
-- Complementa 0027 con dos reglas que NO deben depender solo de la UI:
--
--  (A) Cancelar/anular un pedido, o reactivar un cancelado, son acciones
--      reservadas a Backoffice/Superadmin (can_manage_pedidos()). Un comercial
--      puede seguir editando SUS pedidos (RLS) y moverlos recibido<->entregado,
--      pero NO estas transiciones de ciclo de vida — ni llamando la API directa.
--      Dirección ya está bloqueada por RLS (no tiene can_manage_pedidos ni
--      propiedad de clientes).
--
--  (B) `anulado` (factura revertida mediante nota de crédito) es un estado
--      FINAL: no puede volver a un estado consumidor (ni siquiera superadmin).
--      Si la venta vuelve a existir, se crea un pedido nuevo, preservando el
--      ciclo histórico Pedido -> Factura -> Nota de crédito -> Anulado.
--      La NC (nota_credito_numero/fecha) se conserva siempre; nunca se limpia.
--
-- Nota sobre `cancelado`: cancelación pre-facturación, SÍ reactivable
-- (cancelado -> recibido), sometido a la validación atómica de stock de 0027.
--
-- Orden de triggers BEFORE UPDATE en pedidos (alfabético):
--   trg_pedidos_freeze_cabecera  -> trg_pedidos_guard_ciclo
--   -> trg_pedidos_proteger_facturacion
-- El guard corre antes de proteger_facturacion, así que un comercial recibe un
-- error EXPLÍCITO en vez de la reversión silenciosa de estado de aquel trigger.

CREATE OR REPLACE FUNCTION public.pedidos_guard_ciclo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  -- Solo vigilamos cambios reales de estado.
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- (B) Anulado por NC = estado final: no reactivable (ni superadmin).
  IF OLD.estado = 'anulado' AND public.pedido_consume_stock(NEW.estado) THEN
    RAISE EXCEPTION 'Pedido % anulado por nota de crédito: es un estado final y no puede reactivarse. Si vuelve la venta, crea un pedido nuevo.', OLD.numero_pedido
      USING ERRCODE = 'check_violation';
  END IF;

  -- (A) Cancelar/anular (entrar en no-consumidor) o reactivar un cancelado:
  --     reservado a Backoffice/Superadmin.
  IF (NOT public.pedido_consume_stock(NEW.estado))
     OR (OLD.estado = 'cancelado' AND public.pedido_consume_stock(NEW.estado))
  THEN
    IF NOT public.can_manage_pedidos() THEN
      RAISE EXCEPTION 'No autorizado: cancelar, anular o reactivar pedidos es una acción reservada a Backoffice/Superadmin.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_pedidos_guard_ciclo ON pedidos;
CREATE TRIGGER trg_pedidos_guard_ciclo
  BEFORE UPDATE OF estado ON pedidos FOR EACH ROW EXECUTE FUNCTION public.pedidos_guard_ciclo();
