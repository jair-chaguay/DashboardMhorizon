import { useState } from 'react';
import api from '../api/api';

export default function ManualBroadcast() {
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fase, setFase] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);

  const handleDespachar = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setMessage(null);

    try {
      await api.post('/campaign/manual', {
        asunto,
        cuerpo,
        fase
      });
      setMessage({ type: 'success', text: 'Campaña encolada. El servidor Python comenzará el envío en breve.' });
      setAsunto('');
      setCuerpo('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al encolar la campaña. ' });
      console.log(error)
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        Difusión Manual (Mismo correo)
      </h2>

      <form onSubmit={handleDespachar} className="max-w-3xl space-y-6">
        
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Público Objetivo (Fase del CRM)
          </label>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                type="button"
                key={num}
                onClick={() => setFase(num)}
                className={`cursor-pointer duration-300 py-2 px-4 text-sm font-semibold rounded-md border transition-all ${
                  fase === num 
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Fase {num}
              </button>
            ))}
          </div>
        </div>

        {/* Asunto */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Asunto del correo</label>
          <input 
            type="text" 
            required
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="Ej. Estrategia Tributaria 2026..."
          />
        </div>

        {/* Cuerpo */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Cuerpo del correo (HTML permitido)</label>
          <textarea 
            required
            rows={8}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
            placeholder="Estimados señores:<br><br>Adjuntamos la propuesta..."
          />
        </div>

        {message && (
          <div className={`p-4 rounded-lg font-medium text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Botón */}
        <button 
          type="submit" 
          disabled={isSending}
          className="bg-orange-500 hover:bg-[#171E27] duration-300 text-white font-bold py-3 px-6 rounded-md shadow-lg flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSending ? 'Encolando...' : <> Enviar a la Fase {fase}</>}
        </button>
      </form>
    </div>
  );
}