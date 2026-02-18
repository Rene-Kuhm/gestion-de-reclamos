-- Ensure clientes.nombre can be used for ON CONFLICT upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'clientes'
      AND indexname = 'clientes_nombre_unique'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX clientes_nombre_unique ON public.clientes (nombre)';
  END IF;
END $$;

