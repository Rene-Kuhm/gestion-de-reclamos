-- Create job_comments table
CREATE TABLE IF NOT EXISTS comentarios_reclamo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reclamo_id UUID REFERENCES reclamos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key relationship if not automatically detected (usually auth.users is special)
-- We'll just rely on the UUID for now, but in a real app we might want to join with public.usuarios

-- Add RLS policies
ALTER TABLE comentarios_reclamo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments for their assigned jobs or if admin" ON comentarios_reclamo
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM reclamos WHERE id = comentarios_reclamo.reclamo_id AND tecnico_asignado = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments for their assigned jobs or if admin" ON comentarios_reclamo
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM reclamos WHERE id = comentarios_reclamo.reclamo_id AND tecnico_asignado = auth.uid()
    )
  );
