import { useState, useEffect } from 'react';
import { Power, Activity } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';

export default function ImapSettings() {
  const [activo, setActivo] = useState(null); // null mientras se consulta el estado
  const [cargando, setCargando] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/imap/status')
      .then(res => setActivo(!!res.data?.activo))
      .catch(err => {
        console.error(err);
        setActivo(false);
        setMessage({ type: 'error', text: 'No se pudo consultar el estado del agente IMAP.' });
      });
  }, []);

  const handleToggle = async () => {
    setCargando(true);
    setMessage(null);
    try {
      const res = await api.post('/imap/toggle');
      setActivo(!!res.data?.activo);
    } catch (err) {
      console.error('Error al cambiar estado IMAP', err);
      setMessage({ type: 'error', text: 'No se pudo cambiar el estado del agente IMAP. Intenta de nuevo.' });
    } finally {
      setCargando(false);
    }
  };

  const verificando = activo === null;

  return (
    <div className="p-8">
      <PageHeader>Agente IMAP (Respuestas Automáticas)</PageHeader>

      <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-6 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Estado del Servidor de Escucha</h3>
            <p className="text-gray-500 text-sm mt-1">Supervisa la bandeja de entrada 24/7 para detectar interacciones.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`flex h-3 w-3 rounded-full ${verificando ? 'bg-gray-300' : activo ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="font-bold text-sm text-gray-700">{verificando ? 'VERIFICANDO...' : activo ? 'EN LÍNEA' : 'APAGADO'}</span>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6">
          <ul className="text-sm text-gray-600 space-y-3">
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-200"/> Clasifica intenciones (Positivo, Negativo, Duda).</li>
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-200"/> Responde dudas basándose en la memoria del hilo.</li>
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-200"/> Alerta al equipo corporativo ante prospectos calientes.</li>
          </ul>
        </div>

        <StatusMessage message={message} className="mb-6 p-3 rounded-md" />

        <button
          onClick={handleToggle}
          disabled={cargando || verificando}
          className={`w-full py-4 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-blue-200 text-white hover:bg-orange-500'}`}
        >
          <Power size={20} />
          {cargando ? 'Cambiando estado...' : activo ? 'DETENER AGENTE IMAP' : 'INICIAR AGENTE IMAP'}
        </button>
      </div>
    </div>
  );
}
