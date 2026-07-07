-- =====================================================================
-- COMESCO CRM — Razón social del cliente + fechas de seguimiento del pedido
-- - clientes.razon_social: nombre fiscal (distinto del nombre comercial/marca)
-- - pedidos.fecha_entrega / fecha_factura: seguimiento del ciclo del pedido
--   (recepción ya existe como fecha_pedido). Desde la factura cuenta el plazo.
-- =====================================================================
ALTER TABLE clientes ADD COLUMN razon_social VARCHAR(255);
ALTER TABLE pedidos ADD COLUMN fecha_entrega DATE;
ALTER TABLE pedidos ADD COLUMN fecha_factura DATE;
