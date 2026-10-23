import { useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UploadCloud, Search, Tag, X, Trash2, ArrowUpDown, Download } from 'lucide-react';
import api from '../api/api';
import Modal from '../components/Modal';
import ContactDrawer from '../components/ContactDrawer';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';
import { selectClass, ui } from '../utils/theme';
import { useLeads } from '../hooks/useLeads';
import { useEmailLogs } from '../hooks/useEmailLogs';
import { downloadCsv } from '../utils/csv';
import { toDayKey } from '../utils/dates';
import { formatSize } from '../utils/files';
import { parseTags } from '../utils/tags';
import { isReplied, statusDot } from '../utils/status';
import { confirmAction, notifyError, notifySuccess } from '../utils/notify';
import { DELIVERED_FLAG, deliveryFlag, summarizeDeliverability } from '../utils/deliverability';

const PAGE_SIZE = 25;
const FASES = [1, 2, 3, 4, 5];
const EMPTY_TAG_MODAL = { isOpen: false, emails: [] };
const faseOf = (lead) => lead.fase || 1;
const estadoOf = (lead) => lead.status || 'Pendiente';
// Para seguimiento: hizo clic en algún correo y todavía no ha respondido
const SEGUIMIENTO = '__seguimiento';
const needsFollowUp = (lead) => (lead.clicks || 0) > 0 && !isReplied(estadoOf(lead));
const REBOTE = '__rebote';
const BAJA = '__baja';
const ACCION = '__accion';
// Próxima acción con fecha de hoy o anterior (fecha en formato AAAA-MM-DD)
const accionVencida = (lead, today) => !!lead.proxima_fecha && String(lead.proxima_fecha).slice(0, 10) <= today;

