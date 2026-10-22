import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, ChevronRight, Send, FileUp, Bot } from 'lucide-react';
import DetailsModal from '../components/DetailsModal';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { DeliveryStrip } from '../components/Deliverability';
import DeviceHourCharts from '../components/Charts';
import { BarRow, LegendDot, Panel, Stat, StatGrid } from '../components/analytics';
import { COLORS, tooltipStyle, axisTick, selectClass, ui } from '../utils/theme';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { formatHora, timeAgo, toDayKey } from '../utils/dates';

const PERIODS = [['Todos', 'Todo el tiempo'], ['7dias', 'Últimos 7 días'], ['30dias', 'Últimos 30 días'], ['esteMes', 'Este mes']];
const SERIES = [['sent', 'Enviados', COLORS.sent], ['opens', 'Aperturas', COLORS.opens], ['clicks', 'Clics', COLORS.clicks]];
const EVENT_COLOR = { sent: COLORS.sent, open: COLORS.opens, click: COLORS.clicks };
const MAX_LINKS = 6;
const MAX_HOT = 6;

const eventText = (event) => {
  if (event.type === 'sent') return <>Se envió <span className="font-medium text-slate-900">{event.campaign}</span> a {event.count} {event.count === 1 ? 'prospecto' : 'prospectos'}</>;
  return <><span className="font-medium text-slate-900">{event.email}</span> {event.type === 'open' ? 'abrió' : 'hizo clic en'} {event.campaign}</>;
};

const ChartSkeleton = ({ className = 'h-64' }) => <Skeleton className={`${className} w-full`} />;

