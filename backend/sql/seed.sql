-- Seed data para Restaurant-System

-- Mesas iniciales
INSERT INTO mesas (id, numero, capacidad, estado, habilitada, activo) VALUES
('M01', 1, 4, 'LIBRE', true, true),
('M02', 2, 2, 'LIBRE', true, true),
('M03', 3, 6, 'LIBRE', true, true),
('M04', 4, 4, 'LIBRE', true, true);

-- Meseros iniciales
INSERT INTO meseros (id, nombre, dni, celular, estado, activo) VALUES
('W01', 'Juan Perez', '12345678', '987654321', 'ACTIVO', true),
('W02', 'Maria Garcia', '87654321', '912345678', 'ACTIVO', true),
('W03', 'Pedro Rodriguez', '45678912', '945612378', 'ACTIVO', true);

-- Productos (Catálogo Picantero)
-- Los precios se insertan como céntimos (ej: 28.00 -> 2800)
INSERT INTO productos (id, nombre, precio_cents, disponibilidad, estado, activo, descripcion) VALUES
('P01', 'Rocoto Relleno con Pastel de Papa', 2800, true, true, true, 'Rocoto desvenado relleno de carne picada a cuchillo, pasas y aceituna, cubierto de queso derretido y acompañado de su clásico pastel de papa horneado.'),
('P02', 'Solterito de Queso', 1800, true, true, true, 'Ensalada fresca y colorida de habas tiernas, choclo desgranado, queso fresco en cubos, aceitunas negras, tomate y cebolla, aliñada con aceite y vinagre.'),
('P03', 'Ocopa Tradicional', 1600, true, true, true, 'Rodajas de papas sancochadas bañadas en una cremosa salsa de huacatay, maní y queso, hecha en batán. Acompañada de huevo duro y aceituna.'),
('P04', 'Escribano', 1400, true, true, true, 'Papas machacadas con tomate, rocoto picadito, vinagre y un chorro de aceite.'),
('P05', 'Cuy Chactado', 5500, true, true, true, 'Cuy entero tierno, aderezado y frito bajo el peso de una piedra de batán hasta quedar perfectamente crocante. Servido con papas doradas y ensalada.'),
('P06', 'Costillar Dorado', 4200, true, true, true, 'Costilla de cordero de leche, sazonada con ají y ajo, frita hasta quedar doradita por fuera y jugosa por dentro. Viene con papas fritas y ensalada criolla.'),
('P07', 'Malaya Frita', 3800, true, true, true, 'Falda de res sancochada con especias y luego dorada a la sartén. Se sirve con papas doradas y una buena porción de sarza de cebolla.'),
('P08', 'El Triple Picantero', 4500, true, true, true, 'Combinado de tres clásicos en un solo plato: Rocoto relleno, Pastel de papa y un picante del día (Matasquita o Ají de calabaza).'),
('P09', 'Chicha de Jora (Caporal)', 800, true, true, true, 'Néctar de maíz fermentado artesanalmente. El maridaje obligatorio de toda picantería.'),
('P10', 'Chicha Morada Helada (Jarra)', 1500, true, true, true, 'Preparada en casa con maíz morado, piña, membrillo, manzana y un toque de limón.');