-- Fix infinite recursion in RLS policies

-- 1. Create a secure function to check if user is admin
-- SECURITY DEFINER allows this function to run with privileges of the creator (bypassing RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = auth.uid() AND rol = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic recursive policy on users
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.usuarios;

-- 3. Re-create the policy using the secure function
CREATE POLICY "Admins can view all profiles" ON public.usuarios
    FOR SELECT USING (public.is_admin());

-- 4. Update Reclamos policies for consistency and performance
DROP POLICY IF EXISTS "Admins can view all reclamos" ON public.reclamos;
CREATE POLICY "Admins can view all reclamos" ON public.reclamos
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can create reclamos" ON public.reclamos;
CREATE POLICY "Admins can create reclamos" ON public.reclamos
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update reclamos" ON public.reclamos;
CREATE POLICY "Admins can update reclamos" ON public.reclamos
    FOR UPDATE USING (public.is_admin());

-- 5. Update Actualizaciones policies
DROP POLICY IF EXISTS "Admins can view all updates" ON public.actualizaciones_estado;
CREATE POLICY "Admins can view all updates" ON public.actualizaciones_estado
    FOR SELECT USING (public.is_admin());

-- 6. Update Comentarios policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comentarios_reclamo') THEN
        DROP POLICY IF EXISTS "Users can view comments for their assigned jobs or if admin" ON comentarios_reclamo;
        CREATE POLICY "Users can view comments for their assigned jobs or if admin" ON comentarios_reclamo
          FOR SELECT
          USING (
            public.is_admin() OR
            EXISTS (
              SELECT 1 FROM reclamos WHERE id = comentarios_reclamo.reclamo_id AND tecnico_asignado = auth.uid()
            )
          );

        DROP POLICY IF EXISTS "Users can insert comments for their assigned jobs or if admin" ON comentarios_reclamo;
        CREATE POLICY "Users can insert comments for their assigned jobs or if admin" ON comentarios_reclamo
          FOR INSERT
          WITH CHECK (
            public.is_admin() OR
            EXISTS (
              SELECT 1 FROM reclamos WHERE id = comentarios_reclamo.reclamo_id AND tecnico_asignado = auth.uid()
            )
          );
    END IF;
END
$$;
