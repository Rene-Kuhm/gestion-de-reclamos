export type UserRole = 'admin' | 'tecnico';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  telefono?: string;
  created_at: string;
  updated_at: string;
}

export type ServiceType = 'fibra_optica' | 'adsl' | 'tv' | 'telefono';
export type JobStatus = 'pendiente' | 'en_proceso' | 'completado';

export interface Reclamo {
  id: string;
  creado_por: string;
  tecnico_asignado?: string;
  tipo_servicio: ServiceType;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
  descripcion: string;
  estado: JobStatus;
  fecha_creacion: string;
  fecha_actualizacion: string;
  foto_cierre?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono?: string;
  direccion: string;
  tipo_servicio?: ServiceType;
  numero_cliente?: string;
  created_at: string;
}

export interface ActualizacionEstado {
  id: string;
  reclamo_id: string;
  tecnico_id: string;
  estado_anterior: JobStatus;
  estado_nuevo: JobStatus;
  observaciones?: string;
  fecha_cambio: string;
}
