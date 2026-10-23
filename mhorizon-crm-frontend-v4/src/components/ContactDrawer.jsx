import { useEffect, useMemo, useState } from 'react';
import { X, Send, MailOpen, MousePointerClick, Tag, Trash2, Copy, Check, Ban, UserMinus, ShieldAlert, Phone, Pencil } from 'lucide-react';
import Skeleton from './Skeleton';
import { parseTags } from '../utils/tags';
import { ui } from '../utils/theme';
import { parseDate, formatFechaHora, timeAgo } from '../utils/dates';

const MAX_EVENTS = 30;
const EVENT_INFO = {
  sent: { icon: Send, label: 'Recibió un correo', tone: 'bg-slate-100 text-slate-500' },
  open: { icon: MailOpen, label: 'Abrió el correo', tone: 'bg-navy-50 text-navy-700' },
  click: { icon: MousePointerClick, label: 'Hizo clic en un enlace', tone: 'bg-brand-50 text-brand-600' },
  bounce: { icon: Ban, label: 'El correo rebotó', tone: 'bg-rose-50 text-rose-600' },
  unsubscribe: { icon: UserMinus, label: 'Se dio de baja', tone: 'bg-slate-100 text-slate-600' },
  spam: { icon: ShieldAlert, label: 'Marcó el correo como spam', tone: 'bg-rose-50 text-rose-600' },
};
const BOUNCE_TYPE = { hard: 'duro', duro: 'duro', soft: 'suave', suave: 'suave' };
// Rechazos que registra el worker de Python: 'blocked' es permanente y 'failed' temporal
const LEGACY_BOUNCE = { blocked: 'hard', failed: 'soft' };
const eventLabel = (event) => {
  if (event.type === 'bounce' && BOUNCE_TYPE[event.bounceType]) return `El correo rebotó (${BOUNCE_TYPE[event.bounceType]})`;
  return EVENT_INFO[event.type].label;
};

// Datos de contacto y seguimiento que el backend puede enviar en cada prospecto (ver BACKEND.md)
const CONTACT_FIELDS = [
  ['nombre', 'Nombre', 'text'],
  ['empresa', 'Empresa', 'text'],
  ['telefono', 'Teléfono', 'tel'],
  ['responsable', 'Responsable', 'text'],
  ['proxima_accion', 'Próxima acción', 'text'],
  ['proxima_fecha', 'Fecha de la próxima acción', 'date'],
];
const pickContact = (lead) => Object.fromEntries([...CONTACT_FIELDS.map(([key]) => key), 'notas'].map(key => [key, lead?.[key] ? String(lead[key]) : '']));
const formatFecha = (value) => {
  const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
};

