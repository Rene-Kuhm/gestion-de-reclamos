import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Reclamo, UserProfile } from '../types';
import { ArrowLeft, Loader2, Trophy, Briefcase, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface TechStats {
  id: string;
  nombre: string;
  email: string;
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
}

export const TechManagement: React.FC = () => {
  const navigate = useNavigate();
  const [techStats, setTechStats] = useState<TechStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch all technicians
        const { data: techs, error: techError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('rol', 'tecnico');

        if (techError) throw techError;

        // 2. Fetch all claims
        const { data: reclamos, error: reclamoError } = await supabase
          .from('reclamos')
          .select('id, tecnico_asignado, estado');

        if (reclamoError) throw reclamoError;

        // 3. Calculate stats per technician
        const stats = techs.map((tech) => {
          const techReclamos = reclamos?.filter((r) => r.tecnico_asignado === tech.id) || [];
          return {
            id: tech.id,
            nombre: tech.nombre,
            email: tech.email,
            total: techReclamos.length,
            completed: techReclamos.filter((r) => r.estado === 'completado').length,
            pending: techReclamos.filter((r) => r.estado === 'pendiente').length,
            in_progress: techReclamos.filter((r) => r.estado === 'en_proceso').length,
          };
        });

        // Sort by completed count (descending)
        setTechStats(stats.sort((a, b) => b.completed - a.completed));
      } catch (error: any) {
        console.error('Error fetching stats:', error);
        toast.error('Error al cargar estadísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-8">
          <button 
            onClick={() => navigate('/admin')}
            className="mr-4 text-gray-600 hover:text-gray-900 bg-white p-2 rounded-full shadow-sm"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Técnicos</h1>
            <p className="text-gray-500">Rendimiento y carga de trabajo del equipo</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techStats.map((tech) => (
            <div key={tech.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{tech.nombre}</h3>
                  <p className="text-sm text-gray-500">{tech.email}</p>
                </div>
                <div className="bg-blue-100 text-blue-700 p-2 rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1 text-green-500" /> Completados
                  </span>
                  <span className="text-2xl font-bold text-gray-900">{tech.completed}</span>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center">
                    <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Efectividad
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0}%
                  </span>
                </div>

                <div className="flex flex-col pt-4 border-t border-gray-100 col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> En Proceso
                    </span>
                    <span className="text-sm font-semibold text-yellow-600">{tech.in_progress}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className="bg-yellow-400 h-1.5 rounded-full" 
                      style={{ width: `${tech.total > 0 ? (tech.in_progress / tech.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {techStats.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No hay técnicos registrados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
