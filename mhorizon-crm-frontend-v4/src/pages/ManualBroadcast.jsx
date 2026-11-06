import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  Send, Users, Paperclip, X, Eye, PencilLine, Trash2, Loader2, Monitor, Smartphone, LayoutTemplate,
  ChevronDown, BookmarkPlus, CheckCircle2, AlertTriangle, Circle, Clock, Feather, Newspaper, History, Settings2,
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
import EmailDesigner from '../components/EmailDesigner';
import Select from '../components/Select';
import TagSelect from '../components/TagSelect';
import SenderManager from '../components/SenderManager';
import ReuseCampaignModal from '../components/ReuseCampaignModal';
import {
  renderCorreo, revisarBloques, textoBloques, bloquesValidos, estilosValidos, correoNuevo, sinImagenesIncrustadas,
} from '../utils/emailBlocks';
import { bloquesDesdeHtml } from '../utils/emailParse';

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

// El envío llega a los prospectos activos, también a los que no están en el flujo (fase 0).
// Los de fase 99 ya terminaron su secuencia
const FASES = [0, 1, 2, 3, 4, 5];
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

// El borrador y las plantillas viven solo en este navegador; si el almacenamiento falla, el formulario sigue funcionando
function leerBorrador() {
  try {
    const raw = window.localStorage.getItem(BORRADOR_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return null;
    return {
      asunto: typeof data.asunto === 'string' ? data.asunto : '',
      cuerpo: typeof data.cuerpo === 'string' ? data.cuerpo : '',
      nombreCampana: typeof data.nombreCampana === 'string' ? data.nombreCampana : '',
      etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
      formato: data.formato === 'campana' ? 'campana' : 'personal',
      bloques: bloquesValidos(data.bloques),
      estilos: estilosValidos(data.estilos),
      remitenteId: Number.isInteger(data.remitenteId) ? data.remitenteId : null,
      remitenteNombre: typeof data.remitenteNombre === 'string' ? data.remitenteNombre : '',
    };
  } catch {
    return null;
  }
}
// Devuelve false si no se pudo guardar (por ejemplo, imágenes que no caben en el almacenamiento del navegador)
function guardarBorrador(data) {
  try { window.localStorage.setItem(BORRADOR_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
function borrarBorrador() {
  try { window.localStorage.removeItem(BORRADOR_KEY); } catch { /* sin almacenamiento */ }
}
function leerPlantillas() {
  try {
    const data = JSON.parse(window.localStorage.getItem(PLANTILLAS_KEY) || '[]');
    return Array.isArray(data) ? data.filter(t => t && typeof t.nombre === 'string' && (typeof t.cuerpo === 'string' || Array.isArray(t.bloques))) : [];
  } catch {
    return [];
  }
}
function guardarPlantillas(lista) {
  try { window.localStorage.setItem(PLANTILLAS_KEY, JSON.stringify(lista)); return true; } catch { return false; }
}

const Step = ({ n, title, hint, right, children }) => (
  <section className={`${ui.card} p-5`}>
    <div className="flex flex-wrap items-start gap-3 mb-4">
      <span className="h-6 w-6 mt-px shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold grid place-items-center">{n}</span>
      <div className="min-w-0 flex-1 basis-56">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const FORMATOS = [
  { key: 'personal', icon: Feather, titulo: 'Correo personal', texto: 'Parece escrito a mano: texto simple, ideal para seguimientos y propuestas.' },
  { key: 'campana', icon: Newspaper, titulo: 'Campaña con diseño', texto: 'Imágenes, botones con enlace y pie de página, como en Mailchimp o Brevo.' },
];

const Selector = ({ opciones, valor, onChange }) => (
  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
    {opciones.map(([key, Icon, label]) => (
      <button type="button" key={key} onClick={() => onChange(key)} aria-pressed={valor === key}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 cursor-pointer transition-colors ${valor === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        <Icon size={13} />{label}
      </button>
    ))}
  </div>
);
// En campaña no hay plantillas armadas: se parte del pie de página y el contenido lo pone cada quien
const DISENO_NUEVO = [{ id: 'nuevo', nombre: 'Empezar de cero (solo el pie)', asunto: '', bloques: correoNuevo }];
const VISTAS = [['editar', PencilLine, 'Editar'], ['previa', Eye, 'Vista previa']];
const DISPOSITIVOS = [['escritorio', Monitor, 'Escritorio'], ['movil', Smartphone, 'Móvil']];

const TEXTO_REUSAR = { title: '¿Reutilizar este diseño?', text: 'Reemplazará el correo que tienes armado y vaciará el asunto, el público y los adjuntos.', confirmText: 'Sí, reutilizar' };

const CHECK_STYLE = {
  ok: { icon: CheckCircle2, color: 'text-emerald-500' },
  warn: { icon: AlertTriangle, color: 'text-amber-500' },
  pending: { icon: Circle, color: 'text-slate-300' },
};

export default function ManualBroadcast() {
  const [borrador] = useState(leerBorrador);
  const hayBorrador = !!borrador && (borrador.asunto !== '' || !isEmptyBody(borrador.cuerpo) || borrador.bloques.length > 0);

  const [asunto, setAsunto] = useState(borrador?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(borrador?.cuerpo ?? '');
  const [nombreCampana, setNombreCampana] = useState(borrador?.nombreCampana ?? '');
  const [selectedTags, setSelectedTags] = useState(borrador?.etiquetas ?? []);
  // Dos formatos: "personal" (editor de texto, parece escrito a mano) y "campana" (bloques con diseño)
  const [formato, setFormato] = useState(borrador?.formato ?? 'personal');
  const [bloques, setBloques] = useState(borrador?.bloques ?? []);
  const [estilos, setEstilos] = useState(borrador?.estilos ?? estilosValidos());
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [borradorFallo, setBorradorFallo] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [vista, setVista] = useState('editar');
  const [dispositivo, setDispositivo] = useState('escritorio');
  const [restaurado, setRestaurado] = useState(hayBorrador);
  const [guardadoA, setGuardadoA] = useState(null);
  const [plantillas, setPlantillas] = useState(leerPlantillas);
  const [plantillasOpen, setPlantillasOpen] = useState(false);
  // Remitente: la cuenta desde la que sale y el nombre que ve el destinatario en su bandeja
  const [remitentes, setRemitentes] = useState(null);
  const [remitentesFallo, setRemitentesFallo] = useState(false);
  const [remitenteId, setRemitenteId] = useState(borrador?.remitenteId ?? null);
  const [remitenteNombre, setRemitenteNombre] = useState(borrador?.remitenteNombre ?? '');
  const [remitentesOpen, setRemitentesOpen] = useState(false);
  const [reusarOpen, setReusarOpen] = useState(false);
  const [reusando, setReusando] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { leads, tags: availableTags } = useLeads();
  const { hourlyActivityData, deliverability } = useDashboardMetrics();
  const primerRender = useRef(true);

  // Autoguardado del borrador (con una pausa, para no escribir en cada tecla)
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    const timer = setTimeout(() => {
      if (asunto === '' && isEmptyBody(cuerpo) && bloques.length === 0) { borrarBorrador(); setGuardadoA(null); return; }
      const ok = guardarBorrador({ asunto, cuerpo, nombreCampana, etiquetas: selectedTags, formato, bloques, estilos, remitenteId, remitenteNombre });
      setBorradorFallo(!ok);
      if (ok) setGuardadoA(new Date());
    }, 600);
    return () => clearTimeout(timer);
  }, [asunto, cuerpo, nombreCampana, selectedTags, formato, bloques, estilos, remitenteId, remitenteNombre]);

  // Si el servidor aún no tiene remitentes (sin desplegar), se envía con la cuenta principal como siempre
  const cargarRemitentes = useCallback((elegir) => api.get('/remitentes')
    .then(({ data }) => {
      setRemitentes(Array.isArray(data) ? data : []);
      setRemitentesFallo(false);
      if (elegir) setRemitenteId(elegir);
    })
    .catch(() => { setRemitentes([]); setRemitentesFallo(true); }), []);
  useEffect(() => { cargarRemitentes(); }, [cargarRemitentes]);
  // El elegido, o el principal si el guardado en el borrador ya no existe
  const remitente = remitentes?.find(r => r.id === remitenteId) || remitentes?.find(r => r.predeterminado) || remitentes?.[0] || null;
  const nombreVisible = remitenteNombre.trim() || remitente?.nombre || 'MHORIZON';

  // Público: los prospectos activos que tengan al menos una de las etiquetas
  const publico = useMemo(() => leads.filter(l => {
    if (!FASES.includes(Number(l.fase))) return false;
    const tags = parseTags(l.etiquetas);
    return selectedTags.some(t => tags.includes(t));
  }), [leads, selectedTags]);
  const maxDestinatarios = publico.length;
  // Prospectos activos con cada etiqueta, para mostrarlo en el desplegable
  const conteoEtiquetas = useMemo(() => {
    const conteo = {};
    leads.forEach(l => { if (FASES.includes(Number(l.fase))) parseTags(l.etiquetas).forEach(t => { conteo[t] = (conteo[t] || 0) + 1; }); });
    return conteo;
  }, [leads]);
  // El mismo nombre que arma el servidor si no se escribe uno
  const nombreAutomatico = useMemo(() => {
    const fases = [...new Set(publico.map(l => Number(l.fase)))].sort((a, b) => a - b);
    if (fases.length === 0) return '';
    const conFase = fases.filter(Boolean);
    const partes = [];
    if (conFase.length > 0) partes.push(`${conFase.length === 1 ? 'Fase' : 'Fases'} ${conFase.join(', ')}`);
    if (fases.includes(0)) partes.push(conFase.length > 0 ? 'sin fases' : 'Sin fases');
    return `Campaña Etiquetas ${selectedTags.join(', ')} ${partes.join(' y ')}`;
  }, [publico, selectedTags]);
  // Del público, cuántos rebotaron (duro) o se dieron de baja: el servidor debería dejarlos fuera
  const noEnviables = useMemo(() => publico.filter(l => deliverability.hard.has(l.email) || deliverability.unknown.has(l.email) || deliverability.unsub.has(l.email) || deliverability.spam.has(l.email)).length, [publico, deliverability]);

  // Hora del día con más aperturas y clics, para sugerir cuándo enviar
  const horaPico = useMemo(() => {
    const pico = hourlyActivityData.reduce((best, h) => (h.aperturas + h.clics > best.aperturas + best.clics ? h : best), hourlyActivityData[0] || { aperturas: 0, clics: 0 });
    return pico.aperturas + pico.clics > 0 ? pico.hour : null;
  }, [hourlyActivityData]);

  const esCampana = formato === 'campana';
  // Lo que se envía: el HTML del editor o el correo armado con los bloques
  const htmlCorreo = useMemo(() => (esCampana ? renderCorreo(bloques, { estilos }) : cuerpo), [esCampana, bloques, estilos, cuerpo]);
  const cuerpoVacio = esCampana ? bloques.length === 0 : isEmptyBody(cuerpo);
  const textoCuerpo = useMemo(() => (esCampana ? textoBloques(bloques) : htmlToText(cuerpo)), [esCampana, bloques, cuerpo]);
  const snippet = textoCuerpo.replace(/\s+/g, ' ').trim().slice(0, 90);
  const enlaces = (htmlCorreo.match(/<a\s[^>]*href="(https?:|mailto:|tel:)/gi) || []).length;
  const pesoKb = Math.round(new Blob([sinImagenesIncrustadas(htmlCorreo)]).size / 1024);
  const diseno = useMemo(() => revisarBloques(bloques), [bloques]);
  const adjuntosMb = archivos.reduce((acc, a) => acc + a.size, 0) / 1048576;
  const conPendientes = /\[[^\]]{1,60}\]/.test(`${asunto} ${textoCuerpo}`);

  // Lista de verificación antes de enviar: lo obligatorio queda "pendiente", lo recomendable avisa
  const checks = [
    { state: asunto.trim() ? 'ok' : 'pending', text: asunto.trim() ? 'Asunto escrito' : 'Falta el asunto' },
    { state: cuerpoVacio ? 'pending' : 'ok', text: cuerpoVacio ? 'Falta el mensaje' : 'Mensaje escrito' },
    { state: selectedTags.length === 0 ? 'pending' : maxDestinatarios > 0 ? 'ok' : 'warn', text: selectedTags.length === 0 ? 'Falta elegir etiquetas' : maxDestinatarios > 0 ? `Público elegido: hasta ${maxDestinatarios}` : 'Ningún prospecto con esas etiquetas' },
    ...(remitente ? [{ state: 'ok', text: `Sale como "${nombreVisible}"` }] : []),
    { state: enlaces > 0 ? 'ok' : 'warn', text: enlaces > 0 ? `${enlaces} ${enlaces === 1 ? 'enlace' : 'enlaces'} para medir clics` : 'Sin enlaces: no se podrán medir clics' },
    { state: asunto.length <= ASUNTO_IDEAL ? 'ok' : 'warn', text: asunto.length <= ASUNTO_IDEAL ? 'Asunto de buen largo' : `Asunto largo (${asunto.length} caracteres)` },
    { state: pesoKb <= PESO_MAX_KB ? 'ok' : 'warn', text: pesoKb <= PESO_MAX_KB ? 'Peso del correo adecuado' : `Pesa ${pesoKb} KB: Gmail recorta lo que pasa de 102 KB` },
    { state: conPendientes ? 'warn' : 'ok', text: conPendientes ? 'Quedan textos entre [corchetes] por completar' : 'Sin textos por completar' },
    { state: adjuntosMb <= ADJUNTOS_MAX_MB ? 'ok' : 'warn', text: adjuntosMb <= ADJUNTOS_MAX_MB ? 'Adjuntos livianos' : `Adjuntos de ${adjuntosMb.toFixed(1)} MB: muchos buzones los rechazan` },
  ];
  if (esCampana) {
    checks.splice(2, 0,
      ...(diseno.sinImagen > 0 ? [{ state: 'pending', text: `${diseno.sinImagen} ${diseno.sinImagen === 1 ? 'bloque de imagen vacío' : 'bloques de imagen vacíos'}` }] : []),
      ...(diseno.subidas > 0 ? [{ state: 'ok', text: `${diseno.subidas} ${diseno.subidas === 1 ? 'imagen subida' : 'imágenes subidas'} desde tu equipo` }] : []),
      ...(diseno.locales > 0 ? [{ state: 'warn', text: `${diseno.locales} ${diseno.locales === 1 ? 'imagen apunta' : 'imágenes apuntan'} a este equipo: nadie más la verá` }] : []),
      { state: diseno.botonesSinEnlace > 0 ? 'warn' : 'ok', text: diseno.botonesSinEnlace > 0 ? `${diseno.botonesSinEnlace} ${diseno.botonesSinEnlace === 1 ? 'botón' : 'botones'} sin enlace` : 'Botones con enlace' },
      { state: diseno.tienePie ? 'ok' : 'warn', text: diseno.tienePie ? 'Pie de página con los datos de la empresa' : 'Falta el pie de página' },
    );
  }
  if (deliverability.hasDeliveryData) {
    checks.splice(3, 0, { state: noEnviables > 0 ? 'warn' : 'ok', text: noEnviables > 0 ? `${noEnviables} del público rebotaron o se dieron de baja` : 'Nadie del público rebotó ni se dio de baja' });
  }
  const listos = checks.filter(c => c.state === 'ok').length;

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
    setNombreCampana('');
    setSelectedTags([]);
    setBloques([]);
    setEstilos(estilosValidos());
    setRemitenteNombre('');
    setRestaurado(false);
    setGuardadoA(null);
  };

  // Reutilizar una difusión enviada: se copia solo su diseño; asunto, público, nombre y adjuntos empiezan de cero
  const cargarDisenoEnviado = useCallback((nombre, confirmar) => api.get('/campaign/diseno', { params: { nombre } })
    .then(async ({ data }) => {
      // El correo con diseño trae sus bloques; si se envió antes de que se guardaran, se rearman desde su HTML.
      // Un cuerpo con tablas siempre es del editor de diseño (el del correo personal no las genera)
      const guardado = bloquesValidos(data.diseno?.bloques).length > 0 ? data.diseno : null;
      const conDiseno = data.formato === 'campana' || /<table/i.test(data.cuerpo || '');
      const diseno = conDiseno ? guardado || bloquesDesdeHtml(data.cuerpo) : null;
      if (conDiseno && !diseno) throw new Error('No se pudo leer el diseño de esa campaña.');
      if (confirmar && !(await confirmAction(TEXTO_REUSAR))) return;
      if (diseno) {
        const lista = bloquesValidos(diseno.bloques).map(b => ({ ...b, id: `${b.id}-${new Date().getTime()}` }));
        setFormato('campana');
        setBloques(lista);
        setEstilos(estilosValidos(diseno.estilos));
        setEditorAbierto(true);
      } else {
        setFormato('personal');
        setCuerpo(data.cuerpo || '');
      }
      setAsunto('');
      setNombreCampana('');
      setSelectedTags([]);
      setArchivos([]);
      setRestaurado(false);
      setVista('editar');
      setReusarOpen(false);
      setMessage({ type: 'success', text: `Diseño de "${nombre}" listo. Escribe el asunto y elige el público y el remitente.` });
    })
    .catch((error) => {
      setReusarOpen(false);
      setMessage({ type: 'error', text: error?.response?.data?.message || error?.message || 'No se pudo cargar el diseño de esa campaña.' });
    }), []);
  const reutilizarCampana = async (nombre) => {
    if ((asunto.trim() || !cuerpoVacio) && !(await confirmAction(TEXTO_REUSAR))) return;
    setReusando(nombre);
    await cargarDisenoEnviado(nombre, false);
    setReusando(null);
  };

  // Desde el reporte de una campaña ("Reutilizar diseño") se llega con su nombre
  const pedidoReusar = location.state?.reutilizar;
  useEffect(() => {
    if (!pedidoReusar) return;
    navigate(location.pathname, { replace: true, state: null });
    cargarDisenoEnviado(pedidoReusar, hayBorrador);
  }, [pedidoReusar, hayBorrador, cargarDisenoEnviado, navigate, location.pathname]);

  // Una plantilla de campaña trae bloques (los diseños base los crean con ids nuevos); la personal, el HTML del editor
  const aplicarPlantilla = async (plantilla) => {
    setPlantillasOpen(false);
    if (asunto.trim() || !cuerpoVacio) {
      const confirmed = await confirmAction({ title: '¿Usar esta plantilla?', text: 'Reemplazará el asunto y el mensaje que tienes escritos.', confirmText: 'Sí, reemplazar' });
      if (!confirmed) return;
    }
    setAsunto(plantilla.asunto || '');
    if (plantilla.bloques) {
      const lista = typeof plantilla.bloques === 'function' ? plantilla.bloques() : bloquesValidos(plantilla.bloques).map(b => ({ ...b, id: `${b.id}-${new Date().getTime()}` }));
      setFormato('campana');
      setBloques(lista);
      setEstilos(estilosValidos(plantilla.estilos));
    } else {
      setFormato('personal');
      setCuerpo(plantilla.cuerpo);
    }
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
    const datos = esCampana ? { formato, bloques, estilos } : { cuerpo };
    const lista = [...plantillas, { id: `usuario-${new Date().getTime()}`, nombre, asunto, ...datos }];
    if (!guardarPlantillas(lista)) {
      setMessage({ type: 'error', text: 'No se pudo guardar: las imágenes del diseño no caben en el almacenamiento de este navegador.' });
      return;
    }
    setPlantillas(lista);
    setMessage({ type: 'success', text: esCampana ? `Diseño "${nombre}" guardado en este navegador.` : `Plantilla "${nombre}" guardada en este navegador.` });
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
    if (selectedTags.length === 0) {
      setMessage({ type: 'error', text: 'Elige al menos una etiqueta.' });
      return;
    }
    if (cuerpoVacio) {
      setMessage({ type: 'error', text: 'El cuerpo del correo está vacío.' });
      return;
    }

    const destino = `los prospectos con etiqueta: ${selectedTags.join(', ')}`;
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
    formData.append('cuerpo', htmlCorreo);
    formData.append('formato', formato);
    // Los bloques del editor quedan guardados para poder reutilizar el diseño después
    if (esCampana) formData.append('diseno', JSON.stringify({ bloques, estilos }));
    if (remitente) formData.append('remitente_id', remitente.id);
    if (remitenteNombre.trim()) formData.append('remitente_nombre', remitenteNombre.trim());
    formData.append('etiqueta', selectedTags.join(','));
    // Si queda vacío, el servidor arma "Campaña Etiquetas ... Fase ..."
    if (nombreCampana.trim()) formData.append('nombre_provisional', nombreCampana.trim());

    archivos.forEach(archivo => formData.append('adjuntos[]', archivo));

    try {
      await api.post('/campaign/manual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: 'Campaña encolada con éxito.' });
      setAsunto('');
      setCuerpo('');
      setNombreCampana('');
      setSelectedTags([]);
      setBloques([]);
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

  const previewDoc = esCampana
    ? `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>${htmlCorreo}`
    : `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:20px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#1e293b}img{max-width:100%;height:auto}a{color:#0a2c5e}h1,h2,h3{margin:0 0 .5em}p{margin:0 0 1em}</style>${cuerpo}`;
  const plantillasDelFormato = plantillas.filter(t => (esCampana ? Array.isArray(t.bloques) : !Array.isArray(t.bloques)));
  const plantillasBase = esCampana ? DISENO_NUEVO : PLANTILLAS_BASE;
  const elegirFormato = (key) => {
    setFormato(key);
    setVista('editar');
    if (key === 'campana' && bloques.length === 0) { setBloques(correoNuevo()); setEditorAbierto(true); }
  };
  const guardarDiseno = useCallback((nuevosBloques, nuevosEstilos) => { setBloques(nuevosBloques); setEstilos(nuevosEstilos); }, []);
  const cerrarEditor = useCallback(() => setEditorAbierto(false), []);
  const cerrarRemitentes = useCallback(() => setRemitentesOpen(false), []);
  const cerrarReusar = useCallback(() => setReusarOpen(false), []);
  const asuntoLargo = asunto.length > ASUNTO_IDEAL;

  return (
    <div>
      <PageHeader description="Elige las etiquetas, redacta el correo y envíalo a ese público.">Difusión manual</PageHeader>

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
          <Step n="1" title="Público objetivo" hint="El correo llega a los prospectos que tengan al menos una de las etiquetas.">
            {availableTags.length > 0 ? (
              <div className="max-w-md">
                <TagSelect options={availableTags} value={selectedTags} onChange={setSelectedTags} counts={conteoEtiquetas} label="Etiquetas del público" />
                {selectedTags.length === 0 && <p className="text-[13px] text-slate-500 mt-2">Elige al menos una etiqueta para poder enviar.</p>}
              </div>
            ) : <p className="text-[13px] text-slate-500">Aún no hay etiquetas. Agrégalas a tus prospectos para poder enviar.</p>}
          </Step>

          <Step n="2" title="Remitente" hint="Quién aparece como remitente en la bandeja de entrada de tus prospectos."
            right={!remitentesFallo && (
              <button type="button" onClick={() => setRemitentesOpen(true)} disabled={remitentes === null}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                <Settings2 size={14} /> Administrar
              </button>
            )}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="remitente-nombre" className={`${ui.label} block mb-2`}>Nombre que verán</label>
                <input id="remitente-nombre" type="text" maxLength={120} value={remitenteNombre} onChange={(e) => setRemitenteNombre(e.target.value)}
                  className={`${ui.input} w-full`} placeholder={remitente?.nombre || 'Ej. Ana de MHORIZON'} />
                <p className="text-xs text-slate-500 mt-1.5">{remitenteNombre.trim() ? 'Tus prospectos verán este nombre en lugar del correo.' : `Si lo dejas vacío se verá "${nombreVisible}".`}</p>
              </div>
              <div>
                <span className={`${ui.label} block mb-2`}>Correo de envío</span>
                {remitentes === null && <div className={`${ui.input} w-full flex items-center gap-2 text-slate-400`}><Loader2 size={14} className="animate-spin" /> Cargando...</div>}
                {remitentes !== null && remitentes.length > 0 && (
                  <Select label="Correo de envío" value={remitente?.id} onChange={setRemitenteId}
                    options={remitentes.map(r => [r.id, r.predeterminado ? `${r.email} (principal)` : r.email])} />
                )}
                {remitentes !== null && remitentes.length === 0 && (
                  <div className={`${ui.input} w-full flex items-center text-slate-500`}>Cuenta principal de MHORIZON</div>
                )}
                <p className="text-xs text-slate-500 mt-1.5">{remitentesFallo ? 'No se pudo cargar la lista de correos: se enviará desde la cuenta principal.' : 'Las respuestas llegan a este correo.'}</p>
              </div>
            </div>
          </Step>

          <Step n="3" title="Mensaje" hint={esCampana ? 'Arma el correo con imágenes, textos y botones. El pie de página ya viene listo.' : 'Puedes pegar imágenes directamente en el editor.'}
            right={(
              <div className="relative flex items-center gap-2">
                <button type="button" onClick={() => setReusarOpen(true)}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <History size={14} /> Reutilizar campaña
                </button>
                <button type="button" onClick={() => setPlantillasOpen(o => !o)} aria-expanded={plantillasOpen}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <LayoutTemplate size={14} /> {esCampana ? 'Diseños' : 'Plantillas'} <ChevronDown size={13} className={`transition-transform ${plantillasOpen ? 'rotate-180' : ''}`} />
                </button>
                {plantillasOpen && (
                  <>
                    <button type="button" aria-label="Cerrar plantillas" tabIndex={-1} onClick={() => setPlantillasOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-pop">
                      <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-slate-500">{esCampana ? 'Diseños base' : 'Plantillas base'}</p>
                      {plantillasBase.map(t => (
                        <button type="button" key={t.id} onClick={() => aplicarPlantilla(t)} className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">{t.nombre}</button>
                      ))}
                      {plantillasDelFormato.length > 0 && (
                        <>
                          <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-slate-500">{esCampana ? 'Tus diseños' : 'Tus plantillas'}</p>
                          {plantillasDelFormato.map(t => (
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
                        <BookmarkPlus size={15} /> {esCampana ? 'Guardar el diseño actual' : 'Guardar el correo actual como plantilla'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}>
            <div className="mb-5">
              <span className={`${ui.label} block mb-2`}>Formato</span>
              <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Formato del correo">
                {FORMATOS.map(({ key, icon: Icon, titulo, texto }) => {
                  const activo = formato === key;
                  return (
                    <button type="button" key={key} role="radio" aria-checked={activo} onClick={() => elegirFormato(key)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer ${activo ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <span className={`mt-0.5 h-8 w-8 shrink-0 grid place-items-center rounded-md ${activo ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={16} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{titulo}</span>
                        <span className="block text-xs leading-snug text-slate-500 mt-0.5">{texto}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="nombre-campana" className={`${ui.label} block mb-2`}>Nombre de la campaña <span className="font-normal text-slate-500">(opcional)</span></label>
              <input
                id="nombre-campana"
                type="text"
                maxLength={255}
                value={nombreCampana}
                onChange={(e) => setNombreCampana(e.target.value)}
                className={`${ui.input} w-full`}
                placeholder={nombreAutomatico || 'Ej. Promo noviembre'}
              />
              <p className="text-xs text-slate-500 mt-1.5">Es un nombre provisional para organizarte; los prospectos solo ven el asunto.{nombreAutomatico && !nombreCampana.trim() ? ` Si lo dejas vacío se llamará "${nombreAutomatico}".` : ''}</p>
            </div>

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

            <div className="flex flex-wrap items-center justify-between gap-2 mt-5 mb-2">
              <span className={ui.label}>{esCampana ? 'Diseño del correo' : 'Cuerpo del correo'}</span>
              <div className="flex flex-wrap items-center gap-2">
                {vista === 'previa' && <Selector opciones={DISPOSITIVOS} valor={dispositivo} onChange={setDispositivo} />}
                <Selector opciones={VISTAS} valor={vista} onChange={setVista} />
              </div>
            </div>

            {!esCampana && (
              <div className={vista === 'editar' ? 'editor-body' : 'hidden'}>
                <ReactQuill theme="snow" value={cuerpo} onChange={setCuerpo} modules={modulosQuill} />
              </div>
            )}
            {esCampana && vista === 'editar' && (
              <div className="rounded-lg border border-slate-200 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <p className="text-[13px] text-slate-500">{bloques.length} {bloques.length === 1 ? 'bloque' : 'bloques'}. Ábrelo para agregar imágenes, textos y botones.</p>
                  <button type="button" onClick={() => setEditorAbierto(true)} className={`${ui.btnPrimary} h-9`}><PencilLine size={15} /> Abrir editor</button>
                </div>
                <button type="button" onClick={() => setEditorAbierto(true)} aria-label="Abrir editor" className="block w-full cursor-pointer">
                  <iframe title="Miniatura del correo" sandbox="" srcDoc={previewDoc} tabIndex={-1} className="pointer-events-none block h-104 w-full rounded-b-lg bg-white" />
                </button>
              </div>
            )}
            {vista === 'previa' && (
              <div className="space-y-3 animate-fade-in">
                <p className="text-xs text-slate-500">Así se vería en la bandeja de entrada y al abrirlo.</p>

                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-navy-900 text-white grid place-items-center text-xs font-bold">{nombreVisible.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{nombreVisible}</span><span className="text-xs text-slate-500">ahora</span></p>
                    <p className="truncate text-sm"><span className="font-semibold text-slate-800">{asunto || '(sin asunto)'}</span><span className="text-slate-400">{snippet ? ` - ${snippet}` : ''}</span></p>
                  </div>
                </div>

                {cuerpoVacio
                  ? <div className="h-72 grid place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">Aún no escribes el cuerpo del correo.</div>
                  : (
                    <div className="flex justify-center rounded-lg bg-slate-100 p-3 sm:p-5">
                      <iframe title="Vista previa del correo" sandbox="" srcDoc={previewDoc}
                        className={`${esCampana ? 'h-144' : 'h-80'} max-w-full rounded-lg border border-slate-200 bg-white transition-[width] duration-300 ${dispositivo === 'movil' ? 'w-93.75' : (esCampana ? 'w-162' : 'w-160')}`} />
                    </div>
                  )}
              </div>
            )}
          </Step>

          <Step n="4" title="Adjuntos" hint="Opcional. PDF, Excel, imágenes, etc.">
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
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Campaña</dt>
                <dd className="font-medium text-slate-900 text-right">{nombreCampana.trim() || nombreAutomatico || '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Remitente</dt>
                <dd className="min-w-0 text-right">
                  <span className="block truncate font-medium text-slate-900">{nombreVisible}</span>
                  {remitente && <span className="block truncate text-xs text-slate-500">{remitente.email}</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Etiquetas</dt>
                <dd className="font-medium text-slate-900 text-right">{selectedTags.length > 0 ? selectedTags.join(', ') : '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Asunto</dt>
                <dd className="font-medium text-slate-900 text-right truncate max-w-48">{asunto || '—'}</dd>
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
                {borradorFallo ? 'No se pudo guardar el borrador: las imágenes no caben en este navegador' : guardadoA ? `Borrador guardado a las ${formatHora(guardadoA)}` : 'El borrador se guarda solo en este navegador'}
              </p>
            </div>
          </Panel>
        </aside>
      </form>

      {editorAbierto && esCampana && (
        <EmailDesigner bloques={bloques} estilos={estilos} onChange={guardarDiseno} onClose={cerrarEditor} />
      )}
      <SenderManager isOpen={remitentesOpen} onClose={cerrarRemitentes} remitentes={remitentes || []} onCambio={cargarRemitentes} />
      <ReuseCampaignModal isOpen={reusarOpen} onClose={cerrarReusar} cargando={reusando} onElegir={(c) => reutilizarCampana(c.nombre)} />
    </div>
  );
}
