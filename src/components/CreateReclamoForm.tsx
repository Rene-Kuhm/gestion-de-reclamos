import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ServiceType, Reclamo } from '../types';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Save, MapPin, Loader2, LocateFixed, Map as MapIcon, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { LocationPickerMap } from './LocationPickerMap';

interface CreateReclamoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Reclamo | null;
}

export const CreateReclamoForm: React.FC<CreateReclamoFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo_servicio: initialData?.tipo_servicio || 'fibra_optica' as ServiceType,
    cliente_nombre: initialData?.cliente_nombre || '',
    cliente_telefono: initialData?.cliente_telefono || '',
    direccion: initialData?.direccion || '',
    descripcion: initialData?.descripcion || '',
    latitud: initialData?.latitud?.toString() || '',
    longitud: initialData?.longitud?.toString() || '',
  });

  const [showMapPicker, setShowMapPicker] = useState(false);

  const getGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no soportada por este navegador');
      return;
    }

    toast.info('Obteniendo ubicación...');
    
    const options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

    const success = (position: GeolocationPosition) => {
      setFormData(prev => ({
        ...prev,
        latitud: position.coords.latitude.toString(),
        longitud: position.coords.longitude.toString()
      }));
      toast.success('Ubicación obtenida con precisión');
    };

    const error = (err: GeolocationPositionError) => {
      console.warn(`ERROR(${err.code}): ${err.message}`);
      
      // Fallback: Try with lower accuracy if high accuracy fails or any error occurs
      // We check if we haven't already retried to avoid infinite loops
      if (options.enableHighAccuracy) {
        toast.info('GPS preciso falló, intentando aproximación...');
        const lowAccuracyOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: Infinity };
        
        navigator.geolocation.getCurrentPosition(
          success,
          (finalErr) => {
             console.error(finalErr);
             toast.error('No se pudo obtener la ubicación. Por favor use el mapa manual.');
          },
          lowAccuracyOptions
        );
      } else {
        toast.error('Error de GPS: ' + err.message + '. Intente usar el selector de mapa.');
      }
    };

    navigator.geolocation.getCurrentPosition(success, error, options);
  };

  const handleMapConfirm = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitud: lat.toString(),
      longitud: lng.toString()
    }));
    setShowMapPicker(false);
    toast.success('Ubicación seleccionada en el mapa');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      if (initialData) {
        // Update existing reclamo
        const { error } = await supabase
          .from('reclamos')
          .update({
            ...formData,
            latitud: formData.latitud ? parseFloat(formData.latitud) : null,
            longitud: formData.longitud ? parseFloat(formData.longitud) : null,
          })
          .eq('id', initialData.id);

        if (error) throw error;
        toast.success('Reclamo actualizado exitosamente');
      } else {
        // Create new reclamo
        const { error } = await supabase.from('reclamos').insert({
          ...formData,
          latitud: formData.latitud ? parseFloat(formData.latitud) : null,
          longitud: formData.longitud ? parseFloat(formData.longitud) : null,
          creado_por: profile.id,
          estado: 'pendiente',
        });

        if (error) throw error;
        toast.success('Reclamo creado exitosamente');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving reclamo:', error);
      toast.error(error.message || 'Error al guardar el reclamo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        {initialData ? (
          <>
            <Edit className="w-5 h-5 mr-2 text-blue-600" />
            Editar Reclamo
          </>
        ) : (
          <>
            <PlusCircle className="w-5 h-5 mr-2 text-blue-600" />
            Nuevo Reclamo
          </>
        )}
      </h3>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
          <input
            type="text"
            name="cliente_nombre"
            required
            value={formData.cliente_nombre}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            name="cliente_telefono"
            required
            value={formData.cliente_telefono}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="direccion"
              required
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Calle y número"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={getGeolocation}
              title="Obtener ubicación actual (GPS)"
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-gray-600"
            >
              <LocateFixed className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              title="Seleccionar en Mapa"
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-blue-600"
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
          {(formData.latitud || formData.longitud) && (
            <p className="text-xs text-green-600 mt-1 flex items-center font-medium">
              <MapPin className="w-3 h-3 mr-1" />
              Ubicación precisa: {Number(formData.latitud).toFixed(6)}, {Number(formData.longitud).toFixed(6)}
            </p>
          )}
        </div>

        {/* Map Picker Modal */}
        {showMapPicker && (
          <LocationPickerMap
            onConfirm={handleMapConfirm}
            onCancel={() => setShowMapPicker(false)}
            initialLat={formData.latitud ? parseFloat(formData.latitud) : undefined}
            initialLng={formData.longitud ? parseFloat(formData.longitud) : undefined}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Servicio</label>
          <select
            name="tipo_servicio"
            value={formData.tipo_servicio}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fibra_optica">Fibra Óptica</option>
            <option value="adsl">ADSL</option>
            <option value="tv">TV</option>
            <option value="telefono">Teléfono Fijo</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Problema</label>
          <textarea
            name="descripcion"
            required
            rows={3}
            value={formData.descripcion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2 flex justify-end space-x-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar Reclamo'}
          </button>
        </div>
      </form>
    </div>
  );
};
