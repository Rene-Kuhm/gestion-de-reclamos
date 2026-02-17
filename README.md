# Cospec Ltd - Sistema de Gestión de Reclamos

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Supabase](https://img.shields.io/badge/Supabase-Database-green)

Una plataforma integral diseñada para optimizar el flujo de trabajo entre la administración y los técnicos de campo en servicios de telecomunicaciones (Fibra Óptica, ADSL, TV, Telefonía).

## 🚀 Características Principales

### 👨‍💼 Panel de Administración
*   **Gestión de Reclamos**: Alta, modificación y seguimiento de incidencias.
*   **Asignación Inteligente**: Asignación de técnicos y priorización de tareas.
*   **Dashboard en Tiempo Real**: Visualización del estado de la red y productividad.

### 👷 Panel Técnico (App Móvil / PWA)
*   **Bolsa de Trabajo**: Visualización de reclamos pendientes y auto-asignación.
*   **Geolocalización**: Mapa interactivo con la ubicación exacta de los clientes y navegación GPS.
*   **Gestión de Incidencias**: Cierre de trabajos, reporte de soluciones y comentarios.
*   **Métricas Personales**: Gráficos de rendimiento semanal, mensual y anual.
*   **Modo Offline**: Funcionalidad básica sin conexión.

### 🔔 Notificaciones y Comunicación
*   **Alertas Push**: Notificaciones instantáneas al recibir nuevos trabajos.
*   **Historial**: Registro completo de trabajos realizados.

## 🛠️ Tecnologías Utilizadas

*   **Frontend**: React.js, TypeScript, Vite
*   **Estilos**: Tailwind CSS, Lucide Icons
*   **Base de Datos & Auth**: Supabase (PostgreSQL)
*   **Mapas**: Leaflet / React-Leaflet
*   **Gráficos**: Recharts
*   **PWA**: Vite PWA Plugin

## 📱 Instalación (PWA)

Esta aplicación es una **Progressive Web App**. Puedes instalarla en tu dispositivo móvil o escritorio sin necesidad de tiendas de aplicaciones.

1.  Abre la aplicación en tu navegador (Chrome/Safari).
2.  **Android/PC**: Haz clic en el botón "Instalar App" que aparece automáticamente o en el menú del navegador "Instalar aplicación".
3.  **iOS**: Toca el botón "Compartir" y selecciona "Añadir a la pantalla de inicio".

## 🔧 Configuración del Proyecto (Desarrollo)

1.  **Clonar el repositorio**
    ```bash
    git clone https://github.com/Rene-Kuhm/gestion-de-reclamos.git
    cd gestion-de-reclamos
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**
    Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_supabase
    VITE_SUPABASE_ANON_KEY=tu_anon_key_supabase
    ```

4.  **Iniciar servidor de desarrollo**
    ```bash
    npm run dev
    ```

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para más detalles.

---
Desarrollado para **Cospec Ltd**.
