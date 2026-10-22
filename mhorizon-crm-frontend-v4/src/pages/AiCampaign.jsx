import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import { Panel, BarRow } from '../components/analytics';
import { useLeads } from '../hooks/useLeads';
import { COLORS } from '../utils/theme';
import { confirmAction } from '../utils/notify';
import { formatHora } from '../utils/dates';

const FASES = [1, 2, 3, 4, 5];
const ULTIMA_KEY = 'mhorizon:ultima-ejecucion-ia';

// La última ejecución solo se recuerda en este navegador; si el almacenamiento falla, se ignora
function leerUltima() {
  try {
    const raw = window.localStorage.getItem(ULTIMA_KEY);
    const date = raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}
function guardarUltima(date) {
  try { window.localStorage.setItem(ULTIMA_KEY, date.toISOString()); } catch { /* sin almacenamiento */ }
}

const esHoy = (date) => date.toDateString() === new Date().toDateString();
const describir = (date) => `${esHoy(date) ? 'hoy' : date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })} a las ${formatHora(date)}`;

export default function AiCampaign() {
  const [isLaunching, setIsLaunching] = useState(false);
  const [status, setStatus] = useState(null);
  const [ultima, setUltima] = useState(leerUltima);
  const { leads, loading } = useLeads();

  const porFase = useMemo(() => {
    const counts = Object.fromEntries(FASES.map(f => [f, 0]));
    leads.forEach(l => { counts[Math.min(l.fase || 1, 5)] += 1; });
    return counts;
  }, [leads]);
  const maxFase = Math.max(...Object.values(porFase), 0);

  const handleLaunch = async () => {
    const yaHoy = ultima && esHoy(ultima);
    const confirmed = await confirmAction({
      title: '¿Ejecutar el lote de hoy?',
      text: yaHoy
        ? `Ya lo ejecutaste hoy a las ${formatHora(ultima)} desde este navegador. Si lo ejecutas otra vez, la IA volverá a escribir a los prospectos.`
        : 'La IA redactará y enviará correos a los prospectos según su fase.',
      confirmText: 'Sí, ejecutar',
    });
    if (!confirmed) return;

    setIsLaunching(true);
    setStatus(null);
    try {
      await api.post('/campaign/ia');
      const ahora = new Date();
      guardarUltima(ahora);
      setUltima(ahora);
      setStatus({
        type: 'success',
        title: 'Campaña iniciada',
        text: 'El motor de Inteligencia Artificial ha comenzado a procesar los prospectos. Puedes revisar los resultados en el Panel analítico.'
      });
    } catch (error) {
      setStatus({
        type: 'error',
        title: 'Error de conexión',
        text: 'No se pudo comunicar con el servidor de Python para iniciar la campaña.'
      });
      console.error(error);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div>
      <PageHeader description="Deja que la IA prepare los correos del día según la fase de cada prospecto.">Campaña IA</PageHeader>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-4">
          <section className="bg-white border border-slate-200/80 rounded-2xl p-6">
            <h3 className="text-[15px] font-semibold text-slate-900">Lote de hoy</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 max-w-xl">
              Al ejecutarlo, el sistema evalúa en qué fase del embudo está cada prospecto y la IA redacta los correos según su historial y las reglas de la semana actual.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLaunching ? <><Loader2 size={18} className="animate-spin" /> Conectando con IA...</> : <><PlayCircle size={19} /> Ejecutar lote de hoy</>}
              </button>
              <p className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                <Clock size={13} />
                {ultima ? `Última ejecución desde este navegador: ${describir(ultima)}` : 'Aún no la has ejecutado desde este navegador'}
              </p>
            </div>
          </section>

          {status && (
            <div role="status" className={`p-4 rounded-lg border flex items-start gap-3 animate-fade-up ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {status.type === 'success' ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <AlertCircle className="mt-0.5 shrink-0" size={18} />}
              <div>
                <h4 className="font-semibold text-sm">{status.title}</h4>
                <p className="text-sm mt-1">{status.text}</p>
                {status.type === 'success' && <Link to="/" className="inline-block mt-2 text-sm font-semibold underline underline-offset-2">Ir al Panel analítico</Link>}
              </div>
            </div>
          )}
        </div>

        <Panel title="Prospectos a evaluar" subtitle={loading ? 'Cargando...' : `${leads.length} en tu base, por fase`}>
          {loading ? (
            <p className="text-sm text-slate-500 py-6 text-center">Cargando prospectos...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aún no hay prospectos en la base.</p>
          ) : (
            <div className="space-y-3.5">
              {FASES.map(f => <BarRow key={f} label={`Fase ${f}`} value={porFase[f]} max={maxFase} color={COLORS.navy} />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
