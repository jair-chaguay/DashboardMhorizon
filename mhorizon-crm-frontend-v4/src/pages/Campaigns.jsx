import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, ArrowUpDown, RefreshCw, GitCompare, X, Download, ChevronRight, Pencil } from 'lucide-react';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import Tip from '../components/Tip';
import { LegendDot, Panel, RateBar, Stat, StatGrid } from '../components/analytics';
import { downloadCsv } from '../utils/csv';
import { toDayKey } from '../utils/dates';
import { COLORS, axisTick, selectClass, tooltipStyle, ui } from '../utils/theme';
import { notifyError, promptText } from '../utils/notify';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';

const ITEMS_PER_PAGE = 20;
const MAX_COMPARE = 4;
const NAME_MODE_KEY = 'campanas_modo_nombre';

const NAME_MODES = [
  ['alias', 'Provisional'],
  ['original', 'Original'],
];

function loadNameMode() {
  try { return window.localStorage.getItem(NAME_MODE_KEY) === 'original' ? 'original' : 'alias'; } catch { return 'alias'; }
}

const COMPARE_ROWS = [
  ['sent', 'Destinatarios', (v) => v],
  ['openRate', 'Apertura', (v) => `${v}%`],
  ['clickRate', 'Clics', (v) => `${v}%`],
  ['ctor', 'CTOR', (v) => `${v}%`],
  ['bounces', 'Rebotes', (v) => v, true],
  ['replies', 'Respuestas', (v) => v],
];

const COLUMNS = [
  { key: 'name', label: 'Campaña' },
  { key: 'lastDate', label: 'Enviada' },
  { key: 'sent', label: 'Destinatarios' },
  { key: 'openRate', label: 'Apertura' },
  { key: 'clickRate', label: 'Clics' },
  { key: 'bounces', label: 'Rebotes', delivery: true },
];

const sortValue = (camp, key) => {
  if (key === 'name') return camp.displayName.toLowerCase();
  if (key === 'lastDate') return camp.lastDate?.getTime() || 0;
  return Number(camp[key]) || 0;
};

