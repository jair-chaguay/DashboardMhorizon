import { useEffect, useMemo, useState } from 'react';
import { Feather, Loader2, Newspaper, Search, X } from 'lucide-react';
import api from '../api/api';
import Modal from './Modal';
import { ui } from '../utils/theme';
import { formatFechaHora, parseDate } from '../utils/dates';

// Lista de difusiones ya enviadas para tomar su diseño. Solo se elige aquí; quien la abre carga el diseño
export default function ReuseCampaignModal({ isOpen, onClose, onElegir, cargando }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    let vivo = true;
    api.get('/campaign/reutilizables')
      .then(({ data }) => { if (vivo) { setLista(Array.isArray(data) ? data : []); setError(''); } })
      .catch(() => { if (vivo) { setLista([]); setError('No se pudo cargar la lista de campañas enviadas.'); } });
    return () => { vivo = false; };
  }, [isOpen]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista || []).filter(c => !q || `${c.alias || ''} ${c.nombre}`.toLowerCase().includes(q));
  }, [lista, busqueda]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Reutilizar una campaña</h3>
          <p className="text-[13px] text-slate-500 mt-0.5">Se copia solo el diseño. El asunto, el público y el remitente los eliges de nuevo.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X size={17} /></button>
      </div>

      <div className="px-5 pt-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar campaña" aria-label="Buscar campaña" className={`${ui.input} w-full pl-9`} />
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        {lista === null && <p className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Cargando campañas...</p>}
        {error && <p className="py-2 text-[13px] font-medium text-rose-600">{error}</p>}
        {lista !== null && !error && visibles.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">{lista.length === 0 ? 'Aún no has enviado difusiones manuales.' : 'Ninguna campaña coincide con la búsqueda.'}</p>
        )}
        <ul className="space-y-1.5">
          {visibles.map(c => {
            const Icon = c.formato === 'campana' ? Newspaper : Feather;
            const fecha = parseDate(c.fecha);
            return (
              <li key={c.nombre}>
                <button type="button" disabled={!c.reutilizable || !!cargando} onClick={() => onElegir(c)}
                  className="flex w-full items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-brand-600 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:bg-transparent cursor-pointer">
                  <span className="mt-0.5 h-8 w-8 shrink-0 grid place-items-center rounded-md bg-slate-100 text-slate-500"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{c.alias || c.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">Asunto: {c.nombre}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {c.formato === 'campana' ? 'Campaña con diseño' : 'Correo personal'}{fecha ? ` · ${formatFechaHora(fecha)}` : ''}
                      {!c.reutilizable && ' · se envió antes de guardar los diseños'}
                    </span>
                  </span>
                  {cargando === c.nombre && <Loader2 size={16} className="mt-2 shrink-0 animate-spin text-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
