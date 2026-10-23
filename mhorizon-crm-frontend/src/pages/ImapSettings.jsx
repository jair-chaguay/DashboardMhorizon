import { useState, useEffect } from 'react';
import { Power, Loader2 } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';

export default function ImapSettings() {
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api.get('/imap/status')
      .then(res => setActivo(res.data.activo))
      .catch(err => console.error(err));
  }, []);

  const handleToggle = async () => {
    setCargando(true);
    try {
      const res = await api.post('/imap/toggle');
      setActivo(res.data.activo);
    } catch (err) {
      console.error('Error al cambiar estado IMAP', err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <PageHeader description="Enciende o apaga la escucha de respuestas automáticas en la bandeja de entrada.">Agente IMAP</PageHeader>

      <section className="max-w-xl bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-slate-900">Estado del servidor de escucha</h3>
          <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold transition-colors ${activo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <span className={`h-2 w-2 rounded-full ${activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />{activo ? 'En línea' : 'Apagado'}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Supervisa la bandeja de entrada 24/7 para detectar interacciones: clasifica intenciones (positivo, negativo, duda), responde dudas basándose en la memoria del hilo y alerta al equipo corporativo ante prospectos calientes.
        </p>

        <button
          onClick={handleToggle}
          disabled={cargando}
          className={`mt-5 w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
        >
          {cargando ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
          {cargando ? 'Cambiando estado...' : activo ? 'Detener agente IMAP' : 'Iniciar agente IMAP'}
        </button>
      </section>
    </div>
  );
}
