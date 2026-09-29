import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './api/api';

// Componentes
import Login from './components/Login';
import Layout from './components/Layout';

// Páginas (Vistas)
import Dashboard from './pages/Dashboard';
import Audience from './pages/Audience';
import ManualBroadcast from './pages/ManualBroadcast';
import AiCampaign from './pages/AiCampaign';
import ImapSettings from './pages/ImapSettings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('admin_user')) || null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const handleLogout = useCallback(async () => {
    try { await api.post('/logout'); } catch (e) { console.error("Error al cerrar sesión", e); }
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(u, token) => {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(u);
      setIsAuthenticated(true);
    }} />
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard isAuthenticated={isAuthenticated} handleLogout={handleLogout} />} />
          <Route path="/audiencia" element={<Audience />} />
          <Route path="/difusion-manual" element={<ManualBroadcast />} />
          <Route path="/campana-ia" element={<AiCampaign />} />
          <Route path="/agente-imap" element={<ImapSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}