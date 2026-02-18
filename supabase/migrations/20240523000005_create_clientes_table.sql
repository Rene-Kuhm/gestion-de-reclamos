-- Create clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    telefono VARCHAR,
    direccion TEXT NOT NULL,
    tipo_servicio VARCHAR CHECK (tipo_servicio IN ('fibra_optica', 'adsl', 'tv', 'telefono')),
    numero_cliente VARCHAR, -- Optional external ID from their system
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.clientes
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update access to authenticated users (admins/techs)
CREATE POLICY "Enable insert/update for authenticated users" ON public.clientes
    FOR ALL USING (auth.role() = 'authenticated');

-- Create index for faster search
CREATE INDEX idx_clientes_nombre ON public.clientes(nombre);
CREATE INDEX idx_clientes_direccion ON public.clientes(direccion);
