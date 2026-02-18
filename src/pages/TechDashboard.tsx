import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Reclamo } from '../types';
import { LogOut, RefreshCw, Briefcase, Map as MapIcon, User, PlusCircle, Search, History, BarChart3, Calendar, CheckCircle, Bell, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreateReclamoForm } from '../components/CreateReclamoForm';
import { JobCard } from '../components/JobCard';
import { enablePushForUser, sendPush } from '../lib/push';

export const TechDashboard: React.FC = () => {
  const { signOut, profile, session } = useAuth();
  const navigate = useNavigate();
  const [trabajos, setTrabajos] = useState<Reclamo[]>([]);
  const [todosReclamos, setTodosReclamos] = useState<Reclamo[]>([]);
  const [historial, setHistorial] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'mis_trabajos' | 'disponibles' | 'historial'>('mis_trabajos');
  const [editingReclamo, setEditingReclamo] = useState<Reclamo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTrabajos = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch assigned jobs (Pending/In Progress)
      const { data: misData, error: misError } = await supabase
        .from('reclamos')
        .select('*')
        .eq('tecnico_asignado', profile.id)
        .neq('estado', 'completado')
        .order('fecha_creacion', { ascending: false });

      if (misError) throw misError;
      setTrabajos(misData || []);

      // 2. Fetch completed jobs (History)
      const { data: histData, error: histError } = await supabase
        .from('reclamos')
        .select('*')
        .eq('tecnico_asignado', profile.id)
        .eq('estado', 'completado')
        .order('fecha_creacion', { ascending: false })
        .limit(20);

      if (histError) throw histError;
      setHistorial(histData || []);

      // 3. Fetch available (unassigned) jobs
      const { data: dispData, error: dispError } = await supabase
        .from('reclamos')
        .select('*')
        .is('tecnico_asignado', null)
        .eq('estado', 'pendiente')
        .order('fecha_creacion', { ascending: false });

      if (dispError) throw dispError;
      setTodosReclamos(dispData || []);

    } catch (error) {
      console.error('Error fetching trabajos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrabajos();

    if (!profile) return;

    if (session?.access_token && localStorage.getItem('pushEnabled') === 'true') {
      enablePushForUser({ userId: profile.id, accessToken: session.access_token });
    }

    // Request notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('tech-reclamos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reclamos',
        },
        (payload) => {
          console.log('Tech change received!', payload);
          fetchTrabajos();
          
          if (payload.eventType === 'INSERT') {
             // Only notify if it's assigned to me or unassigned
             const newReclamo = payload.new as Reclamo;
             if (newReclamo.tecnico_asignado === profile.id) {
               toast('Nuevo trabajo asignado', {
                 description: `Cliente: ${newReclamo.cliente_nombre}`
               });
               playNotificationSound();
               sendLocalNotification('Nuevo Trabajo Asignado', `Cliente: ${newReclamo.cliente_nombre}`);
             } else if (!newReclamo.tecnico_asignado) {
               // toast.info('Nuevo reclamo disponible en la bolsa'); 
             }
          } else if (payload.eventType === 'UPDATE') {
             const updatedReclamo = payload.new as Reclamo;
             const oldReclamo = payload.old as Reclamo; // Note: 'old' only contains ID unless Replica Identity is FULL
             
             // Check if it was just assigned to me
             if (updatedReclamo.tecnico_asignado === profile.id) {
                // If I wasn't assigned before, or if I don't know (safest to just notify if it's now mine and not completed)
                if (updatedReclamo.estado !== 'completado') {
                   toast('Trabajo actualizado', {
                     description: `Cliente: ${updatedReclamo.cliente_nombre}`
                   });
                   playNotificationSound();
                   sendLocalNotification('Trabajo Actualizado', `Cliente: ${updatedReclamo.cliente_nombre}`);
                }
             }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Tech subscription active!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Tech subscription failed');
          toast.error('Error de conexión en tiempo real');
        }
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => undefined);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  const sendLocalNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.svg'
      } as NotificationOptions);
    }
  };

  const handleSelfAssign = async (reclamoId: string) => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('reclamos')
        .update({ tecnico_asignado: profile.id, estado: 'en_proceso' })
        .eq('id', reclamoId);

      if (error) throw error;
      toast.success('Trabajo auto-asignado correctamente');
      setViewMode('mis_trabajos');
    } catch (error) {
      console.error('Error self-assigning:', error);
      toast.error('Error al tomar el trabajo');
    }
  };

  const filteredTrabajos = trabajos.filter(t => 
    t.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.direccion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistorial = historial.filter(t => 
    t.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.direccion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const completedToday = historial.filter(t => {
    const today = new Date().toDateString();
    return new Date(t.fecha_creacion).toDateString() === today; // Using creation date as proxy for completion date for now
  }).length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  if (!profile && !loading) return null; // Only return null if not loading AND no profile

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Professional Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-20 pb-12">
        <div className="max-w-md mx-auto px-5 py-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/50">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Cospec Ltd</h1>
                <p className="text-xs text-blue-200 font-medium tracking-wide uppercase">Técnico</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/profile')}
              className="group relative"
            >
              <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-blue-400 font-bold transition-all group-hover:border-blue-500 group-hover:text-blue-300">
                {profile?.nombre?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
            </button>
            <button
              onClick={() => {
                if (profile && session?.access_token) {
                  enablePushForUser({ userId: profile.id, accessToken: session.access_token });
                }
              }} 
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Activar notificaciones"
            >
              <Bell className="w-5 h-5" />
            </button>

            <button
              onClick={async () => {
                if (!profile || !session?.access_token) return;
                await sendPush({
                  accessToken: session.access_token,
                  targetUserId: profile.id,
                  title: 'Prueba de notificación',
                  body: 'Push configurado correctamente',
                  url: '/tecnico'
                });
                toast.success('Prueba enviada (revisa la notificación del sistema)');
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Enviar prueba push"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">{getGreeting()},</p>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {profile?.nombre?.split(' ')[0] || 'Usuario'}
            </h2>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 -mt-8 space-y-6 relative z-30">
        
        {/* Stats Widgets */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-1 duration-300">
            <div className="bg-blue-50 p-2 rounded-full mb-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{trabajos.length}</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pendientes</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-1 duration-300">
             <div className="bg-green-50 p-2 rounded-full mb-2">
               <CheckCircle className="w-5 h-5 text-green-600" />
             </div>
             <span className="text-2xl font-bold text-gray-900">{completedToday}</span>
             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hoy</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:-translate-y-1 duration-300">
             <div className="bg-purple-50 p-2 rounded-full mb-2">
               <History className="w-5 h-5 text-purple-600" />
             </div>
             <span className="text-2xl font-bold text-gray-900">{historial.length}</span>
             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</span>
          </div>
        </div>

        {/* Action Bar: Map & Search */}
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/tecnico/mapa')}
            className="flex-1 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 py-3 px-4 rounded-xl shadow-sm flex items-center justify-center transition-all group"
          >
            <MapIcon className="w-5 h-5 mr-2 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">Mapa</span>
          </button>
          <button
            onClick={() => navigate('/tecnico/estadisticas')}
            className="flex-1 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 py-3 px-4 rounded-xl shadow-sm flex items-center justify-center transition-all group"
          >
            <BarChart3 className="w-5 h-5 mr-2 text-purple-500 group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">Métricas</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar trabajo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm font-medium"
          />
        </div>

        {/* Custom Segmented Control */}
        <div className="bg-gray-200/50 p-1.5 rounded-xl flex shadow-inner overflow-x-auto border border-gray-200/50 backdrop-blur-sm">
          <button
            onClick={() => setViewMode('mis_trabajos')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 whitespace-nowrap ${
              viewMode === 'mis_trabajos'
                ? 'bg-white text-blue-600 shadow-sm scale-[1.02]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            Activos
            {trabajos.length > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] align-middle ${viewMode === 'mis_trabajos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-300 text-gray-600'}`}>
                {trabajos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('disponibles')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 whitespace-nowrap ${
              viewMode === 'disponibles'
                ? 'bg-white text-blue-600 shadow-sm scale-[1.02]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            Bolsa
            {todosReclamos.length > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] align-middle ${viewMode === 'disponibles' ? 'bg-blue-100 text-blue-700' : 'bg-gray-300 text-gray-600'}`}>
                {todosReclamos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('historial')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-lg transition-all duration-300 whitespace-nowrap ${
              viewMode === 'historial'
                ? 'bg-white text-blue-600 shadow-sm scale-[1.02]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            Historial
          </button>
        </div>

        {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-gray-400 text-sm font-medium animate-pulse">Sincronizando...</p>
            </div>
        ) : (
          <div className="space-y-3">
            {/* Create/Edit Form Modal */}
            {editingReclamo && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10">
                   <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center z-10">
                     <h3 className="font-bold text-lg">Editar Trabajo</h3>
                     <button 
                       onClick={() => setEditingReclamo(null)}
                       className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                     >
                       <LogOut className="w-5 h-5 text-gray-600 rotate-180" />
                     </button>
                   </div>
                   <div className="p-1">
                     <CreateReclamoForm 
                       initialData={editingReclamo}
                       onSuccess={() => {
                         setEditingReclamo(null);
                         fetchTrabajos();
                       }}
                       onCancel={() => setEditingReclamo(null)}
                     />
                   </div>
                </div>
              </div>
            )}

            {viewMode === 'mis_trabajos' ? (
              filteredTrabajos.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 mx-2">
                  <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-1">
                    {searchTerm ? 'No se encontraron resultados' : '¡Estás libre!'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6 px-6">
                    {searchTerm ? 'Intenta con otra búsqueda.' : 'No tienes trabajos asignados en este momento.'}
                  </p>
                  {!searchTerm && (
                    <button 
                      onClick={() => setViewMode('disponibles')}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                    >
                      Buscar en la Bolsa
                    </button>
                  )}
                </div>
              ) : (
                filteredTrabajos.map((trabajo) => (
                  <JobCard 
                    key={trabajo.id} 
                    trabajo={trabajo} 
                    isAssigned={true}
                    onEdit={setEditingReclamo}
                  />
                ))
              )
            ) : viewMode === 'historial' ? (
              /* HISTORIAL */
              filteredHistorial.length === 0 ? (
                 <div className="text-center py-16 mx-2">
                  <p className="text-gray-400 font-medium">No hay historial reciente.</p>
                </div>
              ) : (
                filteredHistorial.map((trabajo) => (
                  <JobCard 
                    key={trabajo.id} 
                    trabajo={trabajo} 
                    isAssigned={true}
                  />
                ))
              )
            ) : (
              /* DISPONIBLES (BOLSA DE TRABAJO) */
              todosReclamos.length === 0 ? (
                <div className="text-center py-16 mx-2">
                  <p className="text-gray-400 font-medium">No hay trabajos nuevos en la bolsa.</p>
                  <p className="text-gray-400 text-sm mt-1">Vuelve a revisar más tarde.</p>
                </div>
              ) : (
                todosReclamos.map((trabajo) => (
                  <JobCard 
                    key={trabajo.id} 
                    trabajo={trabajo} 
                    isAssigned={false}
                    onSelfAssign={handleSelfAssign}
                  />
                ))
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
};
