-- Alter actualizaciones_estado table to cascade delete
ALTER TABLE public.actualizaciones_estado
DROP CONSTRAINT actualizaciones_estado_reclamo_id_fkey,
ADD CONSTRAINT actualizaciones_estado_reclamo_id_fkey
    FOREIGN KEY (reclamo_id)
    REFERENCES public.reclamos(id)
    ON DELETE CASCADE;

-- Alter comentarios_reclamo table to cascade delete
ALTER TABLE public.comentarios_reclamo
DROP CONSTRAINT comentarios_reclamo_reclamo_id_fkey,
ADD CONSTRAINT comentarios_reclamo_reclamo_id_fkey
    FOREIGN KEY (reclamo_id)
    REFERENCES public.reclamos(id)
    ON DELETE CASCADE;
