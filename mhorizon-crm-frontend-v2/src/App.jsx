import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './api/api';
import { AUTH_EXPIRED_EVENT, clearSession, getStoredUser, getToken } from './utils/session';
// Componentes
import Login from './components/Login';
import Layout from './components/Layout';

// Páginas (Vistas), cargadas bajo demanda para que el login abra más rápido
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Audience = lazy(() => import('./pages/Audience'));
const ManualBroadcast = lazy(() => import('./pages/ManualBroadcast'));
const AiCampaign = lazy(() => import('./pages/AiCampaign'));
const ImapSettings = lazy(() => import('./pages/ImapSettings'));

const PageLoader = () => <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [user, setUser] = useState(() => getStoredUser());

  const endSession = useCallback(() => {
    clearSession();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  // El interceptor de api.js emite este evento cuando el backend responde 401
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, endSession);
  }, [endSession]);

  const handleLogout = useCallback(async () => {
    try { await api.post('/logout'); } catch (e) { console.error("Error al cerrar sesión", e); }
    endSession();
  }, [endSession]);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(u) => {
      setUser(u);
      setIsAuthenticated(true);
    }} />
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/audiencia" element={<Audience />} />
            <Route path="/difusion-manual" element={<ManualBroadcast />} />
            <Route path="/campana-ia" element={<AiCampaign />} />
            <Route path="/agente-imap" element={<ImapSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
