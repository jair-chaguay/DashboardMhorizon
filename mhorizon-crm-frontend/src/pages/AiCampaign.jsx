import { useState } from 'react';
import { PlayCircle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';

export default function AiCampaign() {
  const [isLaunching, setIsLaunching] = useState(false);
  const [status, setStatus] = useState(null);

  const handleLaunch = async () => {
    setIsLaunching(true);
    setStatus(null);
    try {
      await api.post('/campaign/ia');
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
    <div>
      <PageHeader description="Deja que la IA prepare los correos del día según la fase de cada prospecto.">Campaña IA</PageHeader>

      <div className="max-w-3xl space-y-4">
        <section className="bg-white border border-slate-200/80 rounded-2xl p-6">
          <h3 className="text-[15px] font-semibold text-slate-900">Motor de prospección inteligente</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 max-w-xl">
            Al ejecutar esta acción, el sistema evaluará automáticamente en qué fase del embudo se encuentra cada prospecto.
            La IA redactará correos hiperpersonalizados basados en el historial y las reglas de la semana actual.
          </p>

          <button
            onClick={handleLaunch}
            disabled={isLaunching}
            className="mt-5 h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLaunching ? <><Loader2 size={18} className="animate-spin" /> Conectando con IA...</> : <><PlayCircle size={19} /> Ejecutar lote de hoy</>}
          </button>
        </section>

        {status && (
          <div role="status" className={`p-4 rounded-lg border flex items-start gap-3 animate-fade-up ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {status.type === 'success' ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <AlertCircle className="mt-0.5 shrink-0" size={18} />}
            <div>
              <h4 className="font-semibold text-sm">{status.title}</h4>
              <p className="text-sm mt-1">{status.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
