import { useState, useEffect } from 'react';
import { Power, Activity } from 'lucide-react';
import api from '../api/api';

export default function ImapSettings() {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get('/imap/status');
        setIsActive(response.data.is_active);
      } catch (error) {
        console.error("No se pudo obtener el estado del agente IMAP", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const toggleAgent = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/imap/toggle');
      setIsActive(response.data.is_active);
    } catch (error) {
      console.error("Error al cambiar el estado", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
         Agente IMAP (Respuestas Automáticas)
      </h2>

      <div className="max-w-2xl bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-6 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Estado del Servidor de Escucha</h3>
            <p className="text-gray-500 text-sm mt-1">Supervisa la bandeja de entrada 24/7 para detectar interacciones.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`flex h-3 w-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="font-bold text-sm text-gray-700">{isActive ? 'EN LÍNEA' : 'APAGADO'}</span>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6">
          <ul className="text-sm text-gray-600 space-y-3">
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Clasifica intenciones (Positivo, Negativo, Duda).</li>
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Responde dudas basándose en la memoria del hilo.</li>
            <li className="flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Alerta al equipo corporativo ante prospectos calientes.</li>
          </ul>
        </div>

        <button 
          onClick={toggleAgent}
          disabled={isLoading}
          className={`w-full py-4 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${isActive ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-[#171E27] text-white hover:bg-[#D46822]'}`}
        >
          <Power size={20} />
          {isLoading ? 'Cambiando estado...' : isActive ? 'DETENER AGENTE IMAP' : 'INICIAR AGENTE IMAP'}
        </button>
      </div>
    </div>
  );
}