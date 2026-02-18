import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Reclamo } from '../types';

interface DashboardChartsProps {
  reclamos: Reclamo[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ reclamos }) => {
  // 1. Prepare data for Status Distribution (Pie Chart)
  const statusData = [
    { name: 'Pendiente', value: reclamos.filter(r => r.estado === 'pendiente').length },
    { name: 'En Proceso', value: reclamos.filter(r => r.estado === 'en_proceso').length },
    { name: 'Completado', value: reclamos.filter(r => r.estado === 'completado').length },
  ];

  // 2. Prepare data for Service Type Distribution (Bar Chart)
  const serviceData = [
    { name: 'Fibra', cantidad: reclamos.filter(r => r.tipo_servicio === 'fibra_optica').length },
    { name: 'ADSL', cantidad: reclamos.filter(r => r.tipo_servicio === 'adsl').length },
    { name: 'TV', cantidad: reclamos.filter(r => r.tipo_servicio === 'tv').length },
    { name: 'Teléfono', cantidad: reclamos.filter(r => r.tipo_servicio === 'telefono').length },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Status Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Estado de Reclamos</h3>
        <div className="h-64 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Type Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Reclamos por Servicio</h3>
        <div className="h-64 w-full min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={serviceData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="cantidad" fill="#3B82F6" name="Cantidad" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
