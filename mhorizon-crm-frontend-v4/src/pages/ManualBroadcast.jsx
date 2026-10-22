import { useState, useRef, useMemo, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Send, Users, Paperclip, X, Eye, PencilLine, Trash2, Loader2, Monitor, Smartphone, LayoutTemplate,
  ChevronDown, BookmarkPlus, CheckCircle2, AlertTriangle, Circle, Clock,
} from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';
import { Panel } from '../components/analytics';
import { ui } from '../utils/theme';
import { useLeads } from '../hooks/useLeads';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { parseTags } from '../utils/tags';
import { confirmAction, promptText } from '../utils/notify';
import { formatHora } from '../utils/dates';
import { formatSize } from '../utils/files';

// Fuera del componente: si se recrea en cada render, Quill reinicia la barra y pierde el foco
const modulosQuill = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ],
};

const FASES = [1, 2, 3, 4, 5];
const BORRADOR_KEY = 'mhorizon:borrador-difusion';
const PLANTILLAS_KEY = 'mhorizon:plantillas';
const MAX_PLANTILLAS = 10;
const ASUNTO_IDEAL = 60;
const PESO_MAX_KB = 100; // Gmail recorta los correos de más de ~102 KB
const ADJUNTOS_MAX_MB = 10;

// Puntos de partida editables: lo que va entre [corchetes] hay que completarlo antes de enviar
const PLANTILLAS_BASE = [
  {
    id: 'base-presentacion', nombre: 'Presentación',
    asunto: 'Una propuesta pensada para [empresa]',
    cuerpo: '<p>Hola,</p><p>Soy [tu nombre] de MHORIZON. Me gustaría presentarte brevemente lo que hacemos y cómo podemos ayudarte con [necesidad].</p><p><strong>Lo que ofrecemos:</strong></p><ul><li>[Beneficio 1]</li><li>[Beneficio 2]</li><li>[Beneficio 3]</li></ul><p>¿Te parece si agendamos una llamada corta esta semana?</p><p>Saludos,<br>[tu nombre]</p>',
  },
  {
    id: 'base-seguimiento', nombre: 'Seguimiento',
    asunto: '¿Pudiste revisar nuestra propuesta?',
    cuerpo: '<p>Hola,</p><p>Te escribo para saber si tuviste oportunidad de revisar la información que te compartimos sobre [tema].</p><p>Si tienes dudas, con gusto las resolvemos. También puedo ajustar la propuesta a lo que necesites.</p><p>Quedo atento a tus comentarios.</p><p>Saludos,<br>[tu nombre]</p>',
  },
  {
    id: 'base-invitacion', nombre: 'Invitación a reunión',
    asunto: 'Te invitamos a una reunión: [tema]',
    cuerpo: '<p>Hola,</p><p>Queremos invitarte a una reunión para conversar sobre [tema].</p><ul><li><strong>Fecha:</strong> [día]</li><li><strong>Hora:</strong> [hora]</li><li><strong>Lugar o enlace:</strong> [lugar o enlace]</li></ul><p>Confírmanos tu asistencia respondiendo este correo.</p><p>Saludos,<br>[tu nombre]</p>',
  },
];

// Quill deja "<p><br></p>" cuando el editor está vacío
const isEmptyBody = (html) => !/<img/i.test(html) && html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
// Se separan párrafos, listas y saltos de línea con un espacio para que el texto no quede pegado
const htmlToText = (html) => new DOMParser().parseFromString(html.replace(/<\/(p|li|h[1-6]|div)>|<br\s*\/?>/gi, ' $&'), 'text/html').body.textContent || '';
const faseOf = (lead) => Math.min(lead.fase || 1, 5);

