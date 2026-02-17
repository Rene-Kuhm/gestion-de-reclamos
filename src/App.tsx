import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { TechDashboard } from './pages/TechDashboard';
import { JobDetails } from './pages/JobDetails';
import { TechMap } from './pages/TechMap';
import { TechStats } from './components/TechStats';
import { TechManagement } from './pages/TechManagement';
import { UserProfile } from './pages/UserProfile';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/ProtectedRoute';

const HomeRedirect: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;

  if (profile?.rol === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (profile?.rol === 'tecnico') {
    return <Navigate to="/tecnico" replace />;
  }
  
  return <Navigate to="/login" replace />;
};

import { InstallPrompt } from './components/InstallPrompt';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Router>
        <InstallPrompt />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeRedirect />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tecnicos" element={<TechManagement />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<UserProfile />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['tecnico']} />}>
            <Route path="/tecnico" element={<TechDashboard />} />
            <Route path="/tecnico/mapa" element={<TechMap />} />
            <Route path="/tecnico/estadisticas" element={<TechStats />} />
            <Route path="/tecnico/trabajo/:id" element={<JobDetails />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
