import { Download } from 'lucide-react';
import Modal from './Modal';
import { downloadCsv } from '../utils/csv';
import { toDayKey } from '../utils/dates';

function ctorBadge(opens, clicks) {
  const porcentaje = opens > 0 ? Math.min(Math.round((clicks / opens) * 100), 100) : 0;
  let colorClass = "bg-slate-100 text-slate-500";
  if (porcentaje >= 50) colorClass = "bg-emerald-100 text-emerald-700";
  else if (porcentaje > 0) colorClass = "bg-amber-100 text-amber-700";
  return { porcentaje, colorClass };
}

const exportLeads = (modalDetails) => downloadCsv(
  `contactos-${toDayKey(new Date())}.csv`,
  [['Correo', 'Nombre', 'Empresa', 'Aperturas', 'Clics', 'CTOR (%)', 'Fase'],
    ...modalDetails.leads.map(l => [l.email, l.nombre || '', l.empresa || '', l.displayOpens, l.displayClicks, ctorBadge(l.displayOpens, l.displayClicks).porcentaje, l.fase || 1])]
);

export default function DetailsModal({ modalDetails, onClose }) {
  return (
    <Modal isOpen={modalDetails.isOpen} onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">
          {modalDetails.title} <span className="text-slate-500 text-sm font-normal">({modalDetails.leads.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          {modalDetails.leads.length > 0 && (
            <button onClick={() => exportLeads(modalDetails)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Download size={14} /> Exportar CSV
            </button>
          )}
          <button onClick={onClose} aria-label="Cerrar" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold text-xl cursor-pointer">
            ×
          </button>
        </div>
      </div>
      <div className="overflow-auto px-6 pb-4">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-slate-500 text-xs">
              <th className="py-3 pr-2 font-semibold">Correo</th>
              <th className="py-3 px-2 font-semibold text-center">Aperturas</th>
              <th className="py-3 px-2 font-semibold text-center">Clics</th>
              <th className="py-3 px-2 font-semibold text-center">CTOR</th>
              <th className="py-3 pl-2 font-semibold hidden sm:table-cell">Fase</th>
            </tr>
          </thead>
          <tbody>
            {modalDetails.leads.map((lead) => {
              const { porcentaje, colorClass } = ctorBadge(lead.displayOpens, lead.displayClicks);
              return (
                <tr key={lead.email} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 pr-2">
                    <span className="block font-medium text-slate-900">{lead.email}</span>
                    {(lead.nombre || lead.empresa) && <span className="block text-xs text-slate-500">{[lead.nombre, lead.empresa].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-700">{lead.displayOpens}</td>
                  <td className="py-2.5 px-2 text-center tabular-nums text-slate-700">{lead.displayClicks}</td>
                  <td className="py-3 px-2 text-center"><span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${colorClass}`}>{porcentaje}%</span></td>
                  <td className="py-3 pl-2 text-slate-600 hidden sm:table-cell">Fase {lead.fase || 1}</td>
                </tr>
              );
            })}
            {modalDetails.leads.length === 0 && (
              <tr>
                <td colSpan="5" className="py-10 text-center text-slate-500">Nadie en esta lista todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
