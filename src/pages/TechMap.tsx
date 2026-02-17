import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { Reclamo } from '../types';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Loader2, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export const TechMap: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location", error);
        }
      );
    }

    const fetchTrabajos = async () => {
      if (!profile) return;
      try {
        const { data, error } = await supabase
          .from('reclamos')
          .select('*')
          .eq('tecnico_asignado', profile.id)
          .neq('estado', 'completado'); // Only show active jobs? Or all? Let's show active for now.

        if (error) throw error;
        setTrabajos(data || []);
      } catch (error) {
        console.error('Error fetching trabajos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrabajos();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Default center: User location or Eduardo Castex (fallback)
  const center: [number, number] = userLocation || [-35.9157, -64.2952];

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white shadow-sm z-10 p-4 flex items-center justify-between">
        <button 
          onClick={() => navigate('/tecnico')}
          className="text-gray-600 hover:text-gray-900 flex items-center"
        >
          <ArrowLeft className="w-6 h-6 mr-2" />
          Volver al Listado
        </button>
        <h1 className="font-bold text-lg">Mapa de Trabajos</h1>
      </header>
      
      <div className="flex-1 relative z-0">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            })}>
              <Popup>Tu ubicación actual</Popup>
            </Marker>
          )}

          {/* Job Markers */}
          {trabajos.map((trabajo) => {
            if (trabajo.latitud && trabajo.longitud) {
              return (
                <Marker 
                  key={trabajo.id} 
                  position={[trabajo.latitud, trabajo.longitud]}
                  icon={L.icon({
                    iconUrl: trabajo.estado === 'en_proceso' 
                      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png'
                      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-sm mb-1">{trabajo.cliente_nombre}</h3>
                      <p className="text-xs text-gray-600 mb-2">{trabajo.direccion}</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => navigate(`/tecnico/trabajo/${trabajo.id}`)}
                          className="flex-1 bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700"
                        >
                          Ver Detalles
                        </button>
                        <button
                           onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${trabajo.latitud},${trabajo.longitud}`, '_blank')}
                           className="bg-green-600 text-white p-1 rounded hover:bg-green-700"
                           title="Navegar"
                        >
                          <Navigation className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
          })}
        </MapContainer>
      </div>
    </div>
  );
};
