-- Add photo column to reclamos table
ALTER TABLE reclamos ADD COLUMN IF NOT EXISTS foto_cierre TEXT;

-- Add search indexes
CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_reclamos_direccion ON reclamos(direccion);
