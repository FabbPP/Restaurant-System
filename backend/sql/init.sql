-- Script de inicialización para PostgreSQL

CREATE TABLE IF NOT EXISTS productos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio_cents INTEGER NOT NULL,
  disponibilidad BOOLEAN DEFAULT TRUE,
  descripcion TEXT,
  estado BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mesas (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL,
  capacidad INTEGER NOT NULL,
  estado TEXT DEFAULT 'LIBRE',
  habilitada BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS meseros (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  dni TEXT,
  celular TEXT,
  estado TEXT DEFAULT 'ACTIVO',
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ordenes (
  id TEXT PRIMARY KEY,
  tipo TEXT,
  mesa_id TEXT REFERENCES mesas(id),
  mesero_id TEXT REFERENCES meseros(id),
  cliente TEXT,
  estado TEXT DEFAULT 'PENDIENTE',
  total_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_items (
  id SERIAL PRIMARY KEY,
  orden_id TEXT REFERENCES ordenes(id) ON DELETE CASCADE,
  producto_id TEXT REFERENCES productos(id),
  cantidad INTEGER,
  precio_cents INTEGER
);