export default function Audience() {
  const { leads, loading, fetchLeads, tags: etiquetasUnicas } = useLeads();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [etiquetasUpload, setEtiquetasUpload] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('Todas');
  const [filtroFase, setFiltroFase] = useState('Todas');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [sort, setSort] = useState({ key: 'email', dir: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [working, setWorking] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef(null);

  // La ficha del prospecto se puede abrir desde otra página con ?abrir=correo
  const [searchParams, setSearchParams] = useSearchParams();
  const [openEmail, setOpenEmail] = useState(searchParams.get('abrir'));
  const openLead = leads.find(l => l.email === openEmail) || null;
  // Los registros se cargan siempre: marcan rebotes y bajas en la tabla y alimentan el historial de la ficha
  const { logs: activityLogs, loading: loadingLogs } = useEmailLogs(true);
  const delivery = useMemo(() => summarizeDeliverability(activityLogs), [activityLogs]);
  const today = toDayKey(new Date());
  const closeLead = () => {
    setOpenEmail(null);
    if (searchParams.has('abrir')) {
      const next = new URLSearchParams(searchParams);
      next.delete('abrir');
      setSearchParams(next, { replace: true });
    }
  };

  const [modalTag, setModalTag] = useState(EMPTY_TAG_MODAL);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');

  const closeTagModal = () => { setModalTag(EMPTY_TAG_MODAL); setNuevaEtiqueta(''); };

  const faseCounts = useMemo(() => {
    const counts = Object.fromEntries(FASES.map(f => [f, 0]));
    leads.forEach(l => { const f = Math.min(faseOf(l), 5); counts[f] = (counts[f] || 0) + 1; });
    return counts;
  }, [leads]);

  const estados = useMemo(() => Array.from(new Set(leads.map(estadoOf))), [leads]);
  const followUpCount = useMemo(() => leads.filter(needsFollowUp).length, [leads]);
  const accionCount = useMemo(() => leads.filter(l => accionVencida(l, today)).length, [leads, today]);
  const reboteCount = useMemo(() => leads.filter(l => delivery.hard.has(l.email) || delivery.unknown.has(l.email)).length, [leads, delivery]);
  const bajaCount = useMemo(() => leads.filter(l => delivery.unsub.has(l.email) || delivery.spam.has(l.email)).length, [leads, delivery]);
  const shortcuts = [
    [SEGUIMIENTO, 'Para seguimiento', followUpCount, 'Hicieron clic en un correo y todavía no han respondido'],
    [ACCION, 'Acciones para hoy', accionCount, 'Próxima acción para hoy o atrasada'],
    [REBOTE, 'Rebote duro', reboteCount, 'Correos que no existen o están bloqueados'],
    [BAJA, 'Desuscritos o spam', bajaCount, 'No conviene volver a escribirles'],
  ].filter(([, , count]) => count > 0);

  const leadsFiltrados = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const dir = sort.dir === 'asc' ? 1 : -1;
    return leads
      .filter(l => {
        if (search && ![l.email, l.nombre, l.empresa, l.telefono].some(v => String(v || '').toLowerCase().includes(search))) return false;
        if (filtroEstado === SEGUIMIENTO) { if (!needsFollowUp(l)) return false; }
        else if (filtroEstado === ACCION) { if (!accionVencida(l, today)) return false; }
        else if (filtroEstado === REBOTE) { if (!delivery.hard.has(l.email) && !delivery.unknown.has(l.email)) return false; }
        else if (filtroEstado === BAJA) { if (!delivery.unsub.has(l.email) && !delivery.spam.has(l.email)) return false; }
        else if (filtroEstado !== 'Todos' && estadoOf(l) !== filtroEstado) return false;
        if (filtroFase !== 'Todas' && Math.min(faseOf(l), 5) !== filtroFase) return false;
        if (filtroEtiqueta === 'Todas') return true;
        const tags = parseTags(l.etiquetas);
        if (filtroEtiqueta === 'SinEtiqueta') return tags.length === 0;
        return tags.includes(filtroEtiqueta);
      })
      .sort((a, b) => {
        const sortValue = (l) => sort.key === 'fase' ? faseOf(l) : sort.key === 'nombre' ? (l.nombre || '').toLowerCase() || '\uffff' : (l.email || '').toLowerCase();
        const va = sortValue(a), vb = sortValue(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
      });
  }, [leads, searchTerm, filtroEtiqueta, filtroFase, filtroEstado, sort, delivery, today]);

  const totalPages = Math.max(Math.ceil(leadsFiltrados.length / PAGE_SIZE), 1);
  const page = Math.min(currentPage, totalPages);
  const pageRows = leadsFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageEmails = pageRows.map(l => l.email);
  const allPageSelected = pageEmails.length > 0 && pageEmails.every(e => selected.includes(e));

  const resetView = (fn) => (value) => { fn(value); setCurrentPage(1); };
  const toggleSort = (key) => setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  const toggleOne = (email) => setSelected(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  const togglePage = () => setSelected(prev => allPageSelected ? prev.filter(e => !pageEmails.includes(e)) : [...new Set([...prev, ...pageEmails])]);

  const handleQuitarEtiqueta = async (email, etiquetaQuitar) => {
    try {
      await api.post('/leads/etiquetas/remove', { email, etiqueta: etiquetaQuitar });
      fetchLeads();
    } catch (error) {
      console.error('Error al quitar la etiqueta', error);
      notifyError('No se pudo quitar la etiqueta.');
    }
  };

  // Elimina uno o varios prospectos con el mismo endpoint de siempre, uno por correo
  const handleEliminar = async (emails) => {
    const many = emails.length > 1;
    const confirmed = await confirmAction({
      title: many ? `¿Eliminar ${emails.length} prospectos?` : '¿Eliminar prospecto?',
      text: many ? 'Se eliminarán permanentemente de la base de datos.' : `Se eliminará permanentemente a ${emails[0]} de la base de datos.`,
      confirmText: 'Sí, eliminar',
      danger: true,
    });
    if (!confirmed) return;

    setWorking(true);
    const results = await Promise.allSettled(emails.map(email => api.post('/leads/delete', { email })));
    const failed = results.filter(r => r.status === 'rejected').length;
    setSelected(prev => prev.filter(e => !emails.includes(e)));
    await fetchLeads();
    setWorking(false);
    if (failed) notifyError(`No se pudieron eliminar ${failed} de ${emails.length} prospectos.`);
    else notifySuccess(many ? `Se eliminaron ${emails.length} prospectos.` : 'El prospecto se eliminó satisfactoriamente.');
  };

  const pickFile = (picked) => {
    if (!picked) return;
    if (!/\.csv$/i.test(picked.name)) {
      setMessage({ type: 'error', text: 'El archivo debe ser un CSV (.csv).' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setMessage(null);
    setFile(picked);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  };
  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('csv_file', file);
    if (etiquetasUpload.trim() !== '') formData.append('etiquetas', etiquetasUpload);

    try {
      await api.post('/leads/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage({ type: 'success', text: 'Base de datos cargada y etiquetas asignadas correctamente.' });
      setFile(null);
      setEtiquetasUpload('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchLeads();
    } catch (error) {
      const detail = error?.response?.data?.message;
      setMessage({ type: 'error', text: detail ? `Hubo un error al subir el archivo CSV: ${detail}` : 'Hubo un error al subir el archivo CSV.' });
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  // Datos de contacto y seguimiento. Requiere el endpoint POST /leads/update en el backend (ver BACKEND.md)
  const handleGuardarContacto = async (email, campos) => {
    try {
      await api.post('/leads/update', { email, ...campos });
      await fetchLeads();
      return true;
    } catch (error) {
      console.error('Error al guardar los datos del prospecto', error);
      const status = error?.response?.status;
      notifyError(status === 404 || status === 405
        ? 'El servidor todavía no permite guardar estos datos. Hay que crear el endpoint /leads/update.'
        : 'No se pudieron guardar los datos del prospecto.');
      return false;
    }
  };

  const handleAgregarEtiqueta = async (e) => {
    e.preventDefault();
    if (!nuevaEtiqueta.trim()) return;
    const emails = modalTag.emails;
    setWorking(true);
    const results = await Promise.allSettled(emails.map(email => api.post('/leads/etiquetas', { email, etiquetas: nuevaEtiqueta })));
    const failed = results.filter(r => r.status === 'rejected').length;
    closeTagModal();
    await fetchLeads();
    setWorking(false);
    if (failed) notifyError(`No se pudo etiquetar a ${failed} de ${emails.length} prospectos.`);
    else if (emails.length > 1) setSelected([]);
  };

  const exportCsv = () => downloadCsv(`prospectos-${toDayKey(new Date())}.csv`, [
    ['Correo', 'Nombre', 'Empresa', 'Teléfono', 'Responsable', 'Fase', 'Estado', 'Entrega', 'Etiquetas', 'Enviados', 'Aperturas', 'Clics', 'Próxima acción', 'Fecha', 'Notas'],
    ...leadsFiltrados.map(l => [l.email, l.nombre, l.empresa, l.telefono, l.responsable, Math.min(faseOf(l), 5), estadoOf(l), deliveryFlag(l.email, delivery)?.label || '',
      parseTags(l.etiquetas).join(' | '), l.sent || 0, l.opens || 0, l.clicks || 0, l.proxima_accion, l.proxima_fecha, l.notas]),
  ]);

  const sortHeader = (key, label, align = '') => (
    <th className={`${ui.th} ${align}`} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-900">
        {label}<ArrowUpDown size={12} className={sort.key === key ? 'text-slate-700' : 'text-slate-300'} />
      </button>
    </th>
  );

  const emptyRow = (content) => <tr><td colSpan="10">{content}</td></tr>;
  const skeletonRows = [0, 1, 2, 3, 4].map(i => (
    <tr key={i} className="border-t border-slate-100"><td colSpan="10" className="px-5 py-3.5"><Skeleton className="h-5 w-full" /></td></tr>
  ));

  return (
    <div className="space-y-5">
      <PageHeader description="Tus prospectos con su fase, estado, actividad y etiquetas."
        actions={<button type="button" onClick={() => setShowUpload(v => !v)} aria-expanded={showUpload || leads.length === 0} className={ui.btn}>
          <UploadCloud size={16} /> Cargar CSV
        </button>}>
        Base de datos
      </PageHeader>

      {/* Carga masiva: se muestra al pulsar "Cargar CSV" o si la base está vacía */}
      {(showUpload || (!loading && leads.length === 0)) && (
      <section className={`${ui.card} p-5 animate-slide-down`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Cargar prospectos desde CSV</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Las etiquetas que escribas se asignan a todos los prospectos del archivo.</p>
          </div>
          {leads.length > 0 && <button type="button" onClick={() => setShowUpload(false)} aria-label="Cerrar carga de CSV" className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X size={16} /></button>}
        </div>
        <form onSubmit={handleUpload} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
            className={`relative w-full md:flex-1 min-w-0 h-10 shrink-0 flex items-center gap-3 px-3 rounded-lg border border-dashed transition-colors ${dragging ? 'border-brand-600 bg-brand-50' : file ? 'border-slate-300 bg-slate-50' : 'border-slate-300 hover:border-slate-400'}`}>
            <input ref={fileInputRef} id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => pickFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Elegir archivo CSV" />
            <UploadCloud size={17} className={`shrink-0 ${file ? 'text-brand-600' : 'text-slate-400'}`} />
            {file ? (
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{file.name} <span className="font-normal text-slate-500">· {formatSize(file.size)}</span></span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500"><span className="font-semibold text-slate-700">Elegir archivo CSV</span> o arrástralo aquí</span>
            )}
            {file && (
              <button type="button" onClick={clearFile} aria-label="Quitar archivo" className="relative z-10 shrink-0 h-6 w-6 grid place-items-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"><X size={14} /></button>
            )}
          </div>
          <input type="text" placeholder="Etiquetas (ej. VIP, Evento)" value={etiquetasUpload} onChange={(e) => setEtiquetasUpload(e.target.value)} aria-label="Etiquetas para el archivo"
            className={`${ui.input} w-full md:w-64`} />
          <button type="submit" disabled={!file || uploading} className={`${ui.btnPrimary} px-5 whitespace-nowrap`}>
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </button>
        </form>
        <StatusMessage message={message} className="mt-4 p-3 rounded-lg" />
      </section>
      )}

      {/* Directorio */}
      <section className={`${ui.card} overflow-hidden`}>
        {/* Atajos: lo que requiere atención, en una sola línea */}
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <span className="mr-1 text-[13px] text-slate-500">Atención:</span>
            {shortcuts.map(([key, label, count, hint]) => {
              const active = filtroEstado === key;
              return (
                <button key={key} type="button" title={hint} aria-pressed={active} onClick={() => resetView(setFiltroEstado)(active ? 'Todos' : key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium cursor-pointer transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
                  {label} <span className={`tabular-nums text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Fases como pestañas: al pulsar una se filtra la tabla */}
        <div className="flex gap-1 overflow-x-auto px-3 pt-3 border-b border-slate-100" role="tablist" aria-label="Filtrar por fase">
          {[['Todas', 'Todos', leads.length], ...FASES.map(f => [f, `Fase ${f}`, faseCounts[f]])].map(([value, label, count]) => {
            const active = filtroFase === value;
            return (
              <button key={value} role="tab" aria-selected={active} onClick={() => resetView(setFiltroFase)(value)}
                className={`relative shrink-0 px-3 pb-3 pt-1 text-sm cursor-pointer transition-colors ${active ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                {label} <span className={`ml-1 tabular-nums text-xs ${active ? 'text-slate-700' : 'text-slate-400'}`}>{count}</span>
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar correo, nombre o empresa..." aria-label="Buscar prospecto" value={searchTerm} onChange={(e) => resetView(setSearchTerm)(e.target.value)}
              className={`${ui.input} pl-9 w-full`} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:ml-auto sm:items-center">
            <span className="text-[13px] text-slate-500 hidden sm:inline mr-1">{leadsFiltrados.length} de {leads.length}</span>
            <select value={filtroEstado} onChange={(e) => resetView(setFiltroEstado)(e.target.value)} className={`${selectClass} w-full sm:w-auto`} aria-label="Filtrar por estado">
              <option value="Todos">Estado: todos</option>
              {estados.map(estado => <option key={estado} value={estado}>{estado}</option>)}
              {followUpCount > 0 && <option value={SEGUIMIENTO}>Para seguimiento</option>}
              {accionCount > 0 && <option value={ACCION}>Acciones para hoy</option>}
              {reboteCount > 0 && <option value={REBOTE}>Rebote duro</option>}
              {bajaCount > 0 && <option value={BAJA}>Desuscritos o spam</option>}
            </select>
            <select value={filtroEtiqueta} onChange={(e) => resetView(setFiltroEtiqueta)(e.target.value)} className={`${selectClass} w-full sm:w-auto`} aria-label="Filtrar por etiqueta">
              <option value="Todas">Etiqueta: todas</option>
              <option value="SinEtiqueta">Sin etiquetas</option>
              {etiquetasUnicas.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <button type="button" onClick={exportCsv} disabled={leadsFiltrados.length === 0} title="Descargar la lista filtrada" className={`${ui.btn} col-span-2 sm:col-span-1`}>
              <Download size={15} /> Exportar
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="px-4 py-2.5 bg-navy-900 text-white flex flex-wrap items-center gap-3 text-sm animate-slide-down">
            <span className="font-bold">{selected.length} seleccionado{selected.length > 1 ? 's' : ''}</span>
            <button disabled={working} onClick={() => setModalTag({ isOpen: true, emails: selected })} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 font-semibold cursor-pointer disabled:opacity-50"><Tag size={14} /> Etiquetar</button>
            <button disabled={working} onClick={() => handleEliminar(selected)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-semibold cursor-pointer disabled:opacity-50"><Trash2 size={14} /> Eliminar</button>
            <button onClick={() => setSelected([])} className="ml-auto text-slate-300 hover:text-white font-semibold cursor-pointer">Quitar selección</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-y border-slate-100">
                <th className="py-2.5 pl-5 w-8">
                  <input type="checkbox" aria-label="Seleccionar la página" checked={allPageSelected} onChange={togglePage} className="h-4 w-4 rounded accent-brand-600 cursor-pointer" />
                </th>
                {sortHeader('email', 'Correo electrónico')}
                {sortHeader('nombre', 'Nombre', 'hidden md:table-cell')}
                {sortHeader('fase', 'Fase', 'hidden md:table-cell')}
                <th className={`${ui.th} hidden md:table-cell`}>Estado</th>
                <th className={`${ui.th} hidden md:table-cell`}>Entrega</th>
                <th className={`${ui.th} text-right hidden md:table-cell`}>Aperturas</th>
                <th className={`${ui.th} text-right hidden md:table-cell`}>Clics</th>
                <th className={`${ui.th} hidden md:table-cell`}>Etiquetas</th>
                <th className={`${ui.th} hidden md:table-cell`}><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? skeletonRows
                : leads.length === 0 ? emptyRow(<EmptyState title="Tu base de datos está vacía" text="Sube un archivo CSV con tus prospectos para empezar a enviarles campañas." />)
                : leadsFiltrados.length === 0 ? emptyRow(<EmptyState title="Ningún prospecto coincide" text="Prueba con otra búsqueda o quita algún filtro." />)
                : pageRows.map((lead) => {
                  const tags = parseTags(lead.etiquetas);
                  const isSelected = selected.includes(lead.email);
                  const flag = deliveryFlag(lead.email, delivery);
                  // Sin problemas de entrega: "Entregado" si ya se le envió algo; "—" si todavía no
                  const shownFlag = flag || (estadoOf(lead) !== 'Pendiente' || (lead.sent || 0) > 0 ? DELIVERED_FLAG : null);
                  return (
                    <tr key={lead.email} className={`group border-t border-slate-100 first:border-t-0 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-brand-50/50' : ''}`}>
                      <td className="py-2.5 pl-5">
                        <input type="checkbox" aria-label={`Seleccionar ${lead.email}`} checked={isSelected} onChange={() => toggleOne(lead.email)} className="h-4 w-4 rounded accent-brand-600 cursor-pointer" />
                      </td>
                      <td className="py-2.5 px-5">
                        <button onClick={() => setOpenEmail(lead.email)} title="Ver ficha del prospecto" className="block font-medium text-slate-900 hover:text-brand-700 text-left cursor-pointer">{lead.email}</button>
                        {(lead.nombre || lead.empresa) && <span className="md:hidden block text-xs text-slate-500">{[lead.nombre, lead.empresa].filter(Boolean).join(' · ')}</span>}
                        <span className="md:hidden mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          Fase {faseOf(lead)} · {estadoOf(lead)} · {lead.opens || 0} aperturas · {lead.clicks || 0} clics
                          {flag && <span className={`rounded-md px-1.5 py-0.5 font-medium ${flag.tone}`}>{flag.label}</span>}
                        </span>
                      </td>
                      <td className="py-2.5 px-5 hidden md:table-cell max-w-48">
                        {lead.nombre ? <span className="block truncate font-medium text-slate-800" title={lead.nombre}>{lead.nombre}</span> : <span className="text-slate-300">—</span>}
                        {lead.empresa && <span className="block truncate text-xs text-slate-500" title={lead.empresa}>{lead.empresa}</span>}
                      </td>
                      <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap hidden md:table-cell">Fase {faseOf(lead)}</td>
                      <td className="py-2.5 px-5 whitespace-nowrap hidden md:table-cell">
                        <span className="inline-flex items-center gap-2 text-slate-600"><span className={`h-1.5 w-1.5 rounded-full ${statusDot(estadoOf(lead))}`} />{estadoOf(lead)}</span>
                      </td>
                      <td className="py-2.5 px-5 whitespace-nowrap hidden md:table-cell">
                        {shownFlag ? <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${shownFlag.tone}`}>{shownFlag.label}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-5 text-right tabular-nums text-slate-600 hidden md:table-cell">{lead.opens || 0}</td>
                      <td className="py-2.5 px-5 text-right tabular-nums text-slate-600 hidden md:table-cell">{lead.clicks || 0}</td>
                      <td className="py-2.5 px-5 hidden md:table-cell">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium">
                                {tag}
                                <button onClick={() => handleQuitarEtiqueta(lead.email, tag)} title={`Quitar ${tag}`} aria-label={`Quitar ${tag}`} className="cursor-pointer text-slate-400 hover:text-rose-600 rounded p-0.5 transition-colors">
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right hidden md:table-cell">
                        <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                          <button onClick={() => setModalTag({ isOpen: true, emails: [lead.email] })} className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer" title="Agregar etiqueta" aria-label="Agregar etiqueta"><Tag size={15} /></button>
                          <button onClick={() => handleEliminar([lead.email])} className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer" title="Eliminar" aria-label="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-wrap justify-between items-center gap-3 px-5 py-3 border-t border-slate-100">
            <span className="text-[13px] text-slate-500">Mostrando {((page - 1) * PAGE_SIZE) + 1} a {Math.min(page * PAGE_SIZE, leadsFiltrados.length)} de {leadsFiltrados.length}</span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(Math.max(page - 1, 1))} disabled={page === 1} className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer">Anterior</button>
              <button onClick={() => setCurrentPage(Math.min(page + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer">Siguiente</button>
            </div>
          </div>
        )}
      </section>

      <ContactDrawer lead={openLead} logs={activityLogs} loadingLogs={loadingLogs} busy={working} onClose={closeLead}
        flag={openLead ? deliveryFlag(openLead.email, delivery) : null} onSaveContact={handleGuardarContacto}
        onAddTag={(email) => setModalTag({ isOpen: true, emails: [email] })} onRemoveTag={handleQuitarEtiqueta}
        onDelete={async (emails) => { await handleEliminar(emails); }} />

      <Modal isOpen={modalTag.isOpen} onClose={closeTagModal} className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-slate-900">Añadir etiqueta</h3>
          <button onClick={closeTagModal} aria-label="Cerrar" className="text-slate-400 hover:text-slate-800 cursor-pointer"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          {modalTag.emails.length > 1 ? <>Se aplicará a <span className="font-bold">{modalTag.emails.length} prospectos</span>.</> : <>Prospecto: <span className="font-bold">{modalTag.emails[0]}</span></>}
        </p>
        <form onSubmit={handleAgregarEtiqueta}>
          <input type="text" autoFocus placeholder="Ej. VIP, Promo" value={nuevaEtiqueta} onChange={(e) => setNuevaEtiqueta(e.target.value)} aria-label="Etiqueta"
            className={`${ui.input} w-full mb-4`} />
          <button type="submit" disabled={!nuevaEtiqueta.trim() || working}
            className={`${ui.btnPrimary} w-full`}>
            {working ? 'Guardando...' : 'Guardar etiqueta'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
