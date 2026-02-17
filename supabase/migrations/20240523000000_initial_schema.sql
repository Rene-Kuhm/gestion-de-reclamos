-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Users table (Profiles) linked to auth.users
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'tecnico')),
    telefono VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Reclamos table
CREATE TABLE IF NOT EXISTS public.reclamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creado_por UUID NOT NULL REFERENCES public.usuarios(id),
    tecnico_asignado UUID REFERENCES public.usuarios(id),
    tipo_servicio VARCHAR(20) NOT NULL CHECK (tipo_servicio IN ('fibra_optica', 'adsl', 'tv', 'telefono')),
    cliente_nombre VARCHAR(100) NOT NULL,
    cliente_telefono VARCHAR(20) NOT NULL,
    direccion TEXT NOT NULL,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    descripcion TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completado')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Status Updates table
CREATE TABLE IF NOT EXISTS public.actualizaciones_estado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamo_id UUID NOT NULL REFERENCES public.reclamos(id) ON DELETE CASCADE,
    tecnico_id UUID NOT NULL REFERENCES public.usuarios(id),
    estado_anterior VARCHAR(20) NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    observaciones TEXT,
    fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_reclamos_tecnico ON public.reclamos(tecnico_asignado);
CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON public.reclamos(estado);
CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON public.reclamos(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_reclamo ON public.actualizaciones_estado(reclamo_id);
CREATE INDEX IF NOT EXISTS idx_actualizaciones_fecha ON public.actualizaciones_estado(fecha_cambio DESC);

-- Enable Row Level Security
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actualizaciones_estado ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
CREATE POLICY "Users can view their own profile" ON public.usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.usuarios
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'));

-- Update policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.usuarios
    FOR UPDATE USING (auth.uid() = id);

-- Insert policy for trigger
CREATE POLICY "Enable insert for authenticated users only" ON public.usuarios
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for Reclamos
CREATE POLICY "Admins can view all reclamos" ON public.reclamos
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "Technicians can view assigned reclamos" ON public.reclamos
    FOR SELECT USING (tecnico_asignado = auth.uid());

CREATE POLICY "Admins can create reclamos" ON public.reclamos
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "Admins can update reclamos" ON public.reclamos
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "Technicians can update status of assigned reclamos" ON public.reclamos
    FOR UPDATE USING (tecnico_asignado = auth.uid());

-- RLS Policies for Actualizaciones Estado
CREATE POLICY "Admins can view all updates" ON public.actualizaciones_estado
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "Technicians can view updates for their assigned reclamos" ON public.actualizaciones_estado
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.reclamos WHERE id = reclamo_id AND tecnico_asignado = auth.uid()));

CREATE POLICY "Users can create updates" ON public.actualizaciones_estado
    FOR INSERT WITH CHECK (auth.uid() = tecnico_id);

-- Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, rol)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'nombre', COALESCE(new.raw_user_meta_data->>'rol', 'tecnico'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
