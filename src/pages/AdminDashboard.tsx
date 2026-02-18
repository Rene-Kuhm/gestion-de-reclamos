import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Reclamo, UserProfile } from '../types';
import { CreateReclamoForm } from '../components/CreateReclamoForm';
 import { LogOut, Plus, RefreshCw, UserCog, ClipboardList, Clock, CheckCircle, Activity, Search, Download, Users, Wifi, Tv, Phone, Zap, Trash2, Edit, Upload, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { DashboardCharts } from '../components/DashboardCharts';
import Papa from 'papaparse';

export const AdminDashboard: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [tecnicos, setTecnicos] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReclamo, setEditingReclamo] = useState<Reclamo | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendiente' | 'en_proceso' | 'completado'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Stats calculation
  const stats = {
    total: reclamos.length,
    pendiente: reclamos.filter(r => r.estado === 'pendiente').length,
    en_proceso: reclamos.filter(r => r.estado === 'en_proceso').length,
    completado: reclamos.filter(r => r.estado === 'completado').length,
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch reclamos
      const { data: reclamosData, error: reclamosError } = await supabase
        .from('reclamos')
        .select('*')
        .order('fecha_creacion', { ascending: false });
      
      if (reclamosError) throw reclamosError;
      setReclamos(reclamosData || []);

      // Fetch tecnicos
      const { data: tecnicosData, error: tecnicosError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('rol', 'tecnico');
      
      if (tecnicosError) throw tecnicosError;
      setTecnicos(tecnicosData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('reclamos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reclamos',
        },
        (payload) => {
          console.log('Change received!', payload);
          // Refresh data on any change
          fetchData();
          
          if (payload.eventType === 'INSERT') {
            const newReclamo = payload.new as Reclamo;
            toast('Nuevo reclamo', {
              icon: <Bell className="w-4 h-4" />,
              description: `${newReclamo.cliente_nombre} • ${newReclamo.tipo_servicio.replace('_', ' ')}`
            });
          } else if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as Reclamo).estado;
            const oldStatus = (payload.old as Reclamo).estado;
            if (newStatus !== oldStatus) {
               toast(`Cambio de estado: ${newStatus.replace('_', ' ')}`, {
                 icon: <Activity className="w-4 h-4" />
               });
            }
          } else if (payload.eventType === 'DELETE') {
             toast('Reclamo eliminado', {
               icon: <Trash2 className="w-4 h-4" />
             });
             setReclamos(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Admin subscription active!');
        }
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAssignTechnician = async (reclamoId: string, tecnicoId: string) => {
    try {
      const { error } = await supabase
        .from('reclamos')
        .update({ tecnico_asignado: tecnicoId || null }) // Allow unassigning
        .eq('id', reclamoId);

      if (error) throw error;
      
      // Update local state
      setReclamos(prev => prev.map(r => 
        r.id === reclamoId ? { ...r, tecnico_asignado: tecnicoId || undefined } : r
      ));
      toast.success('Técnico asignado correctamente');
    } catch (error) {
      console.error('Error assigning technician:', error);
      toast.error('Error al asignar técnico');
    }
  };

  const handleEditReclamo = (reclamo: Reclamo) => {
    setEditingReclamo(reclamo);
    setShowCreateForm(true);
  };

  const handleDeleteReclamo = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este reclamo? Esta acción no se puede deshacer.')) return;

    try {
      const { data, error } = await supabase.from('reclamos').delete().eq('id', id).select('id');
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No se pudo eliminar (permiso o reclamo inexistente)');
        return;
      }
      
      setReclamos(prev => prev.filter(r => r.id !== id));
      toast.success('Reclamo eliminado correctamente');
    } catch (error: any) {
      console.error('Error deleting reclamo:', error);
      toast.error('Error al eliminar reclamo');
    }
  };

  const handleExportCSV = () => {
    if (reclamos.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = ['ID', 'Cliente', 'Dirección', 'Servicio', 'Estado', 'Técnico', 'Fecha Creación', 'Descripción'];
    const csvContent = [
      headers.join(','),
      ...reclamos.map(r => {
        const tecnico = tecnicos.find(t => t.id === r.tecnico_asignado)?.nombre || 'Sin asignar';
        return [
          r.id,
          `"${r.cliente_nombre}"`,
          `"${r.direccion}"`,
          r.tipo_servicio,
          r.estado,
          `"${tecnico}"`,
          format(new Date(r.fecha_creacion), 'yyyy-MM-dd HH:mm'),
          `"${r.descripcion.replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reclamos_cospec_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte descargado correctamente');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const clients = results.data.map((row: any) => ({
          nombre: row.nombre || row.Nombre || row.CLIENTE,
          direccion: row.direccion || row.Direccion || row.DOMICILIO,
          telefono: row.telefono || row.Telefono || row.CELULAR || '',
          tipo_servicio: row.servicio || row.Servicio || row.SERVICIO || 'fibra_optica',
          numero_cliente: row.numero || row.Numero || row.ID || ''
        })).filter(c => c.nombre && c.direccion); // Filter valid rows

        if (clients.length === 0) {
          toast.error('No se encontraron clientes válidos en el archivo');
          return;
        }

        try {
          const { error } = await supabase.from('clientes').upsert(
            clients, 
            { onConflict: 'nombre' } // Update if name exists (simple deduplication)
          );

          if (error) throw error;
          toast.success(`${clients.length} clientes importados correctamente`);
        } catch (error: any) {
          console.error('Import error:', error);
          toast.error('Error al importar clientes: ' + error.message);
        }
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        toast.error('Error al leer el archivo CSV: ' + error.message);
      }
    });
  };

  const filteredReclamos = reclamos.filter(r => {
    const matchesStatus = filterStatus === 'all' ? true : r.estado === filterStatus;
    const matchesSearch = searchTerm === '' || 
      r.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'fibra_optica': return <Wifi className="w-4 h-4 mr-1" />;
      case 'adsl': return <Zap className="w-4 h-4 mr-1" />;
      case 'tv': return <Tv className="w-4 h-4 mr-1" />;
      case 'telefono': return <Phone className="w-4 h-4 mr-1" />;
      default: return <Activity className="w-4 h-4 mr-1" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-blue-600 p-2 rounded-lg mr-3 shadow-sm">
              <UserCog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Cospec Ltd</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Panel de Administrador</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-green-600 transition-colors"
              title="Importar Clientes (CSV)"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Mi Perfil"
            >
              <UserCog className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/admin/tecnicos')}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Gestión de Técnicos"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={handleExportCSV}
              className="p-2 text-gray-500 hover:text-green-600 transition-colors"
              title="Exportar CSV"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={fetchData}  
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={signOut} 
              className="flex items-center text-red-600 hover:text-red-800 font-medium"
            >
              <LogOut className="w-5 h-5 mr-1" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Reclamos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendiente}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">En Proceso</p>
              <p className="text-2xl font-bold text-gray-900">{stats.en_proceso}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Completados</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completado}</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <DashboardCharts reclamos={reclamos} />

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700">Gestión de Reclamos</h2>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center shadow-sm"
            >
              <Plus className="w-5 h-5 mr-2" /> Nuevo Reclamo
            </button>
          )}
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <CreateReclamoForm 
            initialData={editingReclamo}
            onSuccess={() => {
              setShowCreateForm(false);
              setEditingReclamo(null);
              fetchData();
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingReclamo(null);
            }}
          />
        )}

        {/* Search Bar */}
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Buscar por cliente, dirección o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus('pendiente')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'pendiente' 
                ? 'bg-red-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilterStatus('en_proceso')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'en_proceso' 
                ? 'bg-yellow-500 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => setFilterStatus('completado')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterStatus === 'completado' 
                ? 'bg-green-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Completados
          </button>
        </div>

        {/* Reclamos List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Problema</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Técnico Asignado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReclamos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No hay reclamos registrados con este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredReclamos.map((reclamo) => (
                    <tr key={reclamo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{reclamo.cliente_nombre}</div>
                        <div className="text-sm text-gray-500">{reclamo.direccion}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex items-center text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                          {getServiceIcon(reclamo.tipo_servicio)}
                          {reclamo.tipo_servicio.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={reclamo.descripcion}>
                          {reclamo.descripcion}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${reclamo.estado === 'completado' ? 'bg-green-100 text-green-800' : 
                            reclamo.estado === 'en_proceso' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'}`}>
                          {reclamo.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          value={reclamo.tecnico_asignado || ''}
                          onChange={(e) => handleAssignTechnician(reclamo.id, e.target.value)}
                        >
                          <option value="">Sin asignar</option>
                          {tecnicos.map(tech => (
                            <option key={tech.id} value={tech.id}>
                              {tech.nombre} ({tech.email})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(reclamo.fecha_creacion), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditReclamo(reclamo)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1 rounded"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReclamo(reclamo.id)}
                            className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
