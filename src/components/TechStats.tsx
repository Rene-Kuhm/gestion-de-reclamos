import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfWeek, startOfMonth, startOfYear, eachDayOfInterval, eachMonthOfInterval, endOfWeek, endOfMonth, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

interface StatData {
  name: string;
  completados: number;
}

export const TechStats: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [stats, setStats] = useState<StatData[]>([]);
  const [summary, setSummary] = useState({ total: 0, average: 0 });

  useEffect(() => {
    if (profile) fetchStats();
  }, [profile, period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (period === 'week') {
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
      } else if (period === 'month') {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
      } else {
        startDate = startOfYear(now);
        endDate = endOfYear(now);
      }

      // Fetch ALL completed jobs for this user in range
      // Note: In real app, consider pagination or aggregation on DB side for large datasets
      const { data, error } = await supabase
        .from('reclamos')
        .select('fecha_creacion')
        .eq('tecnico_asignado', profile?.id)
        .eq('estado', 'completado')
        .gte('fecha_creacion', startDate.toISOString())
        .lte('fecha_creacion', endDate.toISOString());

      if (error) throw error;

      const jobs = data || [];
      let chartData: StatData[] = [];
      
      if (period === 'week') {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        chartData = days.map(day => ({
          name: format(day, 'EEE', { locale: es }),
          completados: jobs.filter(j => 
            new Date(j.fecha_creacion).toDateString() === day.toDateString()
          ).length
        }));
      } else if (period === 'month') {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        chartData = days.map(day => ({
          name: format(day, 'd'),
          completados: jobs.filter(j => 
            new Date(j.fecha_creacion).toDateString() === day.toDateString()
          ).length
        }));
      } else {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        chartData = months.map(month => ({
          name: format(month, 'MMM', { locale: es }),
          completados: jobs.filter(j => 
            new Date(j.fecha_creacion).getMonth() === month.getMonth()
          ).length
        }));
      }

      setStats(chartData);
      const total = jobs.length;
      const avg = total > 0 ? (total / chartData.length).toFixed(1) : '0';
      
      setSummary({ 
        total, 
        average: parseFloat(avg) 
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="mr-3 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Mis Métricas</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        
        {/* Period Selector */}
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex">
            {(['week', 'month', 'year'] as const).map((p) => (
                <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                        period === p 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                    {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                </button>
            ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl text-white shadow-lg shadow-blue-200">
                <div className="flex items-center space-x-2 mb-2 opacity-90">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Total</span>
                </div>
                <p className="text-3xl font-bold tracking-tight">{summary.total}</p>
                <p className="text-xs text-blue-100 mt-1 font-medium">Reclamos resueltos</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-2 mb-2 text-gray-500">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Promedio</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{summary.average}</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">Por {period === 'year' ? 'mes' : 'día'}</p>
            </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Rendimiento
            </h3>
            
            {loading ? (
                <div className="h-64 flex items-center justify-center text-gray-400">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : (
                <div className="h-64 w-full -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#9ca3af', fontSize: 11}}
                                dy={10}
                                interval={period === 'month' ? 4 : 0} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f9fafb'}}
                                contentStyle={{
                                    borderRadius: '12px', 
                                    border: 'none', 
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    padding: '8px 12px'
                                }}
                                itemStyle={{color: '#1f2937', fontWeight: 600}}
                                labelStyle={{color: '#9ca3af', marginBottom: '4px', fontSize: '12px'}}
                            />
                            <Bar 
                                dataKey="completados" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]} 
                                barSize={period === 'month' ? 6 : 20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

// Helper Icon
const CheckCircleIcon = ({className}: {className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
);
