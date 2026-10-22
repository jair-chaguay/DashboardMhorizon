import { useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import Modal from './Modal';
import { downloadCsv } from '../utils/csv';
import { toDayKey } from '../utils/dates';

// Ventana con listas de personas separadas en secciones.
// sections: [{ title, hint, rows: [{ email, sub, detail, inBase }] }]. Cada fila puede abrir la ficha del prospecto
// y, con onRemove, eliminar al prospecto de la base de datos (solo si sigue en ella)
export default function ListModal({ isOpen, onClose, title, subtitle, sections, filename, onOpenLead, onRemove, tabbed = false }) {
  const [tab, setTab] = useState(() => Math.max(sections.findIndex(sec => sec.rows.length > 0), 0));
  const useTabs = tabbed && sections.length > 1;
  const shown = useTabs ? [sections[Math.min(tab, sections.length - 1)]] : sections;
  const total = sections.reduce((acc, s) => acc + s.rows.length, 0);
  const exportAll = () => downloadCsv(`${filename}-${toDayKey(new Date())}.csv`, [
    ['Grupo', 'Correo', 'Detalle'],
    ...sections.flatMap(s => s.rows.map(r => [s.title, r.email, r.detail || ''])),
  ]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title} <span className="text-slate-500 text-sm font-normal">({total})</span></h3>
          {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {total > 0 && (
            <button onClick={exportAll} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Download size={14} /> Exportar CSV
            </button>
          )}
          <button onClick={onClose} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
        </div>
      </div>
      {useTabs && (
        <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }} role="tablist">
          {sections.map((section, i) => {
            const active = tab === i;
            return (
              <button key={section.title} type="button" role="tab" aria-selected={active} onClick={() => setTab(i)}
                className={`relative px-4 py-3 text-sm cursor-pointer transition-colors ${active ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                {section.title} <span className={`ml-1 tabular-nums text-xs ${active ? 'text-slate-700' : 'text-slate-400'}`}>{section.rows.length}</span>
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
      <div className="overflow-auto px-6 pb-4">
        {shown.map(section => (
          <section key={section.title} className="pt-4">
            {useTabs ? (section.hint && <p className="text-xs text-slate-500">{section.hint}</p>) : (
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-[13px] font-semibold text-slate-800">{section.title} <span className="font-normal text-slate-500 tabular-nums">({section.rows.length})</span></h4>
                {section.hint && <p className="text-xs text-slate-500 text-right">{section.hint}</p>}
              </div>
            )}
            {section.rows.length === 0 ? (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">Nadie en este grupo.</p>
            ) : (
              <ul className="mt-1 divide-y divide-slate-100">
                {section.rows.map(r => (
                  <li key={r.email} className="py-2.5 flex items-center gap-3">
                    <button type="button" onClick={() => onOpenLead?.(r.email)} disabled={!onOpenLead || r.inBase === false}
                      className={`min-w-0 flex-1 flex items-center justify-between gap-3 text-left ${onOpenLead && r.inBase !== false ? 'cursor-pointer group' : 'cursor-default'}`}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">{r.email}</span>
                        {r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}
                      </span>
                      {r.detail && <span className="shrink-0 text-xs text-slate-500 text-right">{r.detail}</span>}
                    </button>
                    {onRemove && (r.inBase === false
                      ? <span className="shrink-0 w-24 text-right text-xs text-slate-400">Ya eliminado</span>
                      : <button type="button" onClick={() => onRemove(r.email)} title="Eliminar este correo de la base de datos" aria-label={`Eliminar ${r.email} de la base de datos`}
                          className="shrink-0 h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer">
                          <Trash2 size={13} /> Eliminar
                        </button>)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}
