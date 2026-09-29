import { useState } from 'react';
import {  PlayCircle, AlertCircle } from 'lucide-react';
import api from '../api/api';

export default function AiCampaign() {
  const [isLaunching, setIsLaunching] = useState(false);
  const [status, setStatus] = useState(null);

  const handleLaunch = async () => {
    setIsLaunching(true);
    setStatus(null);
    try {
      await api.post('/campaigns/ai/launch');
      setStatus({ 
        type: 'success', 
        title: 'Campaña Iniciada', 
        text: 'El motor de Inteligencia Artificial ha comenzado a procesar los prospectos. Puedes revisar los resultados en el Dashboard.' 
      });
    } catch (error) {
      setStatus({ 
        type: 'error', 
        title: 'Error de conexión', 
        text: 'No se pudo comunicar con el servidor de Python para iniciar la campaña.' 
      });
      console.log(error)
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        Campaña IA Autónoma
      </h2>

      <div className="max-w-3xl bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-start gap-6">
          
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Motor de Prospección Inteligente</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Al ejecutar esta acción, el sistema evaluará automáticamente en qué fase del embudo se encuentra cada prospecto. 
              La IA redactará correos hiperpersonalizados basados en el historial y las reglas de la semana actual.
            </p>
            
            <button 
              onClick={handleLaunch}
              disabled={isLaunching}
              className="bg-orange-500 hover:bg-[#171E27] duration-300 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLaunching ? 'Conectando con IA...' : <><PlayCircle size={20} /> Ejecutar Lote de Hoy</>}
            </button>
          </div>
        </div>

        {status && (
          <div className={`mt-8 p-4 rounded-lg border flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <AlertCircle className="mt-0.5" size={18} />
            <div>
              <h4 className="font-bold text-sm">{status.title}</h4>
              <p className="text-sm mt-1">{status.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}