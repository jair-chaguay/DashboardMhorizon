import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, ArrowLeft, ChevronRight } from 'lucide-react';
import DetailsModal from '../components/DetailsModal';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { COLORS, tooltipStyle, axisTick, selectClass, ui } from '../utils/theme';

// Colores de marca para la dona de dispositivos
const DEVICE_COLORS = { 'Móvil': COLORS.clicks, 'Escritorio': COLORS.opens, 'Desconocido': COLORS.gray };

const MetricBox = ({ label, value }) => (
  <div>
    <div className="text-[26px] leading-none font-bold text-slate-900 tabular-nums tracking-tight">{value}</div>
    <div className="mt-2 text-[13px] text-slate-500">{label}</div>
  </div>
);

const MiniStat = ({ label, value, color }) => (
  <div className="flex items-center gap-2">
    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  </div>
);

const LegendDot = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
  </span>
);

const pagerBtn = "px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer";

export default function Dashboard() {
  // ESTADOS DE VISTA Y PAGINACIÓN
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'detail'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Llamamos al hook que extrajimos previamente
  const {
    loading, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    uniqueCampaigns, isGlobalView, metrics, funnelData, crmFunnelData, linkInsights, deviceData,
    timeSeriesData, hourlyActivityData, campaignsSummary,
    modalDetails, setModalDetails, openDetails
  } = useDashboardMetrics(true, () => {
    // Si el token expira, recargamos la página para que App.jsx lo envíe al Login
    window.location.reload();
  });

  // Lógica de Paginación
  const totalPages = Math.ceil((campaignsSummary?.length || 0) / ITEMS_PER_PAGE);
  const paginatedCampaigns = (campaignsSummary || []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Funciones de navegación
  const handleViewReport = (campaignName) => {
    setCampaignSearch(campaignName);
    setDateFilter('Todos');
    setViewMode('detail');
  };

  const handleGlobalReport = () => {
    setCampaignSearch('');
    setDateFilter('Todos');
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setCampaignSearch('');
    setViewMode('list');
  };

  const refreshButton = (
    <button onClick={fetchData} disabled={loading} title="Actualizar datos" aria-label="Actualizar datos" className={ui.iconBtn}>
      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
    </button>
  );

  return (
    <div>
      {/* VISTA 1: TABLA DE CAMPAÑAS (PAGINADA) */}
      {viewMode === 'list' && (
        <div className="space-y-5">
          <PageHeader description="Todos tus envíos con sus resultados. Pulsa una campaña para ver su reporte."
            actions={<>
              {refreshButton}
              <button onClick={handleGlobalReport} className={ui.btn}>Ver reporte global CRM</button>
            </>}>
            Campañas recientes
          </PageHeader>

          <section className={`${ui.card} overflow-hidden`}>
            {campaignsSummary.length === 0 && !loading ? (
              <div className="text-center py-12 text-sm text-slate-500">No hay campañas registradas todavía.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100">
                      <th className={ui.th}>Campaña</th>
                      <th className={ui.th}>Público</th>
                      <th className={ui.th}>Apertura</th>
                      <th className={ui.th}>Clics</th>
                      <th className="py-2.5 px-5" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCampaigns.map((camp, idx) => (
                      <tr key={idx} onClick={() => handleViewReport(camp.name)} className="group border-t border-slate-100 first:border-t-0 cursor-pointer transition-colors hover:bg-slate-50">
                        <td className="py-3 px-5 min-w-48">
                          <span className="block font-semibold text-slate-900 group-hover:text-brand-700">{camp.name}</span>
                          <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">Enviado</span>
                            {camp.dateStr}
                          </span>
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">
                          <span className="block text-slate-700">MHORIZON ECUADOR</span>
                          <span className="block text-xs text-slate-500 tabular-nums">{camp.sent} destinatarios</span>
                        </td>
                        <td className="py-3 px-5 text-sm font-semibold text-slate-800 tabular-nums">{camp.openRate}%</td>
                        <td className="py-3 px-5 text-sm font-semibold text-slate-800 tabular-nums">{camp.clickRate}%</td>
                        <td className="py-3 pr-3 w-10 text-right">
                          <button onClick={(e) => { e.stopPropagation(); handleViewReport(camp.name); }} aria-label={`Ver reporte de ${camp.name}`} title="Ver reporte"
                            className="h-8 w-8 inline-grid place-items-center rounded-md text-slate-400 group-hover:text-brand-700 cursor-pointer"><ChevronRight size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONTROLES DE PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-sm text-slate-500">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, campaignsSummary.length)} de {campaignsSummary.length} campañas
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={pagerBtn}>Anterior</button>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className={pagerBtn}>Siguiente</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* VISTA 2: DASHBOARD DETALLADO */}
      {viewMode === 'detail' && (
        <div className="space-y-5">
          <button onClick={handleBackToList} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer">
            <ArrowLeft size={15} /> Volver a la lista
          </button>

          <PageHeader description={isGlobalView ? 'Resultados de todas las campañas.' : `Resultados de «${campaignSearch}».`}
            actions={<>
              <input list="campaign-options" placeholder="Buscar campaña..." aria-label="Buscar campaña"
                className={`${ui.input} w-full sm:w-64`}
                value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} />
              <datalist id="campaign-options">
                {uniqueCampaigns.map((camp, idx) => <option key={idx} value={camp} />)}
              </datalist>
              <select className={selectClass} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Periodo">
                <option value="Todos">Todo el tiempo</option>
                <option value="7dias">Últimos 7 días</option>
                <option value="esteMes">Este mes</option>
              </select>
              {refreshButton}
            </>}>
            {isGlobalView ? 'Reporte global del CRM' : campaignSearch}
          </PageHeader>

          {/* Fila 1: KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Panel title="Entrega"
              right={<button onClick={() => openDetails('sent')} className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">Ver detalles <ChevronRight size={14} /></button>}>
              <div className="grid grid-cols-3 gap-4 pt-1">
                <MetricBox label="Tasa de entrega" value={metrics.deliveryRate} />
                <MetricBox label="Bloqueado" value={metrics.blocked} />
                <MetricBox label="Falló" value={metrics.failed} />
              </div>
            </Panel>

            <Panel title="Interacciones"
              right={<button onClick={() => openDetails('opens')} className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">Ver detalles <ChevronRight size={14} /></button>}>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 pt-1">
                <MetricBox label="Apertura" value={metrics.openRate} />
                <MetricBox label="Clics" value={metrics.clickRate} />
                <MetricBox label="CTOR" value={metrics.ctor} />
                <MetricBox label="Spam" value={metrics.spam} />
                <MetricBox label="Desuscrito" value={metrics.unsubscribed} />
              </div>
            </Panel>
          </div>

          {/* Fila 2: Embudos y Tendencias */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Panel className="min-w-0" title="Tendencia de entrega">
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COLORS.grid} />
                    <XAxis dataKey="date" tick={axisTick} dy={8} axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="sent" name="Enviados" stroke={COLORS.navy} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                <MiniStat label="Enviado" value={metrics.sent} color={COLORS.sent} />
                <MiniStat label="Entregado" value={metrics.delivered} color={COLORS.navy} />
                <MiniStat label="Aperturas" value={metrics.uniqueOpens} color={COLORS.opens} />
                <MiniStat label="Clics" value={metrics.uniqueClicks} color={COLORS.clicks} />
              </div>
            </Panel>

            <Panel className="min-w-0" title="Embudo de entrega">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ right: 30, left: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={100} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill={COLORS.navy} barSize={12} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: COLORS.axis, fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="min-w-0" title="Embudo comercial">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={crmFunnelData} layout="vertical" margin={{ right: 30, left: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={axisTick} width={120} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill={COLORS.primary} barSize={12} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: COLORS.axis, fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Fila 3: Dispositivos, Calor y Links */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Panel className="min-w-0" title="Dispositivos"
              right={deviceData.length > 0 && <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 pt-1">{deviceData.map(d => <LegendDot key={d.name} color={DEVICE_COLORS[d.name]} label={d.name} />)}</div>}>
              <div className="h-48 w-full flex items-center justify-center">
                {deviceData.length === 0 ? <span className="text-slate-500 text-sm">Esperando datos...</span> :
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deviceData} innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                      {deviceData.map((e, i) => <Cell key={i} fill={DEVICE_COLORS[e.name] || e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>}
              </div>
            </Panel>

            <Panel className="min-w-0" title="Actividad por hora"
              right={<div className="flex gap-3 pt-1"><LegendDot color={COLORS.opens} label="Aperturas" /><LegendDot color={COLORS.clicks} label="Clics" /></div>}>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyActivityData} margin={{ top: 5, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COLORS.grid} />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ ...axisTick, fontSize: 10 }} interval={3} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="aperturas" name="Aperturas" stackId="a" fill={COLORS.opens} />
                    <Bar dataKey="clics" name="Clics" stackId="a" fill={COLORS.clicks} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="min-w-0" title="Enlaces más clicados" bodyClassName="!px-0 !pb-2">
              <div className="overflow-y-auto max-h-48">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60">
                      <th className={ui.th}>Enlace</th>
                      <th className={`${ui.th} text-right`}>Clics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkInsights.map((link, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 px-5 max-w-0 w-full">
                          <a href={link.url} target="_blank" rel="noreferrer" title={link.url} className="font-medium text-slate-900 hover:text-brand-700 truncate block">{link.url}</a>
                        </td>
                        <td className="py-2.5 px-5 text-right font-semibold tabular-nums">{link.total}</td>
                      </tr>
                    ))}
                    {linkInsights.length === 0 && (
                      <tr><td colSpan="2" className="py-8 text-center text-slate-500">Sin clics registrados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* MODAL (Extraído e importado) */}
      <DetailsModal modalDetails={modalDetails} setModalDetails={setModalDetails} />
    </div>
  );
}
