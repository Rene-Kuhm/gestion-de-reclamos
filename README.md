# Gestión de Reclamos - Cospec Ltd

Sistema de gestión de reclamos técnicos y asignación de trabajos para Cospec Ltd.

## Características

- **Panel de Administrador**: Gestión completa de reclamos, técnicos y clientes.
- **Panel de Técnico**: Visualización de trabajos asignados, mapa de ruta y actualizaciones de estado.
- **Notificaciones Push**: Alertas en tiempo real para técnicos (Web Push) y administradores.
- **PWA**: Instalable en dispositivos móviles, con soporte offline básico.
- **Mapa Interactivo**: Ubicación de reclamos en mapa (Leaflet).

## Tecnologías

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Realtime) + Vercel Serverless Functions
- Notificaciones: Web Push Protocol (VAPID)

## Configuración

El proyecto requiere las siguientes variables de entorno en Vercel:

- `VITE_SUPABASE_URL`: URL de tu proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Clave anónima pública de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio (Service Role) de Supabase (solo backend).
- `VAPID_PUBLIC_KEY` y `VITE_VAPID_PUBLIC_KEY`: Clave pública VAPID (deben ser iguales).
- `VAPID_PRIVATE_KEY`: Clave privada VAPID.
- `VAPID_SUBJECT`: Email de contacto (ej: `mailto:admin@cospec.com`).