export default function Campaigns() {
  const navigate = useNavigate();
  const { loading, error, fetchData, campaignsSummary: rawSummary, saveCampaignAlias } = useDashboardMetrics();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'lastDate', dir: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [nameMode, setNameMode] = useState(loadNameMode);

  const changeNameMode = (mode) => {
    setNameMode(mode);
    try { window.localStorage.setItem(NAME_MODE_KEY, mode); } catch { /* sin almacenamiento */ }
  };

  // El nombre provisional solo cambia lo que se ve; camp.name sigue identificando la campaña
  const campaignsSummary = useMemo(() => rawSummary.map(c => ({
    ...c, displayName: nameMode === 'alias' && c.alias ? c.alias : c.name,
  })), [rawSummary, nameMode]);

  const editAlias = async (camp) => {
    const alias = await promptText({
      title: 'Nombre provisional', text: `Original: ${camp.name}. Déjalo vacío para quitarlo.`,
      placeholder: 'Ej. Promo noviembre', initialValue: camp.alias, allowEmpty: true,
    });
    if (alias === null || alias === camp.alias) return;
    try {
      await saveCampaignAlias(camp.name, alias);
    } catch (err) {
      console.error('Error guardando el nombre provisional: ', err);
      notifyError('No se pudo guardar el nombre provisional.');
    }
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = campaignsSummary.filter(c => [c.name, c.alias, c.subject].some(v => v?.toLowerCase().includes(term)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }, [campaignsSummary, search, sort]);

  const totalPages = Math.max(Math.ceil(rows.length / ITEMS_PER_PAGE), 1);
  const page = Math.min(currentPage, totalPages);
  const pageRows = rows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalSent = campaignsSummary.reduce((acc, c) => acc + c.sent, 0);
  const avg = (key) => campaignsSummary.length
    ? (campaignsSummary.reduce((acc, c) => acc + Number(c[key]), 0) / campaignsSummary.length).toFixed(1)
    : '0.0';

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
    setCurrentPage(1);
  };

  const toggleSelected = (name) => setSelected(prev =>
    prev.includes(name) ? prev.filter(n => n !== name) : prev.length < MAX_COMPARE ? [...prev, name] : prev);
  const compared = campaignsSummary.filter(c => selected.includes(c.name));

  // La columna de rebotes solo aparecen cuando el servidor ya envía esos datos
  const hasDelivery = campaignsSummary.some(c => c.bounces > 0);
  const columns = COLUMNS.filter(col => !col.delivery || hasDelivery);

  const exportCsv = () => downloadCsv(`campanas-${toDayKey(new Date())}.csv`, [
    ['Campaña', 'Nombre provisional', 'Asunto', 'Último movimiento', 'Destinatarios', 'Entregados', 'Apertura (%)', 'Clics (%)', 'CTOR (%)', 'Rebotes duros', 'Rebotes suaves', 'Desuscritos', 'Spam', 'Respondieron'],
    ...rows.map(c => [c.name, c.alias, c.subject, c.dateStr, c.sent, c.delivered, c.openRate, c.clickRate, c.ctor, c.hardBounces, c.softBounces, c.unsubscribed, c.spam, c.replies]),
  ]);

  const openReport = (name) => navigate(`/campanas/${encodeURIComponent(name)}`);

  // Tendencia: apertura y clics de cada campaña en el orden en que se enviaron
  const trend = useMemo(() => [...campaignsSummary]
    .sort((a, b) => (a.lastDate?.getTime() || 0) - (b.lastDate?.getTime() || 0))
    .map(c => ({ name: c.displayName, apertura: Number(c.openRate), clics: Number(c.clickRate) })), [campaignsSummary]);

  return (
    <div className="space-y-5">
      <PageHeader description="Todos tus envíos con sus resultados. Pulsa una campaña para ver su reporte, o márcala y usa «Cambiar nombre» para ponerle un nombre provisional."
        actions={<>
          <button onClick={fetchData} disabled={loading} title="Actualizar datos" aria-label="Actualizar datos" className={ui.iconBtn}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => editAlias(compared[0])} disabled={selected.length !== 1}
            title={selected.length !== 1 ? 'Marca una campaña en la tabla para cambiarle el nombre' : 'Cambiar el nombre provisional de la campaña marcada'} className={ui.btn}>
            <Pencil size={16} /> Cambiar nombre
          </button>
          <button onClick={() => setCompareOpen(true)} disabled={selected.length < 2}
            title={selected.length < 2 ? 'Marca al menos 2 campañas en la tabla' : 'Comparar las campañas marcadas'} className={ui.btn}>
            <GitCompare size={16} /> Comparar{selected.length > 0 ? ` (${selected.length})` : ''}
          </button>
          <button onClick={exportCsv} disabled={rows.length === 0} title="Descargar la tabla" className={ui.btn}>
            <Download size={16} /> Exportar CSV
          </button>
        </>}>
        Campañas
      </PageHeader>

      {error && <div className="p-3 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-100">{error}</div>}

      <StatGrid>
        {[
          ['Correos enviados', totalSent.toLocaleString('es-EC'), 'En todas las campañas'],
          ['Apertura promedio', `${avg('openRate')}%`, 'Por campaña'],
          ['Clics promedio', `${avg('clickRate')}%`, 'Por campaña'],
          ['Campañas', campaignsSummary.length, 'Enviadas hasta hoy'],
        ].map(([label, value, hint]) => (
          <Stat key={label} label={label} value={value} hint={hint} animate={false} loading={loading && campaignsSummary.length === 0} />
        ))}
      </StatGrid>

      {trend.length >= 2 && (
        <Panel className="min-w-0" title="Tendencia entre campañas" subtitle="Apertura y clics de cada envío, del más antiguo al más reciente"
          right={<div className="flex gap-4 pt-1"><LegendDot color={COLORS.opens} label="Apertura" /><LegendDot color={COLORS.clicks} label="Clics" /></div>}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="apertura" name="Apertura" stroke={COLORS.opens} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="clics" name="Clics" stroke={COLORS.clicks} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <section className={`${ui.card} overflow-hidden`}>
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Buscar campaña..." aria-label="Buscar campaña"
              className={`${ui.input} w-full sm:w-72 pl-9`} />
          </div>
          <select className={selectClass} value={`${sort.key}:${sort.dir}`} aria-label="Ordenar"
            onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }); }}>
            <option value="lastDate:desc">Más recientes primero</option>
            <option value="lastDate:asc">Más antiguas primero</option>
            <option value="openRate:desc">Mayor apertura</option>
            <option value="clickRate:desc">Mayores clics</option>
            <option value="sent:desc">Más destinatarios</option>
            <option value="name:asc">Nombre (A-Z)</option>
          </select>
          <div className="inline-flex items-center gap-2 text-[13px] text-slate-500">
            Ver nombre
            <div role="group" aria-label="Qué nombre mostrar" className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {NAME_MODES.map(([mode, label]) => (
                <button key={mode} onClick={() => changeNameMode(mode)} aria-pressed={nameMode === mode}
                  title={mode === 'alias' ? 'Muestra el nombre provisional cuando la campaña tenga uno' : 'Muestra el nombre con el que llegó la campaña'}
                  className={`px-3 h-8 rounded-md text-sm font-semibold cursor-pointer transition-colors ${nameMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                <th className="py-3 pl-5 w-8"><span className="sr-only">Comparar</span></th>
                {columns.map(col => (
                  <th key={col.key} className={ui.th} aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    <button onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      {col.label}<ArrowUpDown size={12} className={sort.key === col.key ? 'text-slate-700' : 'text-slate-300'} />
                    </button>
                  </th>
                ))}
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map(camp => (
                <tr key={camp.name} onClick={() => openReport(camp.name)} className={`group border-t border-slate-100 first:border-t-0 cursor-pointer transition-colors hover:bg-slate-50 ${selected.includes(camp.name) ? 'bg-brand-50/50' : ''}`}>
                  <td className="py-3 pl-5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Comparar ${camp.name}`} checked={selected.includes(camp.name)} onChange={() => toggleSelected(camp.name)}
                      disabled={!selected.includes(camp.name) && selected.length >= MAX_COMPARE} className="h-4 w-4 rounded accent-brand-600 cursor-pointer disabled:cursor-not-allowed" />
                  </td>
                  <td className="py-3 px-5 min-w-48">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 group-hover:text-brand-700">{camp.displayName}</span>
                      <button onClick={(e) => { e.stopPropagation(); editAlias(camp); }} aria-label={`Cambiar nombre provisional de ${camp.name}`}
                        title={camp.alias ? 'Cambiar nombre provisional' : 'Poner nombre provisional'}
                        className="h-6 w-6 inline-grid place-items-center rounded text-slate-400 hover:text-brand-700 hover:bg-slate-100 cursor-pointer"><Pencil size={14} /></button>
                    </span>
                    {camp.alias && (
                      <span className="block max-w-64 truncate text-xs text-slate-400" title={nameMode === 'alias' ? camp.name : camp.alias}>
                        {nameMode === 'alias' ? `Original: ${camp.name}` : `Provisional: ${camp.alias}`}
                      </span>
                    )}
                    {camp.subject && camp.subject !== camp.displayName && <span className="block max-w-64 truncate text-xs text-slate-500" title={camp.subject}>{camp.subject}</span>}
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <span className="text-slate-700">{camp.dateStr}</span>
                  </td>
                  <td className="py-3 px-5 tabular-nums text-slate-700">{camp.sent}</td>
                  <td className="py-3 px-5">
                    <RateBar value={camp.openRate} tip={`${camp.openCount}`} />
                  </td>
                  <td className="py-3 px-5"><RateBar value={camp.clickRate} tip={`${camp.clickCount}`} /></td>
                  {hasDelivery && (
                    <td className="py-3 px-5 tabular-nums text-slate-700 whitespace-nowrap">
                      <Tip text={camp.bounces === 0 ? '' : camp.hasBounceTypes ? `${camp.hardBounces} ${camp.hardBounces === 1 ? 'duro' : 'duros'} · ${camp.softBounces} ${camp.softBounces === 1 ? 'suave' : 'suaves'}` : 'Aún sin distinguir duros y suaves'}>{camp.bounces}</Tip>
                    </td>
                  )}
                  <td className="py-3 pr-3 w-10 text-right">
                    <button onClick={(e) => { e.stopPropagation(); openReport(camp.name); }} aria-label={`Ver reporte de ${camp.name}`} title="Ver reporte"
                      className="h-8 w-8 inline-grid place-items-center rounded-md text-slate-400 group-hover:text-brand-700 cursor-pointer"><ChevronRight size={16} /></button>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (loading && campaignsSummary.length === 0 ? [0, 1, 2].map(i => (
                <tr key={i} className="border-t border-slate-100"><td colSpan={columns.length + 2} className="px-5 py-4"><Skeleton className="h-6 w-full" /></td></tr>
              )) : (
                <tr><td colSpan={columns.length + 2}>
                  {search
                    ? <EmptyState title="Ninguna campaña coincide" text="Prueba con otro nombre." />
                    : <EmptyState title="Aún no hay campañas" text="Cuando envíes tu primera campaña aparecerá aquí con sus resultados."
                        action={<Link to="/difusion-manual" className={ui.btnPrimary}>Crear campaña</Link>} />}
                </td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-sm text-slate-500">Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(page * ITEMS_PER_PAGE, rows.length)} de {rows.length} campañas</span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(Math.max(page - 1, 1))} disabled={page === 1} className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer">Anterior</button>
              <button onClick={() => setCurrentPage(Math.min(page + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer">Siguiente</button>
            </div>
          </div>
        )}
      </section>

      <Modal isOpen={compareOpen} onClose={() => setCompareOpen(false)} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Comparar campañas</h3>
          <button onClick={() => setCompareOpen(false)} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="overflow-auto p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-3 pr-4 w-32" />
                {compared.map(c => <th key={c.name} className="pb-3 px-3 font-semibold text-slate-900 align-bottom">{c.displayName}<span className="block text-xs font-normal text-slate-500">{c.dateStr}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(([key, label, format, lowerIsBetter]) => {
                const values = compared.map(c => Number(c[key]));
                const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
                const hasBest = lowerIsBetter ? values.some(v => v !== best) : best > 0;
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="py-3 pr-4 text-[13px] text-slate-500">{label}</td>
                    {compared.map(c => (
                      <td key={c.name} className="py-3 px-3">
                        <span className={`tabular-nums text-lg font-semibold ${Number(c[key]) === best && hasBest ? 'text-brand-600' : 'text-slate-900'}`}>{format(c[key])}</span>
                        {Number(c[key]) === best && hasBest && <span className="ml-2 text-xs font-medium text-brand-600">mejor</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={() => { setSelected([]); setCompareOpen(false); }} className="mt-5 text-sm font-semibold text-slate-500 hover:text-slate-900 cursor-pointer">Limpiar selección</button>
        </div>
      </Modal>
    </div>
  );
}
