-- =====================================================================
-- COMESCO CRM — SKU puente, capa de cobros en pedidos e inventario
-- - referencias.sku: código del almacén/pedidos (puente con datos externos)
-- - pedidos: seguimiento de cobro (factura, valor, pagado, vencimiento, pago)
-- - inventario: stock actual por referencia (foto que se actualiza semanal)
-- =====================================================================

-- SKU puente en referencias
ALTER TABLE referencias ADD COLUMN sku VARCHAR(50);

-- Capa de cobros en pedidos (seguimiento, NO facturación real: eso es DIAN)
-- El saldo (valor_factura - pagado) se calcula en pantalla, no se almacena.
ALTER TABLE pedidos ADD COLUMN numero_factura VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN valor_factura DECIMAL(14,2);
ALTER TABLE pedidos ADD COLUMN pagado DECIMAL(14,2);
ALTER TABLE pedidos ADD COLUMN fecha_vencimiento DATE;
ALTER TABLE pedidos ADD COLUMN fecha_pago DATE;

-- Inventario: una fila por referencia (stock actual)
CREATE TABLE inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_id UUID NOT NULL UNIQUE REFERENCES referencias(id) ON DELETE CASCADE,
  cantidad_disponible DECIMAL(12,2) NOT NULL DEFAULT 0,
  ubicacion VARCHAR(100),
  contenedor VARCHAR(50),
  valor_unitario_cop DECIMAL(12,2),
  notas TEXT,
  actualizado_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventario_referencia ON inventario(referencia_id);

-- RLS: lectura para cualquier usuario logueado; escritura solo admin
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura_inventario" ON inventario FOR SELECT USING (true);
CREATE POLICY "insert_inventario" ON inventario FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "update_inventario" ON inventario FOR UPDATE USING (public.is_admin());
CREATE POLICY "delete_inventario" ON inventario FOR DELETE USING (public.is_admin());

-- Permisos base explícitos (para no depender de default privileges)
GRANT SELECT, INSERT, UPDATE, DELETE ON inventario TO authenticated;