const shortUrl = (url) => {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname === '/' ? '' : pathname}`;
  } catch {
    return url;
  }
};

const Stat = ({ label, value }) => (
  <div className="px-3 py-2.5">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums leading-none">{value}</p>
  </div>
);

// Ficha del prospecto: datos, etiquetas e historial de actividad
export default function ContactDrawer({ lead, logs, loadingLogs, busy, flag, onClose, onAddTag, onRemoveTag, onDelete, onSaveContact }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const email = lead?.email;

  useEffect(() => {
    if (!email) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [email, onClose]);

  const events = useMemo(() => logs
    .filter(log => log.email === email && (EVENT_INFO[log.event_type] || LEGACY_BOUNCE[log.event_type]))
    .map(log => LEGACY_BOUNCE[log.event_type]
      ? { type: 'bounce', campaign: log.campaign_name, bounceType: LEGACY_BOUNCE[log.event_type], date: parseDate(log.created_at) }
      : { type: log.event_type, campaign: log.campaign_name, url: log.url, bounceType: String(log.bounce_type || '').toLowerCase(), date: parseDate(log.created_at) })
    .filter(event => event.date)
    .sort((a, b) => b.date - a.date), [logs, email]);

  if (!lead) return null;
  const tags = parseTags(lead.etiquetas);
  const contact = pickContact(lead);
  const hasContact = Object.values(contact).some(Boolean);
  const vencida = contact.proxima_fecha && contact.proxima_fecha.slice(0, 10) <= new Date().toISOString().slice(0, 10);

  const saveContact = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onSaveContact(lead.email, editing);
    setSaving(false);
    if (ok) setEditing(null);
  };
  const close = () => { setEditing(null); onClose(); };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(lead.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('No se pudo copiar el correo', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 animate-fade-in" onClick={close}>
      <aside role="dialog" aria-modal="true" aria-label="Ficha del prospecto" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slide-in">
        <header className="flex items-start gap-3 p-5 border-b border-slate-100">
          <span className="h-10 w-10 shrink-0 rounded-full bg-navy-900 text-white grid place-items-center font-semibold">{lead.email.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-semibold text-slate-900 truncate">{lead.email}</h3>
              <button type="button" onClick={copyEmail} title="Copiar correo" aria-label="Copiar correo" className="shrink-0 h-7 w-7 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-xs">Fase {Math.min(lead.fase || 1, 5)}</span>
              <span className="text-[13px] text-slate-500">{lead.status || 'Pendiente'}</span>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {flag && (
            <p className={`rounded-lg px-3 py-2.5 text-[13px] font-medium ${flag.tone}`}>
              {flag.label}. {flag.key === 'hard' ? 'Este correo no existe o está bloqueado: no conviene volver a enviarle.' : flag.key === 'soft' || flag.key === 'bounce' ? 'Puede ser temporal; revisa antes de reenviar.' : 'Pidió no recibir más correos: respeta su decisión.'}
            </p>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold text-slate-700">Contacto y seguimiento</h4>
              {!editing && onSaveContact && (
                <button type="button" onClick={() => setEditing(contact)} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer"><Pencil size={13} /> Editar</button>
              )}
            </div>
            {editing ? (
              <form onSubmit={saveContact} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {CONTACT_FIELDS.map(([key, label, type]) => (
                    <label key={key} className={key === 'proxima_accion' ? 'col-span-2' : ''}>
                      <span className="block text-xs text-slate-500 mb-1">{label}</span>
                      <input type={type} value={editing[key]} onChange={(e) => setEditing(prev => ({ ...prev, [key]: e.target.value }))} className={`${ui.input} w-full h-9`} />
                    </label>
                  ))}
                </div>
                <label className="block">
                  <span className="block text-xs text-slate-500 mb-1">Notas</span>
                  <textarea rows={3} value={editing.notas} onChange={(e) => setEditing(prev => ({ ...prev, notas: e.target.value }))} className={`${ui.input} w-full h-auto py-2`} />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(null)} className={`${ui.btn} h-9`}>Cancelar</button>
                  <button type="submit" disabled={saving} className={`${ui.btnPrimary} h-9`}>{saving ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </form>
            ) : hasContact ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {CONTACT_FIELDS.filter(([key]) => contact[key]).map(([key, label]) => (
                  <div key={key} className={key === 'proxima_accion' ? 'col-span-2' : ''}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className={`text-slate-900 break-words ${key === 'proxima_fecha' && vencida ? 'font-semibold text-brand-700' : ''}`}>
                      {key === 'telefono' ? <a href={`tel:${contact.telefono.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-brand-700"><Phone size={13} />{contact.telefono}</a>
                        : key === 'proxima_fecha' ? `${formatFecha(contact.proxima_fecha)}${vencida ? ' · para hoy o atrasada' : ''}` : contact[key]}
                    </dd>
                  </div>
                ))}
                {contact.notas && (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">Notas</dt>
                    <dd className="text-slate-700 whitespace-pre-line">{contact.notas}</dd>
                  </div>
                )}
              </dl>
            ) : <p className="text-sm text-slate-500">Sin datos de contacto. Pulsa «Editar» para añadir nombre, empresa, teléfono, responsable y próxima acción.</p>}
          </section>

          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200">
            <Stat label="Enviados" value={lead.sent || 0} />
            <Stat label="Aperturas" value={lead.opens || 0} />
            <Stat label="Clics" value={lead.clicks || 0} />
          </div>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold text-slate-700">Etiquetas</h4>
              <button type="button" onClick={() => onAddTag(lead.email)} disabled={busy}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-600 disabled:opacity-50 cursor-pointer"><Tag size={13} /> Agregar</button>
            </div>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium">
                    {tag}
                    <button type="button" onClick={() => onRemoveTag(lead.email, tag)} aria-label={`Quitar ${tag}`} className="rounded p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"><X size={12} /></button>
                  </span>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">Sin etiquetas.</p>}
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-slate-700 mb-3">Historial</h4>
            {loadingLogs ? (
              <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay actividad registrada para este prospecto.</p>
            ) : (
              <ol className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {events.slice(0, MAX_EVENTS).map((event, i) => {
                  const { icon: Icon, tone } = EVENT_INFO[event.type];
                  const label = eventLabel(event);
                  return (
                    <li key={`${event.type}-${event.date.getTime()}-${i}`} className="relative flex gap-3">
                      <span className={`relative z-10 h-8 w-8 shrink-0 rounded-full grid place-items-center ring-4 ring-white ${tone}`}><Icon size={14} /></span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {[event.campaign, event.type === 'click' && event.url ? shortUrl(event.url) : null].filter(Boolean).join(' · ') || 'Sin campaña'}
                        </p>
                        <p className="text-xs text-slate-500" title={formatFechaHora(event.date)}>{timeAgo(event.date)} · {formatFechaHora(event.date)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {events.length > MAX_EVENTS && <p className="mt-3 text-xs text-slate-500">Se muestran los {MAX_EVENTS} movimientos más recientes de {events.length}.</p>}
          </section>
        </div>

        <footer className="p-4 border-t border-slate-100">
          <button type="button" onClick={() => onDelete([lead.email])} disabled={busy}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50 cursor-pointer">
            <Trash2 size={15} /> Eliminar prospecto
          </button>
        </footer>
      </aside>
    </div>
  );
}
