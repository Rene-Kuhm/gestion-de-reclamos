import React from 'react';
import { Reclamo } from '../types';
import { MapPin, User, ArrowRight, Edit, Wifi, Tv, Phone, Zap, Activity, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface JobCardProps {
  trabajo: Reclamo;
  isAssigned: boolean;
  onEdit?: (trabajo: Reclamo) => void;
  onSelfAssign?: (id: string) => void;
}

const getServiceIcon = (type: string) => {
  switch (type) {
    case 'fibra_optica': return <Wifi className="w-4 h-4 text-blue-600" />;
    case 'adsl': return <Zap className="w-4 h-4 text-yellow-600" />;
    case 'tv': return <Tv className="w-4 h-4 text-purple-600" />;
    case 'telefono': return <Phone className="w-4 h-4 text-green-600" />;
    default: return <Activity className="w-4 h-4 text-gray-600" />;
  }
};

const getServiceColor = (type: string) => {
  switch (type) {
    case 'fibra_optica': return 'bg-blue-100 text-blue-800';
    case 'adsl': return 'bg-yellow-100 text-yellow-800';
    case 'tv': return 'bg-purple-100 text-purple-800';
    case 'telefono': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completado': return 'bg-green-100 text-green-800 border-green-200';
    case 'en_proceso': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-red-100 text-red-800 border-red-200';
  }
};

export const JobCard: React.FC<JobCardProps> = ({ trabajo, isAssigned, onEdit, onSelfAssign }) => {
  const navigate = useNavigate();

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md relative ${
        !isAssigned ? 'border-l-4 border-l-blue-500' : ''
      }`}
    >
      <div 
        onClick={() => isAssigned && navigate(`/tecnico/trabajo/${trabajo.id}`)}
        className={`p-5 ${isAssigned ? 'cursor-pointer' : ''}`}
      >
        {/* Header: Service Type & Status */}
        <div className="flex justify-between items-start mb-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getServiceColor(trabajo.tipo_servicio)}`}>
            <span className="mr-1.5 bg-white rounded-full p-0.5 shadow-sm">
              {getServiceIcon(trabajo.tipo_servicio)}
            </span>
            <span className="capitalize">{trabajo.tipo_servicio.replace('_', ' ')}</span>
          </span>
          
          {isAssigned ? (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(trabajo.estado)} capitalize`}>
              {trabajo.estado.replace('_', ' ')}
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              Disponible
            </span>
          )}
        </div>
        
        {/* Main Content: Client & Address */}
        <div className="space-y-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight flex items-center">
              {trabajo.cliente_nombre}
            </h3>
            <div className="flex items-start text-gray-500 text-sm mt-1">
              <MapPin className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0 text-gray-400" />
              <span className="line-clamp-2">{trabajo.direccion}</span>
            </div>
          </div>
        </div>

        {/* Footer: Date & Action */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
          <div className="text-xs text-gray-400 font-medium">
            {format(new Date(trabajo.fecha_creacion), 'dd MMM, HH:mm')}
          </div>
          
          {isAssigned ? (
            <div className="flex items-center text-blue-600 text-sm font-medium group">
              Ver Detalles 
              <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
            </div>
          ) : (
             <button
              onClick={(e) => {
                e.stopPropagation();
                onSelfAssign && onSelfAssign(trabajo.id);
              }}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm active:transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Tomar Trabajo
            </button>
          )}
        </div>
      </div>

      {/* Edit Button (Only for assigned) */}
      {isAssigned && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(trabajo);
          }}
          className="absolute top-4 right-4 p-2 bg-gray-50/80 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-full transition-colors backdrop-blur-sm border border-gray-100"
          title="Editar datos"
        >
          <Edit className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
