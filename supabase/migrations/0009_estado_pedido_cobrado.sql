-- =====================================================================
-- COMESCO CRM — Nuevo estado de pedido: "cobrado"
-- Ciclo: recibido -> entregado -> facturado -> cobrado (o cancelado).
-- =====================================================================
ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('recibido','entregado','facturado','cobrado','cancelado'));
