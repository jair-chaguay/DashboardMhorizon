import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './api/api';
import './index.css'
// Componentes
import Login from './components/Login';
import Layout from './components/Layout';
import { AUTH_EXPIRED_EVENT, clearSession, getStoredUser, getToken } from '../../mhorizon-crm-frontend-v2/src/utils/session';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignReport = lazy(() => import('./pages/CampaignReport'));
const Audience = lazy(() => import('./pages/Audience'));
const ManualBroadcast = lazy(() => import('./pages/ManualBroadcast'));
const AiCampaign = lazy(() => import('./pages/AiCampaign'));
const ImapSettings = lazy(() => import('./pages/ImapSettings'));

const PageLoader = () => <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [user, setUser] = useState(() => getStoredUser());

  const endSession = useCallback(() => {
    clearSession();
    setIsAuthenticated(false);
    setUser(null);
  }, []);


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
        <Suspense>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campanas" element={<Campaigns />} />
            <Route path="/campanas/:nombre" element={<CampaignReport />} />
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