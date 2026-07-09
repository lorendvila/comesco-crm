-- =====================================================================
-- COMESCO CRM — Coste hasta almacén en el maestro de productos
-- El coste (no el precio de venta) es un atributo del producto.
-- El valor del inventario = cantidad_disponible × coste_almacen_cop.
-- Se retira valor_unitario_cop de inventario (concepto duplicado).
-- =====================================================================
ALTER TABLE referencias ADD COLUMN coste_almacen_cop DECIMAL(12,2);
ALTER TABLE inventario DROP COLUMN valor_unitario_cop;
