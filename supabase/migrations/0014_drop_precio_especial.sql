-- El "precio especial" de las condiciones era un campo decorativo: no lo usaba
-- ningún cálculo (los pedidos se tarifican con la tarifa de canal + PAC).
-- Se elimina para no confundir.
ALTER TABLE condiciones_comerciales DROP COLUMN IF EXISTS precio_especial;
