import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { BarRow, Panel, RateBar, Stat, StatGrid } from '../components/analytics';
import { DeliveryPanel } from '../components/Deliverability';
import DeviceHourCharts from '../components/Charts';
import DetailsModal from '../components/DetailsModal';
import { DELIVERED_FLAG, deliveryEvent, deliveryFlag } from '../utils/deliverability';
import { COLORS, ui } from '../utils/theme';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { downloadCsv } from '../utils/csv';
import { formatFechaHora, parseDate, toDayKey } from '../utils/dates';
import { isReplied } from '../utils/status';

const FASES = [1, 2, 3, 4, 5];
const PAGE_SIZE = 25;
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const faseOf = (lead) => Math.min(lead?.fase || 1, 5);

// Cuánto tardaron en abrir desde el primer envío de la campaña
const OPEN_DELAYS = [
  ['Primera hora', 1],
  ['1 a 3 horas', 3],
  ['3 a 6 horas', 6],
  ['6 a 12 horas', 12],
  ['12 a 24 horas', 24],
  ['1 a 2 días', 48],
  ['Más de 2 días', Infinity],
];

const TABS = [
  ['todos', 'Todos'],
  ['abrieron', 'Abrieron'],
  ['clic', 'Hicieron clic'],
  ['respondieron', 'Respondieron'],
  ['noAbrieron', 'No abrieron'],
  ['problemas', 'Rebotes y bajas'],
];

const NOTES = {
  abrieron: 'Quienes abrieron el correo al menos una vez, con el día y la hora de su primera apertura.',
  clic: 'Quienes tocaron un enlace. Son los contactos más interesados: conviene llamarlos o escribirles primero.',
  respondieron: 'Contactos de esta campaña que respondieron (el agente IMAP conversa con ellos o los derivó al equipo).',
  noAbrieron: 'Exporta esta lista si quieres reenviarles el correo con otro asunto. No incluye a quienes rebotaron o se dieron de baja.',
  problemas: 'Correos que no llegaron o personas que pidieron no recibir más. No volver a escribirles.',
};

