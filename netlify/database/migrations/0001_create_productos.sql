CREATE TYPE estado_prenda AS ENUM (
  'disponible',
  'apartado',
  'comprado'
);

CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  foto TEXT,
  descripcion TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  categoria TEXT NOT NULL,
  estado estado_prenda NOT NULL DEFAULT 'disponible'
);
