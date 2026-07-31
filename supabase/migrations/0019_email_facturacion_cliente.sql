-- =====================================================================
-- 0019 — Email de recepción de facturas electrónicas del cliente
-- =====================================================================
-- Sin este dato el cliente no recibe la factura electrónica (y por tanto
-- no paga). Es un correo a nivel de cliente (facturación), distinto de los
-- emails de las personas de contacto.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS email_facturacion VARCHAR(255);