// El borrador y las plantillas viven solo en este navegador; si el almacenamiento falla, el formulario sigue funcionando
function leerBorrador() {
  try {
    const raw = window.localStorage.getItem(BORRADOR_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return null;
    return {
      asunto: typeof data.asunto === 'string' ? data.asunto : '',
      cuerpo: typeof data.cuerpo === 'string' ? data.cuerpo : '',
      fase: FASES.includes(data.fase) ? data.fase : 1,
      etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
    };
  } catch {
    return null;
  }
}
function guardarBorrador(data) {
  try { window.localStorage.setItem(BORRADOR_KEY, JSON.stringify(data)); } catch { /* sin almacenamiento */ }
}
function borrarBorrador() {
  try { window.localStorage.removeItem(BORRADOR_KEY); } catch { /* sin almacenamiento */ }
}
function leerPlantillas() {
  try {
    const data = JSON.parse(window.localStorage.getItem(PLANTILLAS_KEY) || '[]');
    return Array.isArray(data) ? data.filter(t => t && typeof t.nombre === 'string' && typeof t.cuerpo === 'string') : [];
  } catch {
    return [];
  }
}
function guardarPlantillas(lista) {
  try { window.localStorage.setItem(PLANTILLAS_KEY, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
}

const Step = ({ n, title, hint, right, children }) => (
  <section className={`${ui.card} p-5`}>
    <div className="flex items-start gap-3 mb-4">
      <span className="h-6 w-6 mt-px shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold grid place-items-center">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const CHECK_STYLE = {
  ok: { icon: CheckCircle2, color: 'text-emerald-500' },
  warn: { icon: AlertTriangle, color: 'text-amber-500' },
  pending: { icon: Circle, color: 'text-slate-300' },
};

export default function ManualBroadcast() {
  const [borrador] = useState(leerBorrador);
  const hayBorrador = !!borrador && (borrador.asunto !== '' || !isEmptyBody(borrador.cuerpo));

  const [asunto, setAsunto] = useState(borrador?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(borrador?.cuerpo ?? '');
  const [fase, setFase] = useState(borrador?.fase ?? 1);
  const [selectedTags, setSelectedTags] = useState(borrador?.etiquetas ?? []);
  const [archivos, setArchivos] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [vista, setVista] = useState('editar');
  const [dispositivo, setDispositivo] = useState('escritorio');
  const [restaurado, setRestaurado] = useState(hayBorrador);
  const [guardadoA, setGuardadoA] = useState(null);
  const [plantillas, setPlantillas] = useState(leerPlantillas);
  const [plantillasOpen, setPlantillasOpen] = useState(false);
  const { leads, tags: availableTags } = useLeads();
  const { hourlyActivityData, deliverability } = useDashboardMetrics();
  const primerRender = useRef(true);

  // Autoguardado del borrador (con una pausa, para no escribir en cada tecla)
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    const timer = setTimeout(() => {
      if (asunto === '' && isEmptyBody(cuerpo)) { borrarBorrador(); setGuardadoA(null); return; }
      guardarBorrador({ asunto, cuerpo, fase, etiquetas: selectedTags });
      setGuardadoA(new Date());
    }, 600);
    return () => clearTimeout(timer);
  }, [asunto, cuerpo, fase, selectedTags]);

  // Cuántos prospectos hay en cada fase (para mostrarlo en los botones)
  const faseCounts = useMemo(() => {
    const counts = Object.fromEntries(FASES.map(f => [f, 0]));
    leads.forEach(l => { counts[faseOf(l)] += 1; });
    return counts;
  }, [leads]);

  // Público: los de la fase elegida que tengan al menos una de las etiquetas
  const publico = useMemo(() => leads.filter(l => {
    if (faseOf(l) !== fase) return false;
    if (selectedTags.length === 0) return true;
    const tags = parseTags(l.etiquetas);
    return selectedTags.some(t => tags.includes(t));
  }), [leads, fase, selectedTags]);
  const maxDestinatarios = publico.length;
  // Del público, cuántos rebotaron (duro) o se dieron de baja: el servidor debería dejarlos fuera
  const noEnviables = useMemo(() => publico.filter(l => deliverability.hard.has(l.email) || deliverability.unknown.has(l.email) || deliverability.unsub.has(l.email) || deliverability.spam.has(l.email)).length, [publico, deliverability]);

  // Hora del día con más aperturas y clics, para sugerir cuándo enviar
  const horaPico = useMemo(() => {
    const pico = hourlyActivityData.reduce((best, h) => (h.aperturas + h.clics > best.aperturas + best.clics ? h : best), hourlyActivityData[0] || { aperturas: 0, clics: 0 });
    return pico.aperturas + pico.clics > 0 ? pico.hour : null;
  }, [hourlyActivityData]);

  const cuerpoVacio = isEmptyBody(cuerpo);
  const textoCuerpo = useMemo(() => htmlToText(cuerpo), [cuerpo]);
  const snippet = textoCuerpo.replace(/\s+/g, ' ').trim().slice(0, 90);
  const enlaces = (cuerpo.match(/<a\s[^>]*href=/gi) || []).length;
  const pesoKb = Math.round(new Blob([cuerpo]).size / 1024);
  const adjuntosMb = archivos.reduce((acc, a) => acc + a.size, 0) / 1048576;
  const conPendientes = /\[[^\]]{1,60}\]/.test(`${asunto} ${textoCuerpo}`);

  // Lista de verificación antes de enviar: lo obligatorio queda "pendiente", lo recomendable avisa
  const checks = [
    { state: asunto.trim() ? 'ok' : 'pending', text: asunto.trim() ? 'Asunto escrito' : 'Falta el asunto' },
    { state: cuerpoVacio ? 'pending' : 'ok', text: cuerpoVacio ? 'Falta el mensaje' : 'Mensaje escrito' },
    { state: maxDestinatarios > 0 ? 'ok' : 'warn', text: maxDestinatarios > 0 ? `Público elegido: hasta ${maxDestinatarios}` : 'Ningún prospecto con esa fase y etiquetas' },
    { state: enlaces > 0 ? 'ok' : 'warn', text: enlaces > 0 ? `${enlaces} ${enlaces === 1 ? 'enlace' : 'enlaces'} para medir clics` : 'Sin enlaces: no se podrán medir clics' },
    { state: asunto.length <= ASUNTO_IDEAL ? 'ok' : 'warn', text: asunto.length <= ASUNTO_IDEAL ? 'Asunto de buen largo' : `Asunto largo (${asunto.length} caracteres)` },
    { state: pesoKb <= PESO_MAX_KB ? 'ok' : 'warn', text: pesoKb <= PESO_MAX_KB ? 'Peso del correo adecuado' : `Pesa ${pesoKb} KB: Gmail recorta lo que pasa de 102 KB` },
    { state: conPendientes ? 'warn' : 'ok', text: conPendientes ? 'Quedan textos entre [corchetes] por completar' : 'Sin textos por completar' },
    { state: adjuntosMb <= ADJUNTOS_MAX_MB ? 'ok' : 'warn', text: adjuntosMb <= ADJUNTOS_MAX_MB ? 'Adjuntos livianos' : `Adjuntos de ${adjuntosMb.toFixed(1)} MB: muchos buzones los rechazan` },
  ];
  if (deliverability.hasDeliveryData) {
    checks.splice(3, 0, { state: noEnviables > 0 ? 'warn' : 'ok', text: noEnviables > 0 ? `${noEnviables} del público rebotaron o se dieron de baja` : 'Nadie del público rebotó ni se dio de baja' });
  }
  const listos = checks.filter(c => c.state === 'ok').length;

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addFiles = (e) => {
    const nuevos = Array.from(e.target.files);
    setArchivos(prev => [...prev, ...nuevos.filter(n => !prev.some(a => a.name === n.name && a.size === n.size))]);
    e.target.value = '';
  };
  const removeFile = (index) => setArchivos(prev => prev.filter((_, i) => i !== index));

  const descartarBorrador = () => {
    borrarBorrador();
    setAsunto('');
    setCuerpo('');
    setFase(1);
    setSelectedTags([]);
    setRestaurado(false);
    setGuardadoA(null);
  };

  const aplicarPlantilla = async (plantilla) => {
    setPlantillasOpen(false);
    if (asunto.trim() || !cuerpoVacio) {
      const confirmed = await confirmAction({ title: '¿Usar esta plantilla?', text: 'Reemplazará el asunto y el mensaje que tienes escritos.', confirmText: 'Sí, reemplazar' });
      if (!confirmed) return;
    }
    setAsunto(plantilla.asunto || '');
    setCuerpo(plantilla.cuerpo);
    setRestaurado(false);
    setVista('editar');
  };

  const guardarComoPlantilla = async () => {
    setPlantillasOpen(false);
    if (plantillas.length >= MAX_PLANTILLAS) {
      setMessage({ type: 'error', text: `Solo se pueden guardar ${MAX_PLANTILLAS} plantillas. Elimina alguna para guardar otra.` });
      return;
    }
    const nombre = await promptText({ title: 'Guardar como plantilla', placeholder: 'Nombre de la plantilla' });
    if (!nombre) return;
    const lista = [...plantillas, { id: `usuario-${new Date().getTime()}`, nombre, asunto, cuerpo }];
    setPlantillas(lista);
    guardarPlantillas(lista);
    setMessage({ type: 'success', text: `Plantilla "${nombre}" guardada en este navegador.` });
  };

  const eliminarPlantilla = async (plantilla) => {
    const confirmed = await confirmAction({ title: '¿Eliminar plantilla?', text: `Se eliminará "${plantilla.nombre}" de este navegador.`, confirmText: 'Sí, eliminar', danger: true });
    if (!confirmed) return;
    const lista = plantillas.filter(t => t.id !== plantilla.id);
    setPlantillas(lista);
    guardarPlantillas(lista);
  };

  const handleDespachar = async (e) => {
    e.preventDefault();
    if (cuerpoVacio) {
      setMessage({ type: 'error', text: 'El cuerpo del correo está vacío.' });
      return;
    }

    const destino = selectedTags.length > 0
      ? `los prospectos de la Fase ${fase} con etiqueta: ${selectedTags.join(', ')}`
      : `TODOS los prospectos de la Fase ${fase}`;
    const avisos = checks.filter(c => c.state === 'warn').map(c => c.text);
    const confirmed = await confirmAction({
      title: '¿Enviar campaña?',
      text: `Se enviará "${asunto}" a ${destino}.${avisos.length ? ` Ojo: ${avisos.join('; ')}.` : ''}`,
      confirmText: 'Sí, enviar',
    });
    if (!confirmed) return;

    setIsSending(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('asunto', asunto);
    formData.append('cuerpo', cuerpo);
    formData.append('fase', fase);

    // Si escribió una etiqueta opcional, la enviamos al backend
    if (selectedTags.length > 0) {
      formData.append('etiqueta', selectedTags.join(','));
    }

    archivos.forEach(archivo => formData.append('adjuntos[]', archivo));

    try {
      await api.post('/campaign/manual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: 'Campaña encolada con éxito.' });
      setAsunto('');
      setCuerpo('');
      setSelectedTags([]);
      setArchivos([]);
      setRestaurado(false);
      setVista('editar');
      borrarBorrador();
      setGuardadoA(null);
    } catch (error) {
      const detail = error?.response?.data?.message;
      setMessage({ type: 'error', text: detail ? `Error al encolar la campaña: ${detail}` : 'Error al encolar la campaña.' });
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const previewDoc = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#1e293b}img{max-width:100%;height:auto}a{color:#0a2c5e}h1,h2,h3{margin:0 0 .5em}p{margin:0 0 1em}</style>${cuerpo}`;
  const asuntoLargo = asunto.length > ASUNTO_IDEAL;

  return (
    <div>
      <PageHeader description="Elige la fase y las etiquetas, redacta el correo y envíalo a ese público.">Difusión manual</PageHeader>

      {restaurado && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 animate-fade-in">
          <span className="font-medium">Recuperamos el borrador que dejaste sin enviar.</span>
          <button type="button" onClick={descartarBorrador} className="inline-flex items-center gap-1.5 font-semibold hover:underline cursor-pointer">
            <Trash2 size={14} /> Descartar borrador
          </button>
        </div>
      )}

      <form onSubmit={handleDespachar} className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-5">
          <Step n="1" title="Público objetivo" hint="Fase del CRM y, si quieres afinar, etiquetas.">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {FASES.map(num => {
                const activo = fase === num;
                return (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setFase(num)}
                    aria-pressed={activo}
                    className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors ${activo
                      ? 'bg-brand-50/60 border-brand-600 ring-1 ring-brand-600'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className={`block text-[13px] font-medium ${activo ? 'text-brand-700' : 'text-slate-500'}`}>Fase {num}</span>
                    <span className="block mt-0.5 text-lg font-semibold text-slate-900 tabular-nums leading-tight">{faseCounts[num]} <span className="text-xs font-normal text-slate-500">prosp.</span></span>
                  </button>
                );
              })}
            </div>

            {availableTags.length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className={`${ui.label} mb-2.5`}>Filtrar por etiqueta <span className="font-normal text-slate-500">(opcional)</span></p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => {
                    const activa = selectedTags.includes(tag);
                    return (
                      <button type="button" key={tag} onClick={() => toggleTag(tag)} aria-pressed={activa}
                        className={`cursor-pointer rounded-md border px-2.5 py-1 text-[13px] font-medium transition-colors ${activa
                          ? 'bg-navy-900 border-navy-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {selectedTags.length === 0 && <p className="text-[13px] text-slate-500 mt-3">Sin etiquetas: se enviará a todos los prospectos de la Fase {fase}.</p>}
              </div>
            )}
          </Step>

          <Step n="2" title="Mensaje" hint="Puedes pegar imágenes directamente en el editor."
            right={(
              <div className="relative">
                <button type="button" onClick={() => setPlantillasOpen(o => !o)} aria-expanded={plantillasOpen}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <LayoutTemplate size={14} /> Plantillas <ChevronDown size={13} className={`transition-transform ${plantillasOpen ? 'rotate-180' : ''}`} />
                </button>
                {plantillasOpen && (
                  <>
                    <button type="button" aria-label="Cerrar plantillas" tabIndex={-1} onClick={() => setPlantillasOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-pop">
                      <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-slate-500">Plantillas base</p>
                      {PLANTILLAS_BASE.map(t => (
                        <button type="button" key={t.id} onClick={() => aplicarPlantilla(t)} className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">{t.nombre}</button>
                      ))}
                      {plantillas.length > 0 && (
                        <>
                          <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-slate-500">Tus plantillas</p>
                          {plantillas.map(t => (
                            <div key={t.id} className="flex items-center rounded-lg hover:bg-slate-50">
                              <button type="button" onClick={() => aplicarPlantilla(t)} className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm text-slate-700 cursor-pointer">{t.nombre}</button>
                              <button type="button" onClick={() => eliminarPlantilla(t)} aria-label={`Eliminar ${t.nombre}`} className="mr-1 h-7 w-7 grid place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="my-1 border-t border-slate-100" />
                      <button type="button" onClick={guardarComoPlantilla} disabled={asunto.trim() === '' && cuerpoVacio}
                        className="w-full inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        <BookmarkPlus size={15} /> Guardar el correo actual como plantilla
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="asunto" className={ui.label}>Asunto</label>
              <span className={`text-xs tabular-nums ${asuntoLargo ? 'font-semibold text-amber-600' : 'text-slate-500'}`}>{asunto.length} caracteres</span>
            </div>
            <input
              id="asunto"
              type="text"
              required
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className={`${ui.input} w-full`}
              placeholder="Ej. Propuesta exclusiva para tu empresa"
            />
            {asuntoLargo && <p className="text-xs text-amber-600 mt-1.5">Los asuntos de más de {ASUNTO_IDEAL} caracteres se cortan en muchos celulares.</p>}

            <div className="flex items-center justify-between mt-5 mb-2">
              <span className={ui.label}>Cuerpo del correo</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                {[['editar', PencilLine, 'Editar'], ['previa', Eye, 'Vista previa']].map(([key, Icon, label]) => (
                  <button type="button" key={key} onClick={() => setVista(key)} aria-pressed={vista === key}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 cursor-pointer transition-colors ${vista === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>
            </div>

            <div className={vista === 'editar' ? 'editor-body' : 'hidden'}>
              <ReactQuill theme="snow" value={cuerpo} onChange={setCuerpo} modules={modulosQuill} />
            </div>
            {vista === 'previa' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Así se vería en la bandeja de entrada y al abrirlo.</p>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                    {[['escritorio', Monitor, 'Escritorio'], ['movil', Smartphone, 'Móvil']].map(([key, Icon, label]) => (
                      <button type="button" key={key} onClick={() => setDispositivo(key)} aria-pressed={dispositivo === key}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 cursor-pointer transition-colors ${dispositivo === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Icon size={13} />{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-navy-900 text-white grid place-items-center text-xs font-bold">M</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold text-slate-900">MHORIZON</span><span className="text-xs text-slate-500">ahora</span></p>
                    <p className="truncate text-sm"><span className="font-semibold text-slate-800">{asunto || '(sin asunto)'}</span><span className="text-slate-400">{snippet ? ` - ${snippet}` : ''}</span></p>
                  </div>
                </div>

                {cuerpoVacio
                  ? <div className="h-72 grid place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">Aún no escribes el cuerpo del correo.</div>
                  : (
                    <div className="flex justify-center rounded-lg bg-slate-100 p-3 sm:p-5">
                      <iframe title="Vista previa del correo" sandbox="" srcDoc={previewDoc}
                        className={`h-80 max-w-full rounded-lg border border-slate-200 bg-white transition-[width] duration-300 ${dispositivo === 'movil' ? 'w-[375px]' : 'w-[640px]'}`} />
                    </div>
                  )}
              </div>
            )}
          </Step>

          <Step n="3" title="Adjuntos" hint="Opcional. PDF, Excel, imágenes, etc.">
            <input id="adjuntos" type="file" multiple onChange={addFiles} className="sr-only" />
            <label htmlFor="adjuntos"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
              <Paperclip size={16} /> Elegir archivos
            </label>
            {archivos.length > 0 && (
              <ul className="mt-3 space-y-2">
                {archivos.map((a, i) => (
                  <li key={`${a.name}-${a.size}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm animate-fade-in">
                    <span className="truncate font-medium text-slate-700">{a.name}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500 tabular-nums">{formatSize(a.size)}</span>
                      <button type="button" onClick={() => removeFile(i)} aria-label={`Quitar ${a.name}`} className="text-slate-400 hover:text-rose-600 cursor-pointer"><X size={15} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Step>
        </div>

        <aside className="lg:sticky lg:top-0">
          <Panel title="Resumen del envío" subtitle="Revisa antes de enviar">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Fase</dt>
                <dd className="font-medium text-slate-900">Fase {fase}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Etiquetas</dt>
                <dd className="font-medium text-slate-900 text-right">{selectedTags.length > 0 ? selectedTags.join(', ') : 'Todas'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Asunto</dt>
                <dd className="font-medium text-slate-900 text-right truncate max-w-[12rem]">{asunto || '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Adjuntos</dt>
                <dd className="font-medium text-slate-900">{archivos.length}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><Users size={14} /> Destinatarios</span>
                <span className="text-xl font-bold text-slate-900 tabular-nums">hasta {maxDestinatarios}</span>
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-500">Cálculo según tu base actual. El servidor define el número exacto al enviar.</p>
            </div>
            {horaPico && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-slate-500">
                <Clock size={13} className="mt-0.5 shrink-0 text-slate-400" />
                Tus prospectos están más activos cerca de las {horaPico}.
              </p>
            )}

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className={ui.label}>Antes de enviar</p>
                <span className="text-xs text-slate-500 tabular-nums">{listos} de {checks.length}</span>
              </div>
              <ul className="space-y-1.5">
                {checks.map(({ state, text }) => {
                  const { icon: Icon, color } = CHECK_STYLE[state];
                  return (
                    <li key={text} className="flex items-start gap-2 text-[13px] leading-snug">
                      <Icon size={14} className={`mt-px shrink-0 ${color}`} />
                      <span className={state === 'ok' ? 'text-slate-500' : 'font-medium text-slate-800'}>{text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-5 space-y-3">
              <StatusMessage message={message} className="p-3 rounded-lg" />
              <button
                type="submit"
                disabled={isSending}
                className={`${ui.btnPrimary} w-full h-11`}
              >
                {isSending ? <><Loader2 size={17} className="animate-spin" /> Encolando...</> : <><Send size={17} /> Enviar campaña</>}
              </button>
              <p className="text-center text-xs text-slate-500 min-h-4">
                {guardadoA ? `Borrador guardado a las ${formatHora(guardadoA)}` : 'El borrador se guarda solo en este navegador'}
              </p>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  );
}
