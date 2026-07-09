-- =====================================================================
-- COMESCO CRM — IVA por referencia
-- Para desglosar IVA en las facturas (base + IVA = total facturado).
-- Regla: 19% todos, 5% el vino.
-- =====================================================================
ALTER TABLE referencias ADD COLUMN iva_pct DECIMAL(5,2) NOT NULL DEFAULT 19;
UPDATE referencias SET iva_pct = 5 WHERE categoria = 'Vino';
