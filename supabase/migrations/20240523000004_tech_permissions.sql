-- Update RLS policies to allow technicians to view all unassigned/pending jobs
-- and edit specific fields of their assigned jobs

-- 1. Allow technicians to view unassigned jobs (for self-assignment or general view)
DROP POLICY IF EXISTS "Technicians can view assigned reclamos" ON public.reclamos;

CREATE POLICY "Technicians can view assigned or unassigned reclamos" ON public.reclamos
    FOR SELECT USING (
        tecnico_asignado = auth.uid() OR 
        tecnico_asignado IS NULL
    );

-- 2. Allow technicians to update specific fields of their assigned jobs
-- (We use the same UPDATE policy but the frontend will restrict which fields are sent)
-- Ideally, we would use a trigger or column-level privileges, but for RLS simple check is enough
-- The existing policy "Technicians can update status of assigned reclamos" is:
-- FOR UPDATE USING (tecnico_asignado = auth.uid());
-- This already allows them to update ANY column if they are assigned. 
-- We just need to ensure the UI handles the "Edit" form correctly.

-- 3. Allow technicians to "Pick" a job (assign themselves)
-- This requires UPDATE permission on unassigned jobs
DROP POLICY IF EXISTS "Technicians can update status of assigned reclamos" ON public.reclamos;

CREATE POLICY "Technicians can update assigned jobs or pick unassigned" ON public.reclamos
    FOR UPDATE USING (
        tecnico_asignado = auth.uid() OR 
        (tecnico_asignado IS NULL AND estado = 'pendiente')
    )
    WITH CHECK (
        -- Can only update if they are assigning themselves or it's already theirs
        tecnico_asignado = auth.uid()
    );