const STEPS = [
  { to: '/audiencia', icon: FileUp, title: 'Carga tus prospectos', text: 'Sube un CSV con los correos y etiquétalos.' },
  { to: '/difusion-manual', icon: Send, title: 'Envía tu primera campaña', text: 'Elige una fase, escribe el correo y envíalo.' },
  { to: '/agente-imap', icon: Bot, title: 'Activa el agente IMAP', text: 'Para clasificar y responder las respuestas.' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading, error, lastUpdated, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    leads, uniqueCampaigns, isGlobalView, metrics, deliverability, crmFunnelData, linkInsights, deviceBreakdown,
    timeSeriesData, hourlyActivityData, campaignsSummary, hotLeads, recentEvents,
    modalDetails, openDetails, closeDetails
  } = useDashboardMetrics(searchParams.get('campana') || '', PERIODS.some(([v]) => v === searchParams.get('periodo')) ? searchParams.get('periodo') : 'Todos');
  const [hiddenSeries, setHiddenSeries] = useState([]);

  // La campaña y el periodo viajan en la URL para poder compartir o recargar la misma vista
  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setSearchParams(next, { replace: true });
  };
  const pickCampaign = (name) => { setCampaignSearch(name); updateParams({ campana: name }); };
  const pickPeriod = (value) => { setDateFilter(value); updateParams({ periodo: value === 'Todos' ? '' : value }); };

  const toggleSeries = (key) => setHiddenSeries(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const firstLoad = loading && !lastUpdated;
  const crmFunnel = [...crmFunnelData].reverse();
  const crmMax = Math.max(...crmFunnel.map(f => f.value), 0);
  const crmTotal = crmFunnel.reduce((acc, f) => acc + f.value, 0);
  const noData = !loading && !!lastUpdated && metrics.sent === 0 && crmTotal === 0;

  // Con una campaña elegida, se compara contra el promedio de todas las campañas
  const average = (key) => campaignsSummary.reduce((acc, c) => acc + Number(c[key]), 0) / campaignsSummary.length;
  const compare = !isGlobalView && campaignsSummary.length > 1;
  const openDelta = compare ? parseFloat(metrics.openRate) - average('openRate') : null;
  const clickDelta = compare ? parseFloat(metrics.clickRate) - average('clickRate') : null;

  // Próximas acciones de seguimiento para hoy o atrasadas (el servidor las envía en cada prospecto)
  const today = toDayKey(new Date());
  const dueActions = leads
    .filter(l => l.proxima_accion && l.proxima_fecha && String(l.proxima_fecha).slice(0, 10) <= today)
    .sort((a, b) => String(a.proxima_fecha).localeCompare(String(b.proxima_fecha)));

  const filters = (
    <>
      <select className={`${selectClass} max-w-56`} value={campaignSearch} onChange={(e) => pickCampaign(e.target.value)} aria-label="Campaña">
        <option value="">Todas las campañas</option>
        {uniqueCampaigns.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      <select className={selectClass} value={dateFilter} onChange={(e) => pickPeriod(e.target.value)} aria-label="Periodo">
        {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button onClick={fetchData} disabled={loading} title="Actualizar datos" aria-label="Actualizar datos" className={ui.iconBtn}>
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
      </button>
    </>
  );

  return (
    <div className={`transition-opacity ${loading && lastUpdated ? 'opacity-60' : ''}`}>
      <PageHeader actions={filters}
        description={`${isGlobalView ? 'Resultados de todas las campañas.' : `Resultados de «${campaignSearch}».`}${lastUpdated ? ` Actualizado a las ${formatHora(lastUpdated)}.` : ''}`}>
        Panel analítico
      </PageHeader>

      <div className="space-y-5">
      {error && <div className="p-3 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-100">{error}</div>}

      {noData ? (
        <section className={`${ui.card} p-6 sm:p-8`}>
          <EmptyState className="py-2" title="Aún no hay datos que mostrar" text="Estos son los primeros pasos para empezar a ver resultados aquí." />
          <ol className="mt-6 grid sm:grid-cols-3 gap-4">
            {STEPS.map(({ to, icon: Icon, title, text }, i) => (
              <li key={to}>
                <Link to={to} className="group block h-full rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  <span className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-navy-900 text-white text-xs font-bold grid place-items-center">{i + 1}</span>
                    <Icon size={16} className="text-brand-600" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-[13px] text-slate-500">{text}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          {/* Lo principal, de un vistazo: una sola tarjeta dividida en cuatro */}
          <StatGrid>
            <Stat label="Enviados" value={metrics.sent} loading={firstLoad} hint="Ver destinatarios" onClick={() => openDetails('sent')} />
            <Stat label="Tasa de apertura" value={metrics.openRate} delta={openDelta} loading={firstLoad} tip={`${metrics.uniqueOpens}`} hint={`${metrics.uniqueOpens} contactos abrieron`} onClick={() => openDetails('opens')} />
            <Stat label="Tasa de clics" value={metrics.clickRate} delta={clickDelta} loading={firstLoad} tip={`${metrics.uniqueClicks}`}
              hint={metrics.uniqueOpens > 0 ? `${metrics.uniqueClicks} contactos · ${metrics.ctor} de quienes abren` : `${metrics.uniqueClicks} contactos hicieron clic`} onClick={() => openDetails('clicks')} />
            <Stat label="Tasa de respuesta" value={metrics.replyRate} loading={firstLoad} tip={`${metrics.replied}`}
              hint={`${metrics.replied} prospectos respondieron`} onClick={() => openDetails('replied')} />
          </StatGrid>
          <DeliveryStrip summary={deliverability} sent={metrics.sent} leads={leads} onChanged={fetchData} />
          {!isGlobalView && (
            <p className="-mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-500">
              {compare ? 'Las flechas comparan esta campaña con el promedio de todas tus campañas.' : <span />}
              <Link to={`/campanas/${encodeURIComponent(campaignSearch)}`} className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:text-brand-600">
                Ver reporte completo de la campaña <ChevronRight size={14} />
              </Link>
            </p>
          )}

          <Panel className="min-w-0" title="Actividad diaria" subtitle="Pulsa una serie para ocultarla o mostrarla"
            right={<div className="flex flex-wrap justify-end gap-x-4 gap-y-1 pt-1">{SERIES.map(([key, label, color]) => (
              <LegendDot key={key} color={color} label={label} active={!hiddenSeries.includes(key)} onClick={() => toggleSeries(key)} />
            ))}</div>}>
            <div className="h-64">
              {firstLoad ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      {SERIES.map(([key, , color]) => (
                        <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} stroke={COLORS.grid} />
                    <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} dy={8} minTickGap={24} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {SERIES.filter(([key]) => !hiddenSeries.includes(key)).map(([key, label, color]) => (
                      <Area key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} fill={`url(#fill-${key})`} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <DeviceHourCharts deviceBreakdown={deviceBreakdown} hourlyActivityData={hourlyActivityData} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Panel className="lg:col-span-3 min-w-0" title="Prospectos con más interés" subtitle="Los que más abren y hacen clic. Pulsa uno para ver su ficha" bodyClassName="!px-0 !pb-2">
              {hotLeads.length === 0 ? (
                <EmptyState className="py-6" title="Todavía no hay clics" text="Cuando alguien haga clic en un correo, aparecerá aquí para que le des seguimiento." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60">
                      <th className={ui.th}>Prospecto</th>
                      <th className={`${ui.th} hidden sm:table-cell`}>Fase</th>
                      <th className={`${ui.th} text-right`}>Aperturas</th>
                      <th className={`${ui.th} text-right`}>Clics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotLeads.slice(0, MAX_HOT).map(lead => (
                      <tr key={lead.email} onClick={() => navigate(`/audiencia?abrir=${encodeURIComponent(lead.email)}`)}
                        className="border-b border-slate-100 last:border-0 cursor-pointer transition-colors hover:bg-slate-50">
                        <td className="py-2.5 px-5 max-w-0 w-full">
                          <button type="button" className="block w-full truncate text-left font-medium text-slate-900 hover:text-brand-700 cursor-pointer">{lead.email}</button>
                          <span className="block text-xs text-slate-500">{lead.status || 'Pendiente'}</span>
                        </td>
                        <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap hidden sm:table-cell">Fase {Math.min(lead.fase || 1, 5)}</td>
                        <td className="py-2.5 px-5 text-right tabular-nums text-slate-700">{lead.displayOpens}</td>
                        <td className="py-2.5 px-5 text-right tabular-nums font-semibold text-slate-900">{lead.displayClicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {dueActions.length > 0 && isGlobalView ? (
            <Panel className="lg:col-span-2 min-w-0" title="Para hoy" subtitle={`${dueActions.length} ${dueActions.length === 1 ? 'seguimiento pendiente' : 'seguimientos pendientes'}`}
              right={<Link to="/audiencia" className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-700 hover:text-brand-600">Ver base <ChevronRight size={14} /></Link>}>
              <ul className="divide-y divide-slate-100 -my-1">
                {dueActions.slice(0, 6).map(lead => {
                  const overdue = String(lead.proxima_fecha).slice(0, 10) < today;
                  return (
                    <li key={lead.email}>
                      <button type="button" onClick={() => navigate(`/audiencia?abrir=${encodeURIComponent(lead.email)}`)}
                        className="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer group">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-rose-500' : 'bg-brand-600'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-900 group-hover:text-brand-700">{lead.proxima_accion}</span>
                          <span className="block truncate text-xs text-slate-500">{lead.nombre || lead.email}{lead.empresa ? ` · ${lead.empresa}` : ''}</span>
                        </span>
                        <span className={`shrink-0 text-xs ${overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{overdue ? 'Atrasada' : 'Hoy'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            ) : (
            <Panel className="lg:col-span-2 min-w-0" title="Actividad reciente" subtitle="Lo último que pasó con tus correos">
              {recentEvents.length === 0 ? (
                <EmptyState className="py-6" title="Sin movimientos" text="Aquí verás los envíos, aperturas y clics a medida que ocurran." />
              ) : (
                <ul className="divide-y divide-slate-100 -my-1">
                  {recentEvents.map((event, i) => (
                    <li key={`${event.type}-${event.date.getTime()}-${i}`} className="flex items-center gap-3 py-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EVENT_COLOR[event.type] }} aria-hidden="true" />
                      <p className="min-w-0 flex-1 line-clamp-2 sm:line-clamp-1 text-[13px] text-slate-600">{eventText(event)}</p>
                      <span className="shrink-0 text-xs text-slate-500 tabular-nums">{timeAgo(event.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Panel className="lg:col-span-3 min-w-0" title="Enlaces más clicados" subtitle="Qué links generan más interés" bodyClassName="!px-0 !pb-2">
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
                    {linkInsights.slice(0, MAX_LINKS).map((link) => (
                      <tr key={link.url} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 px-5 max-w-0 w-full">
                          <a href={link.url} target="_blank" rel="noreferrer" title={link.url} className="font-medium text-slate-900 hover:text-brand-700 truncate block">{link.alias}</a>
                          <span className="text-xs text-slate-500 truncate block">{link.url}</span>
                        </td>
                        <td className="py-2.5 px-5 text-right font-semibold tabular-nums">{link.total}</td>
                        <td className="py-2.5 px-5 text-right tabular-nums text-slate-600">{link.unique}</td>
                      </tr>
                    ))}
                    {linkInsights.length === 0 && (
                      <tr><td colSpan="3" className="py-8 text-center text-slate-500">Sin clics registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel className="lg:col-span-2" title="Prospectos por fase" subtitle={`${crmTotal} en la base de datos`}
              right={<Link to="/audiencia" className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-700 hover:text-brand-600">Ver base <ChevronRight size={14} /></Link>}>
              <div className="space-y-3.5 pt-1">
                {crmFunnel.map((step) => <BarRow key={step.name} label={step.name} value={step.value} max={crmMax} color={COLORS.navy} />)}
              </div>
            </Panel>
          </div>
        </>
      )}
      </div>

      <DetailsModal modalDetails={modalDetails} onClose={closeDetails} />
    </div>
  );
}