const dash = <span className="text-slate-300">—</span>;
const when = (date) => (date ? formatFechaHora(date) : dash);
const ctorOf = (r) => (r.opens > 0 ? `${Math.min(percent(r.clicks, r.opens), 100)}%` : '—');
const faseCell = (r) => (r.inCrm ? `Fase ${r.fase}` : dash);
const statusCell = (r) => (r.inCrm ? r.status : 'Ya no está en la base');
const flagCell = (r) => { const flag = r.flag || DELIVERED_FLAG; return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${flag.tone}`}>{flag.label}</span>; };

// Cada pestaña muestra las columnas que importan para esa lista (right = alineada a la derecha)
const COLUMNS = {
  todos: [['Fase', faseCell], ['Estado', statusCell], ['Entrega', flagCell], ['Aperturas', r => r.opens, true], ['Clics', r => r.clicks, true]],
  abrieron: [['Fase', faseCell], ['Primera apertura', r => when(r.firstOpen)], ['Aperturas', r => r.opens, true], ['Clics', r => r.clicks, true]],
  clic: [['Fase', faseCell], ['Aperturas', r => r.opens, true], ['Clics', r => r.clicks, true], ['CTOR', ctorOf, true]],
  respondieron: [['Fase', faseCell], ['Aperturas', r => r.opens, true], ['Clics', r => r.clicks, true]],
  noAbrieron: [['Fase', faseCell], ['Estado', statusCell], ['Enviado', r => when(r.sentAt)]],
  problemas: [['Tipo', flagCell], ['Fecha', r => (r.problem?.created_at && parseDate(r.problem.created_at) ? when(parseDate(r.problem.created_at)) : dash)], ['Motivo', r => r.problem?.reason || dash]],
};

// La clave reinicia el reporte al pasar de una campaña a otra
export default function CampaignReport() {
  const { nombre = '' } = useParams();
  return <Report key={nombre} nombre={nombre} />;
}

// Reporte de una sola campaña: resultados, a quién le funcionó y quién falta por abrir
function Report({ nombre }) {
  const navigate = useNavigate();
  const { loading, lastUpdated, fetchData, filteredLogs, leads, metrics, deliverability, linkInsights, campaignsSummary, deviceBreakdown, hourlyActivityData, modalDetails, openDetails, closeDetails } = useDashboardMetrics(nombre);
  const [tab, setTab] = useState('todos');
  const [page, setPage] = useState(1);

  const campaign = campaignsSummary.find(c => c.name === nombre);
  const firstLoad = loading && !lastUpdated;

  // Una fila por destinatario con sus aperturas, clics y datos del CRM
  const recipients = useMemo(() => {
    const byEmail = new Map();
    const leadByEmail = new Map(leads.map(l => [l.email, l]));
    filteredLogs.forEach(log => {
      const row = byEmail.get(log.email) || { email: log.email, opens: 0, clicks: 0, sentAt: null, firstOpen: null };
      const date = parseDate(log.created_at);
      if (log.event_type === 'sent' && date && (!row.sentAt || date < row.sentAt)) row.sentAt = date;
      if (log.event_type === 'open') {
        row.opens++;
        if (date && (!row.firstOpen || date < row.firstOpen)) row.firstOpen = date;
      }
      if (log.event_type === 'click') row.clicks++;
      byEmail.set(log.email, row);
    });
    return Array.from(byEmail.values()).map(row => {
      const lead = leadByEmail.get(row.email);
      const flag = deliveryFlag(row.email, deliverability);
      const replied = isReplied(lead?.status);
      return { ...row, fase: faseOf(lead), status: lead?.status || 'Pendiente', inCrm: !!lead, nombre: lead?.nombre || '', empresa: lead?.empresa || '', flag, problem: deliveryEvent(row.email, deliverability), replied };
    }).sort((a, b) => b.clicks - a.clicks || b.opens - a.opens || a.email.localeCompare(b.email));
  }, [filteredLogs, leads, deliverability]);

  const opened = recipients.filter(r => r.opens > 0 || r.clicks > 0);
  const clicked = recipients.filter(r => r.clicks > 0);
  // "No abrieron" deja fuera a quien rebotó o se dio de baja: a esos no conviene reenviarles
  const notOpened = recipients.filter(r => r.opens === 0 && r.clicks === 0 && !r.flag);
  const problems = recipients.filter(r => r.flag);
  const replied = recipients.filter(r => r.replied);
  const lists = { todos: recipients, abrieron: opened, clic: clicked, respondieron: replied, noAbrieron: notOpened, problemas: problems };
  const tabs = TABS.filter(([key]) => (key !== 'problemas' || problems.length > 0) && (key !== 'respondieron' || replied.length > 0));
  const activeTab = tabs.some(([key]) => key === tab) ? tab : 'todos';
  const rows = lists[activeTab];
  const columns = COLUMNS[activeTab];
  const totalPages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Comparación con el promedio de las demás campañas
  const others = campaignsSummary.filter(c => c.name !== nombre);
  const avgOf = (key) => others.reduce((acc, c) => acc + Number(c[key]), 0) / others.length;
  const openDelta = campaign && others.length > 0 ? Number(campaign.openRate) - avgOf('openRate') : null;
  const clickDelta = campaign && others.length > 0 ? Number(campaign.clickRate) - avgOf('clickRate') : null;

  const byFase = useMemo(() => FASES.map(f => {
    const group = recipients.filter(r => r.fase === f);
    return {
      fase: f,
      total: group.length,
      openCount: group.filter(r => r.opens > 0 || r.clicks > 0).length,
      clickCount: group.filter(r => r.clicks > 0).length,
      openRate: percent(group.filter(r => r.opens > 0 || r.clicks > 0).length, group.length),
      clickRate: percent(group.filter(r => r.clicks > 0).length, group.length),
    };
  }).filter(g => g.total > 0), [recipients]);

  const openDelays = useMemo(() => {
    const counts = OPEN_DELAYS.map(([label]) => ({ label, value: 0 }));
    recipients.forEach(r => {
      if (!r.firstOpen || !r.sentAt) return;
      const hours = Math.max(r.firstOpen - r.sentAt, 0) / 36e5;
      counts[OPEN_DELAYS.findIndex(([, limit]) => hours < limit)].value++;
    });
    return counts;
  }, [recipients]);
  const delayMax = Math.max(...openDelays.map(d => d.value), 0);
  const firstDay = openDelays.slice(0, 5).reduce((acc, d) => acc + d.value, 0);
  const totalTimed = openDelays.reduce((acc, d) => acc + d.value, 0);

  const exportRows = (list, label) => downloadCsv(`${nombre}-${label}-${toDayKey(new Date())}.csv`, [
    ['Correo', 'Nombre', 'Empresa', 'Fase', 'Estado', 'Entrega', 'Aperturas', 'Clics', 'Motivo'],
    ...list.map(r => [r.email, r.nombre, r.empresa, r.fase, r.status, r.flag?.label || 'Entregado', r.opens, r.clicks, r.problem?.reason || '']),
  ]);

  const openLead = (email) => navigate(`/audiencia?abrir=${encodeURIComponent(email)}`);

  if (!firstLoad && !campaign) {
    return (
      <div className={`${ui.card}`}>
        <EmptyState title="No encontramos esta campaña" text="Puede que se haya renombrado o que aún no tenga envíos registrados."
          action={<Link to="/campanas" className={ui.btn}><ArrowLeft size={16} /> Volver a campañas</Link>} />
      </div>
    );
  }

  return (
    <div className={`transition-opacity ${loading && lastUpdated ? 'opacity-60' : ''}`}>
      <Link to="/campanas" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={15} /> Campañas
      </Link>
      <PageHeader description={campaign ? `${campaign.subject ? `Asunto: «${campaign.subject}» · ` : ''}Último movimiento: ${campaign.dateStr}` : 'Cargando...'}
        actions={<>
          <button onClick={fetchData} disabled={loading} title="Actualizar datos" aria-label="Actualizar datos" className={ui.iconBtn}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => exportRows(recipients, 'destinatarios')} disabled={recipients.length === 0} className={ui.btn}>
            <Download size={16} /> Exportar
          </button>
        </>}>
        {nombre}
      </PageHeader>

      <div className="space-y-5">
        <StatGrid>
          <Stat label="Destinatarios" value={metrics.sent} loading={firstLoad} onClick={() => openDetails('sent')}
            hint={`${notOpened.length} todavía sin abrir`} />
          <Stat label="Tasa de apertura" value={metrics.openRate} delta={openDelta} loading={firstLoad} onClick={() => openDetails('opens')}
            tip={`${metrics.uniqueOpens}`} hint={`${metrics.uniqueOpens} contactos abrieron`} />
          <Stat label="Tasa de clics" value={metrics.clickRate} delta={clickDelta} loading={firstLoad} onClick={() => openDetails('clicks')}
            tip={`${metrics.uniqueClicks}`}
            hint={metrics.uniqueOpens > 0 ? `${metrics.uniqueClicks} contactos · ${metrics.ctor} de quienes abren` : `${metrics.uniqueClicks} contactos hicieron clic`} />
          <Stat label="Tasa de respuesta" value={metrics.replyRate} loading={firstLoad} onClick={() => openDetails('replied')}
            tip={`${metrics.replied}`} hint={`${metrics.replied} contactos respondieron`} />
        </StatGrid>
        {others.length > 0 && <p className="-mt-2 text-[13px] text-slate-500">Las flechas comparan con el promedio de las demás campañas.</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Resultados por fase" subtitle="A qué grupo le funcionó mejor este correo" bodyClassName="!px-0 !pb-2">
            {firstLoad ? <div className="px-5"><Skeleton className="h-40 w-full" /></div> : byFase.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Sin destinatarios registrados.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className={ui.th}>Fase</th>
                    <th className={`${ui.th} text-right`}>Dest.</th>
                    <th className={ui.th}>Apertura</th>
                    <th className={ui.th}>Clics</th>
                  </tr>
                </thead>
                <tbody>
                  {byFase.map(g => (
                    <tr key={g.fase} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 px-5 font-medium text-slate-900 whitespace-nowrap">Fase {g.fase}</td>
                      <td className="py-2.5 px-5 text-right tabular-nums text-slate-600">{g.total}</td>
                      <td className="py-2.5 px-5"><RateBar value={g.openRate} tip={`${g.openCount}`} /></td>
                      <td className="py-2.5 px-5"><RateBar value={g.clickRate} tip={`${g.clickCount}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Tiempo hasta la primera apertura"
            subtitle={totalTimed > 0 ? `${percent(firstDay, totalTimed)}% abrió durante el primer día` : 'Desde que se envió el correo'}>
            {firstLoad ? <Skeleton className="h-40 w-full" /> : totalTimed === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Todavía nadie ha abierto este correo.</p>
            ) : (
              <div className="space-y-3">
                {openDelays.map(d => <BarRow key={d.label} label={d.label} value={d.value} max={delayMax} color={COLORS.opens} />)}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <DeliveryPanel summary={deliverability} sent={metrics.sent} leads={leads} onChanged={fetchData} />
          <div className="lg:col-span-2 min-w-0 [&>section]:h-full">
          <Panel title="Enlaces de esta campaña" subtitle="Qué links generaron clics" bodyClassName="!px-0 !pb-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    <th className={ui.th}>Enlace</th>
                    <th className={`${ui.th} text-right`}>Clics</th>
                    <th className={`${ui.th} text-right`}>Únicos</th>
                  </tr>
                </thead>
                <tbody>
                  {linkInsights.map(link => (
                    <tr key={link.url} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 px-5 max-w-0 w-full">
                        <a href={link.url} target="_blank" rel="noreferrer" title={link.url} className="font-medium text-slate-900 hover:text-brand-700 truncate block">{link.alias}</a>
                        <span className="text-xs text-slate-500 truncate block">{link.url}</span>
                      </td>
                      <td className="py-2.5 px-5 text-right font-semibold tabular-nums">{link.total}</td>
                      <td className="py-2.5 px-5 text-right tabular-nums text-slate-600">{link.unique}</td>
                    </tr>
                  ))}
                  {linkInsights.length === 0 && <tr><td colSpan="3" className="py-8 text-center text-slate-500">Sin clics registrados</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
          </div>
        </div>

        <DeviceHourCharts deviceBreakdown={deviceBreakdown} hourlyActivityData={hourlyActivityData} />

        {/* Destinatarios: quién abrió, quién hizo clic y quién falta */}
        <section className={`${ui.card} overflow-hidden`}>
          <div className="flex gap-1 overflow-x-auto px-3 pt-3 border-b border-slate-100" role="tablist" aria-label="Filtrar destinatarios">
            {tabs.map(([key, label]) => {
              const active = activeTab === key;
              return (
                <button key={key} role="tab" aria-selected={active} onClick={() => { setTab(key); setPage(1); }}
                  className={`relative shrink-0 px-3 pb-3 pt-1 text-sm cursor-pointer transition-colors ${active ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                  {label} <span className={`ml-1 tabular-nums text-xs ${active ? 'text-slate-700' : 'text-slate-400'}`}>{lists[key].length}</span>
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-[13px] text-slate-600 bg-slate-50/60 border-b border-slate-100">
            <p className="min-w-0">{NOTES[activeTab] || 'Todos los destinatarios de esta campaña. Pulsa una fila para abrir su ficha.'}</p>
            <button type="button" onClick={() => exportRows(rows, TABS.find(([k]) => k === activeTab)[1].toLowerCase().replace(/\s+/g, '-'))} disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 cursor-pointer">
              <Download size={14} /> Exportar esta lista
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className={ui.th}>Correo</th>
                  {columns.map(([label, , right]) => <th key={label} className={`${ui.th} ${right ? 'text-right' : ''} hidden sm:table-cell`}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {firstLoad ? [0, 1, 2, 3].map(i => (
                  <tr key={i} className="border-t border-slate-100"><td colSpan={columns.length + 1} className="px-5 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                )) : pageRows.map(r => (
                  <tr key={r.email} onClick={() => r.inCrm && openLead(r.email)}
                    className={`border-t border-slate-100 first:border-t-0 transition-colors ${r.inCrm ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                    <td className="py-2.5 px-5">
                      <span className="block font-medium text-slate-900">{r.email}</span>
                      {(r.nombre || r.empresa) && <span className="block text-xs text-slate-500">{[r.nombre, r.empresa].filter(Boolean).join(' · ')}</span>}
                      <span className="sm:hidden mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        {r.inCrm ? `Fase ${r.fase}` : 'Fuera de la base'} · {r.opens} aperturas · {r.clicks} clics
                        {r.flag && <span className={`rounded-md px-1.5 py-0.5 font-medium ${r.flag.tone}`}>{r.flag.label}</span>}
                      </span>
                    </td>
                    {columns.map(([label, render, right]) => (
                      <td key={label} className={`py-2.5 px-5 text-slate-600 whitespace-nowrap hidden sm:table-cell ${right ? 'text-right tabular-nums' : ''}`}>{render(r)}</td>
                    ))}
                  </tr>
                ))}
                {!firstLoad && rows.length === 0 && (
                  <tr><td colSpan={columns.length + 1} className="py-8 text-center text-slate-500">
                    {activeTab === 'noAbrieron' ? 'Todos los destinatarios abrieron el correo.' : 'Nadie en esta lista todavía.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-3 border-t border-slate-100">
              <span className="text-[13px] text-slate-500">Mostrando {((current - 1) * PAGE_SIZE) + 1} a {Math.min(current * PAGE_SIZE, rows.length)} de {rows.length}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(current - 1, 1))} disabled={current === 1} className={`${ui.btn} h-8`}>Anterior</button>
                <button onClick={() => setPage(Math.min(current + 1, totalPages))} disabled={current === totalPages} className={`${ui.btn} h-8`}>Siguiente</button>
              </div>
            </div>
          )}
        </section>
      </div>
      <DetailsModal modalDetails={modalDetails} onClose={closeDetails} />
    </div>
  );
}
