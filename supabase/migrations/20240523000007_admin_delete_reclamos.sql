-- Allow admins to delete reclamos
CREATE POLICY "Admins can delete reclamos" ON public.reclamos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios
      WHERE id = auth.uid()
        AND rol = 'admin'
    )
  );

