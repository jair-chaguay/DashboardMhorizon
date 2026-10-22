import { useState, useEffect } from 'react';
import { Power, Loader2, RefreshCw } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';
import { formatHora } from '../utils/dates';

// Avisa al menú lateral para que el punto de estado se mantenga al día
const publicarEstado = (activo) => window.dispatchEvent(new CustomEvent('mhorizon:imap-status', { detail: activo }));

export default function ImapSettings() {
  const [activo, setActivo] = useState(null); // null mientras se consulta el estado
  const [cargando, setCargando] = useState(false);
  const [message, setMessage] = useState(null);
  const [verificadoA, setVerificadoA] = useState(null);

  const consultar = () => {
    setActivo(null);
    api.get('/imap/status')
      .then(res => { setActivo(!!res.data?.activo); publicarEstado(!!res.data?.activo); setMessage(null); })
      .catch(err => {
        console.error(err);
        setActivo(false);
        setMessage({ type: 'error', text: 'No se pudo consultar el estado del agente IMAP.' });
      })
      .finally(() => setVerificadoA(new Date()));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    consultar();
  }, []);

  const handleToggle = async () => {
    setCargando(true);
    setMessage(null);
    try {
      const res = await api.post('/imap/toggle');
      setActivo(!!res.data?.activo);
      publicarEstado(!!res.data?.activo);
      setVerificadoA(new Date());
    } catch (err) {
      console.error('Error al cambiar estado IMAP', err);
      setMessage({ type: 'error', text: 'No se pudo cambiar el estado del agente IMAP. Intenta de nuevo.' });
    } finally {
      setCargando(false);
    }
  };

  const verificando = activo === null;
  const estado = verificando
    ? { texto: 'Verificando...', punto: 'bg-slate-300', chip: 'bg-slate-100 text-slate-600' }
    : activo
      ? { texto: 'En línea', punto: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700' }
      : { texto: 'Apagado', punto: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700' };

  return (
    <div>
      <PageHeader description="Enciende o apaga la escucha de respuestas automáticas en la bandeja de entrada.">Agente IMAP</PageHeader>

      <section className="max-w-xl bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold transition-colors ${estado.chip}`}>
              <span className={`h-2 w-2 rounded-full ${estado.punto}`} />{estado.texto}
            </span>
          </div>
          <button type="button" onClick={consultar} disabled={verificando || cargando} title="Volver a consultar el estado" aria-label="Volver a consultar el estado"
            className="h-9 w-9 grid place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            <RefreshCw size={15} className={verificando ? 'animate-spin' : ''} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Mientras está en línea, supervisa la bandeja de entrada, clasifica las respuestas (positivo, negativo o duda), contesta dudas con la memoria del hilo y alerta al equipo ante prospectos calientes.
        </p>
        <p className="mt-2 text-xs text-slate-500 min-h-4">{verificadoA && `Verificado a las ${formatHora(verificadoA)}`}</p>

        <StatusMessage message={message} className="mt-4 p-3 rounded-lg" />

        <button
          onClick={handleToggle}
          disabled={cargando || verificando}
          className={`mt-5 w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
        >
          {cargando ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
          {cargando ? 'Cambiando estado...' : activo ? 'Detener agente IMAP' : 'Iniciar agente IMAP'}
        </button>
      </section>
    </div>
  );
}
