import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Panel } from './analytics';
import ListModal from './ListModal';
import Tip from './Tip';
import api from '../api/api';
import { confirmAction, notifyError, notifySuccess } from '../utils/notify';
import { ui } from '../utils/theme';
import { formatFechaHora, parseDate } from '../utils/dates';

const pct = (part, total) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '0%');

// Filas de una lista: correo, nombre y empresa del prospecto y fecha del evento
function rowsFor(emails, summary, leads, type) {
  const byEmail = new Map(leads.map(l => [l.email, l]));
  return [...emails].map(email => {
    const lead = byEmail.get(email);
    const event = summary.events.get(`${type}|${email}`);
    const date = event ? parseDate(event.created_at) : null;
    return {
      email,
      inBase: !!lead,
      sub: [lead?.nombre, lead?.empresa].filter(Boolean).join(' · ') || (event?.campaign ? `Campaña: ${event.campaign}` : ''),
      detail: [date ? formatFechaHora(date) : '', event?.reason].filter(Boolean).join(' · '),
    };
  }).sort((a, b) => a.email.localeCompare(b.email));
}

// Ventanas de entrega: rebotes (duros y suaves por separado), desuscritos y spam
function useDeliveryModal(summary, leads, onChanged) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const bounceSections = summary.hasBounceTypes
    ? [
        { title: 'Rebotes duros', hint: 'El correo no existe o está bloqueado: no volver a enviar', rows: rowsFor(new Set([...summary.hard, ...summary.unknown]), summary, leads, 'bounce') },
        { title: 'Rebotes suaves', hint: 'Buzón lleno o servidor caído: se puede reintentar', rows: rowsFor(summary.soft, summary, leads, 'bounce') },
      ]
    : [{ title: 'Correos que rebotaron', hint: 'El servidor aún no distingue duros y suaves', rows: rowsFor(summary.bounced, summary, leads, 'bounce') }];
  const modals = {
    bounces: { title: 'Rebotes', subtitle: 'Correos que no se pudieron entregar', sections: bounceSections, filename: 'rebotes', tabbed: true },
    unsub: { title: 'Desuscritos', subtitle: 'Pidieron no recibir más correos', sections: [{ title: 'Desuscritos', rows: rowsFor(summary.unsub, summary, leads, 'unsubscribe') }], filename: 'desuscritos' },
    spam: { title: 'Marcados como spam', subtitle: 'Si sube, revisa el asunto y la lista', sections: [{ title: 'Marcaron spam', rows: rowsFor(summary.spam, summary, leads, 'spam') }], filename: 'spam' },
  };
  // Elimina al prospecto de la base de datos (mismo endpoint de Base de datos) y recarga las cifras
  const removeLead = async (email) => {
    const confirmed = await confirmAction({
      title: '¿Eliminar de la base de datos?', text: `Se eliminará permanentemente a ${email}.`, confirmText: 'Sí, eliminar', danger: true,
    });
    if (!confirmed) return;
    try {
      await api.post('/leads/delete', { email });
      await onChanged?.();
      notifySuccess('El prospecto se eliminó satisfactoriamente.');
    } catch (error) {
      console.error('Error al eliminar el prospecto', error);
      notifyError('No se pudo eliminar el prospecto.');
    }
  };
  const current = open ? modals[open] : null;
  const modal = current && (
    <ListModal isOpen onClose={() => setOpen(null)} {...current} onRemove={open === 'bounces' ? removeLead : undefined}
      onOpenLead={(email) => { setOpen(null); navigate(`/audiencia?abrir=${encodeURIComponent(email)}`); }} />
  );
  return { setOpen, modal };
}

const Item = ({ label, value, sub, tip, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`min-w-0 text-left ${onClick ? 'cursor-pointer rounded-lg -mx-2 px-2 py-1 -my-1 hover:bg-slate-50 transition-colors group' : ''}`}>
      <p className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">{label}{onClick && <ChevronRight size={12} className="text-slate-300 group-hover:text-slate-500" />}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums"><Tip text={tip}>{value}</Tip>{sub && <span className="ml-1 text-xs font-normal text-slate-500">{sub}</span>}</p>
    </Tag>
  );
};

// Franja compacta del panel: entrega. Solo aparece si el servidor ya envía esos datos. Cada dato abre su lista de personas
export function DeliveryStrip({ summary, sent, leads, onChanged }) {
  const { setOpen, modal } = useDeliveryModal(summary, leads, onChanged);
  if (!summary.hasDeliveryData) return null;
  const delivered = Math.max(sent - summary.bounces, 0);
  return (
    <section className={`${ui.card} px-5 py-3.5 flex flex-wrap items-center gap-x-10 gap-y-3`}>
      <Item label="Entregados" value={pct(delivered, sent)} tip={`${delivered}`} />
      <Item label="Rebotes" value={summary.bounces} onClick={() => setOpen('bounces')} />
      <Item label="Desuscritos" value={summary.unsub.size} onClick={() => setOpen('unsub')} />
      <Item label="Spam" value={summary.spam.size} onClick={() => setOpen('spam')} />
      {modal}
    </section>
  );
}

const Row = ({ label, value, hint, strong, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`w-full flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 text-left ${onClick ? 'cursor-pointer group' : ''}`}>
      <div className="min-w-0">
        <p className={`text-sm ${strong ? 'font-medium text-slate-900' : 'text-slate-700'} ${onClick ? 'group-hover:text-brand-700' : ''}`}>{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <p className="flex items-center gap-1 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">{value}{onClick && <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />}</p>
    </Tag>
  );
};

// Reporte de campaña: qué pasó con los correos después de enviarlos
export function DeliveryPanel({ summary, sent, leads, onChanged, className = '' }) {
  const { setOpen, modal } = useDeliveryModal(summary, leads, onChanged);
  const delivered = Math.max(sent - summary.bounces, 0);
  return (
    <Panel className={className} title="Entrega" subtitle="Qué pasó con los correos después de enviarlos" bodyClassName="!pb-3">
      {summary.hasDeliveryData ? (
        <div>
          <Row strong label="Entregados" value={<Tip text={`${delivered}`}>{pct(delivered, sent)}</Tip>} />
          <Row label="Rebotes" value={summary.bounces} hint="Pulsa para ver quiénes, duros y suaves" onClick={() => setOpen('bounces')} />
          <Row label="Desuscritos" value={summary.unsub.size} hint="Pidieron no recibir más correos" onClick={() => setOpen('unsub')} />
          <Row label="Marcados como spam" value={summary.spam.size} hint="Si sube, revisa el asunto y la lista" onClick={() => setOpen('spam')} />
        </div>
      ) : <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">El servidor todavía no envía rebotes, desuscritos ni spam. Cuando lo haga, aparecerán aquí.</p>}
      {modal}
    </Panel>
  );
}
