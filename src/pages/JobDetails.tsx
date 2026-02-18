import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Reclamo, JobStatus } from '../types';
import { ArrowLeft, MessageCircle, Navigation, CheckCircle, Clock, AlertCircle, Loader2, Camera, X, FileText, Send, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { JobComments } from '../components/JobComments';
import { sendPush } from '../lib/push';

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [trabajo, setTrabajo] = useState<Reclamo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observation, setObservation] = useState('');
  const [nextStatus, setNextStatus] = useState<JobStatus | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrabajo = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reclamos')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setTrabajo(data);

        // Fetch historial
        const { data: historialData, error: historialError } = await supabase
          .from('actualizaciones_estado')
          .select('*')
          .eq('reclamo_id', id)
          .order('fecha_cambio', { ascending: false });

        if (!historialError) {
          setHistorial(historialData || []);
        }

      } catch (error) {
        console.error('Error fetching trabajo:', error);
        toast.error('Error al cargar el trabajo');
        navigate('/tecnico');
      } finally {
        setLoading(false);
      }
    };

    fetchTrabajo();
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;

    const reclamoChannel = supabase
      .channel(`job-${id}-reclamo`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reclamos', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Reclamo;
          setTrabajo((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reclamos', filter: `id=eq.${id}` },
        () => {
          toast.error('Este trabajo fue eliminado');
          navigate('/tecnico');
        }
      )
      .subscribe();

    const historialChannel = supabase
      .channel(`job-${id}-historial`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actualizaciones_estado', filter: `reclamo_id=eq.${id}` },
        async () => {
          const { data: historialData, error: historialError } = await supabase
            .from('actualizaciones_estado')
            .select('*')
            .eq('reclamo_id', id)
            .order('fecha_cambio', { ascending: false });

          if (!historialError) {
            setHistorial(historialData || []);
          }
        }
      )
      .subscribe();

    return () => {
      reclamoChannel.unsubscribe();
      historialChannel.unsubscribe();
    };
  }, [id, navigate]);

  const handleStatusChangeClick = (newStatus: JobStatus) => {
    setNextStatus(newStatus);
    setObservation('');
    setPhoto(null);
    setPhotoPreview(null);
    setShowObservationModal(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmStatusChange = async () => {
    if (!trabajo || !profile || !nextStatus) return;
    setUpdating(true);
    try {
      // 1. Update reclamo status
      // In a real app, upload photo to Supabase Storage and get URL
      // For now, we'll store the base64 string if it's small enough, or just a placeholder
      // NOTE: Storing base64 in TEXT column is bad practice for large images, but okay for MVP demo
      
      const updateData: any = { 
        estado: nextStatus, 
        fecha_actualizacion: new Date().toISOString() 
      };

      if (photoPreview && nextStatus === 'completado') {
        updateData.foto_cierre = photoPreview; // Store base64
      }

      const { error: updateError } = await supabase
        .from('reclamos')
        .update(updateData)
        .eq('id', trabajo.id);

      if (updateError) throw updateError;

      // 2. Log history (actualizaciones_estado)
      const newEntry = {
        reclamo_id: trabajo.id,
        tecnico_id: profile.id,
        estado_anterior: trabajo.estado,
        estado_nuevo: nextStatus,
        observaciones: observation || `Estado actualizado a ${nextStatus}`
      };

      await supabase.from('actualizaciones_estado').insert(newEntry);

      if (session?.access_token) {
        await sendPush({
          accessToken: session.access_token,
          targetRole: 'admin',
          title: 'Actualización de trabajo',
          body: `${trabajo.cliente_nombre}: ${trabajo.estado.replace('_', ' ')} → ${nextStatus.replace('_', ' ')}`,
          url: '/admin'
        });
      }

      setTrabajo({ ...trabajo, estado: nextStatus });
      
      // Update local history
      setHistorial([
        {
          ...newEntry, 
          id: Math.random(), // Temp ID
          fecha_cambio: new Date().toISOString()
        }, 
        ...historial
      ]);

      toast.success(`Estado actualizado a ${nextStatus.replace('_', ' ')}`);
      setShowObservationModal(false);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  };

  const openWhatsApp = () => {
    if (!trabajo) return;
    // Remove non-numeric characters for the link
    const phone = trabajo.cliente_telefono.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const openMaps = () => {
    if (!trabajo) return;
    
    if (trabajo.latitud && trabajo.longitud) {
      // Use coordinates for precision
      window.open(`https://www.google.com/maps/search/?api=1&query=${trabajo.latitud},${trabajo.longitud}`, '_blank');
    } else {
      // Fallback to address search
      const query = encodeURIComponent(trabajo.direccion);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );
  
  if (!trabajo) return (
    <div className="p-8 text-center bg-gray-100 min-h-screen flex flex-col items-center justify-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold text-gray-800">Trabajo no encontrado</h2>
      <button 
        onClick={() => navigate('/tecnico')}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
          <button 
            onClick={() => navigate('/tecnico')}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Detalle del Trabajo</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Status Card */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col items-center justify-center space-y-4">
            <span className={`px-4 py-2 text-sm font-bold rounded-full uppercase tracking-wide
              ${trabajo.estado === 'completado' ? 'bg-green-100 text-green-800' : 
                trabajo.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'}`}>
              {trabajo.estado.replace('_', ' ')}
            </span>
            
            <div className="flex space-x-2 w-full">
              {trabajo.estado === 'pendiente' && (
                <button
                  onClick={() => handleStatusChangeClick('en_proceso')}
                  disabled={updating}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex justify-center items-center"
                >
                  <Clock className="w-5 h-5 mr-2" /> Iniciar Trabajo
                </button>
              )}
              
              {trabajo.estado === 'en_proceso' && (
                <button
                  onClick={() => handleStatusChangeClick('completado')}
                  disabled={updating}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition flex justify-center items-center"
                >
                  <CheckCircle className="w-5 h-5 mr-2" /> Completar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={openWhatsApp}
            className="bg-[#25D366] text-white p-4 rounded-lg shadow-sm hover:opacity-90 transition flex flex-col items-center justify-center"
          >
            <MessageCircle className="w-8 h-8 mb-2" />
            <span className="font-semibold">WhatsApp</span>
          </button>
          
          <button
            onClick={openMaps}
            className="bg-blue-500 text-white p-4 rounded-lg shadow-sm hover:opacity-90 transition flex flex-col items-center justify-center"
          >
            <Navigation className="w-8 h-8 mb-2" />
            <span className="font-semibold">Ir al Mapa</span>
          </button>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700">Información del Cliente</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Cliente</label>
              <p className="text-gray-900 font-medium text-lg">{trabajo.cliente_nombre}</p>
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Dirección</label>
              <p className="text-gray-900 text-lg">{trabajo.direccion}</p>
              {trabajo.latitud && trabajo.longitud && (
                <p className="text-sm text-green-600 mt-1 flex items-center font-medium">
                  <MapPin className="w-3 h-3 mr-1" />
                  Ubicación GPS precisa disponible
                </p>
              )}
            </div>
            
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Teléfono</label>
              <p className="text-gray-900">{trabajo.cliente_telefono}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Servicio</label>
              <p className="text-gray-900 capitalize">{trabajo.tipo_servicio.replace('_', ' ')}</p>
            </div>

            {trabajo.foto_cierre && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Evidencia de Cierre</label>
                <img 
                  src={trabajo.foto_cierre} 
                  alt="Evidencia" 
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  onClick={() => window.open(trabajo.foto_cierre, '_blank')} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700">Descripción del Problema</h3>
          </div>
          <div className="p-6">
            <p className="text-gray-800 whitespace-pre-wrap">{trabajo.descripcion}</p>
          </div>
        </div>

        {/* Comments Section */}
        <JobComments reclamoId={trabajo.id} />

        {/* History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700">Historial de Actividad</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {historial.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm">No hay actividad registrada aún.</p>
            ) : (
              historial.map((item) => (
                <div key={item.id} className="p-4 flex items-start">
                  <div className="mr-3 mt-1">
                    <div className="h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Cambio a <span className="uppercase">{item.estado_nuevo.replace('_', ' ')}</span>
                    </p>
                    {item.observaciones && (
                      <p className="text-sm text-gray-600 mt-1">{item.observaciones}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(item.fecha_cambio), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 pt-4">
          Creado el {format(new Date(trabajo.fecha_creacion), 'dd/MM/yyyy HH:mm')}
        </div>
      </main>

      {/* Observation Modal */}
      {showObservationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Confirmar Cambio de Estado</h3>
            <p className="mb-4 text-gray-600">
              Vas a cambiar el estado a <span className="font-semibold uppercase">{nextStatus?.replace('_', ' ')}</span>.
              ¿Deseas agregar alguna observación?
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              placeholder="Ej: Instalación completada, router configurado..."
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
            />

            {nextStatus === 'completado' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Evidencia Fotográfica</label>
                {!photoPreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Camera className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Tocar para tomar foto</p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handlePhotoChange}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                    <button
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowObservationModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
