-- =====================================================================
-- COMESCO CRM — Catálogo maestro de referencias (seed)
-- 22 referencias (producto + formato, nunca agrupados). Sección 10.2 del brief.
-- Reciben codigo_interno REF-000001 ... REF-000022 automáticamente.
-- =====================================================================
INSERT INTO referencias (proveedor, nombre_producto, formato, categoria, unidades_por_caja, cajas_por_palet, unidades_por_palet) VALUES
('Oleosandua','Aceite de oliva virgen extra','5L','Aceite',3,60,180),
('Oleosandua','Aceite de oliva virgen extra','3L','Aceite',6,52,312),
('Oleosandua','Aceite de oliva virgen extra','500ML','Aceite',12,144,1728),
('Bella San Marzano','Tomate pelado San Marzano alta calidad','2,5KG','Tomate',6,50,300),
('Ecovinal','Vinagre balsámico','250ML','Vinagre',6,560,3360),
('Ecovinal','Vinagre de sidra de manzana eco','500ML','Vinagre',12,105,1260),
('Ecovinal','Vinagre balsámico','5L','Vinagre',2,84,168),
('Maestros Aceituneros','Aceitunas Embrujos','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas Maestro Andaluz','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas El Cóctel','4,2KG','Aceitunas',3,55,165),
('Maestros Aceituneros','Aceitunas Embrujos','370ML','Aceitunas',12,168,2016),
('Maestros Aceituneros','Aceitunas Maestro Andaluz','370ML','Aceitunas',12,168,2016),
('Maestros Aceituneros','Aceitunas El Cóctel','370ML','Aceitunas',12,168,2016),
('Vinigalicia','Vino tinto Madera Raigal','750ML','Vino',12,130,1560),
('Vinigalicia','Vino blanco Raigal','750ML','Vino',12,130,1560),
('Vinigalicia','Vino rosado Raigal','750ML','Vino',12,130,1560),
('Agroalcinca','Arroz Carnaroli Monterino','1KG','Arroz',10,50,500),
('Entrepinares','Queso burger institucional (84 lonchas)','1,05KG','Queso',10,77,770),
('La Pirenaica','Jamón serrano loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Chorizo loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Salchichón loncheado','80G','Charcutería',20,152,3040),
('La Pirenaica','Tapas mix','150G','Charcutería',10,110,1100);
