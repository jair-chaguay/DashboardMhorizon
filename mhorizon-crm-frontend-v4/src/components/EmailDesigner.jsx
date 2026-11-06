import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, Plus, X, Image as ImageIcon, Heading1, AlignLeft, MousePointerClick,
  Minus, MoveVertical, Hexagon, Share2, PanelBottom, Monitor, Smartphone, Undo2, Redo2, GripVertical, Crop, Upload, RefreshCw,
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import { ui } from '../utils/theme';
import { formatSize } from '../utils/files';
import { leerImagen, pesoDataUrl, TIPOS_IMAGEN } from '../utils/images';
import { EMAIL_ASSETS } from '../utils/emailAssets';
import {
  ANCHO_CORREO, TIPOS_BLOQUE, NOMBRE_TIPO, FONDOS, REDES, crearBloque, duplicarBloque, renderBloque, esIncrustada, imagenSegura, BAJA_BASE,
} from '../utils/emailBlocks';

const ICONO = {
  imagen: ImageIcon, encabezado: Heading1, parrafo: AlignLeft, boton: MousePointerClick, divisor: Minus,
  espaciador: MoveVertical, logotipo: Hexagon, redes: Share2, pie: PanelBottom,
};
const MAX_BOTONES = 3;
const MAX_HISTORIAL = 60;
const MIME_NUEVO = 'application/x-mhorizon-bloque';
const MIME_MOVER = 'application/x-mhorizon-mover';

// ---------- Controles del panel ----------
const Campo = ({ label, hint, children }) => (
  <div>
    <p className={`${ui.label} mb-1.5`}>{label}</p>
    {children}
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);
const Texto = ({ value, onChange, label, ...props }) => <input type="text" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${ui.input} w-full`} {...props} />;
const Area = ({ value, onChange, rows = 3, label }) => (
  <textarea aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows}
    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 resize-y" />
);
const Check = ({ checked, onChange, children }) => (
  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-600" />
    {children}
  </label>
);
const Segmentos = ({ opciones, valor, onChange, label }) => (
  <div role="group" aria-label={label} className="flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-medium">
    {opciones.map(([key, texto]) => (
      <button type="button" key={key} onClick={() => onChange(key)} aria-pressed={valor === key}
        className={`flex-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${valor === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        {texto}
      </button>
    ))}
  </div>
);
const Rango = ({ label, value, min, max, step = 1, onChange, unidad = '' }) => (
  <Campo label={<span className="flex justify-between"><span>{label}</span><span className="font-normal text-slate-500 tabular-nums">{value}{unidad}</span></span>}>
    <input type="range" aria-label={typeof label === 'string' ? label : undefined} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-600" />
  </Campo>
);
const Seccion = ({ titulo, children }) => (
  <section className="space-y-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
    {titulo && <h4 className="text-xs font-semibold text-slate-500">{titulo}</h4>}
    {children}
  </section>
);

// Lista de botones (texto + enlace), usada por el bloque Botón y por el pie
function ListaBotones({ botones, onChange, ayuda }) {
  const cambiar = (i, campo, valor) => onChange(botones.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));
  return (
    <div className="space-y-2.5">
      {ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
      {botones.map((b, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
          <div className="flex gap-2">
            <Texto value={b.texto} onChange={(v) => cambiar(i, 'texto', v)} label={`Texto del botón ${i + 1}`} placeholder="Texto del botón" />
            <button type="button" onClick={() => onChange(botones.filter((_, j) => j !== i))} aria-label={`Quitar botón ${i + 1}`}
              className="h-10 w-9 shrink-0 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><X size={15} /></button>
          </div>
          <Texto value={b.url} onChange={(v) => cambiar(i, 'url', v)} label={`Enlace del botón ${i + 1}`} placeholder="https://..." />
        </div>
      ))}
      <button type="button" disabled={botones.length >= MAX_BOTONES} onClick={() => onChange([...botones, { texto: '', url: '' }])}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed">
        <Plus size={14} />Agregar botón
      </button>
    </div>
  );
}

function CamposRedes({ redes, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Solo se muestran las redes que tengan enlace.</p>
      {REDES.map(([key, nombre]) => (
        <div key={key} className="flex items-center gap-2">
          <img src={EMAIL_ASSETS.redes[key]} alt="" className="h-7 w-7 shrink-0" />
          <Texto value={redes?.[key]} onChange={(v) => onChange({ ...redes, [key]: v })} label={nombre} placeholder={nombre} />
        </div>
      ))}
    </div>
  );
}

// Subir una imagen: botón, arrastrar un archivo o pegar un enlace
function SubirImagen({ onArchivo, onEnlace, error }) {
  const [sobre, setSobre] = useState(false);
  const [enlace, setEnlace] = useState('');
  const input = useRef(null);
  return (
    <div className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files?.[0]; if (f) onArchivo(f); }}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${sobre ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
        <p className="text-sm font-semibold text-slate-800">Añadir imagen</p>
        <p className="text-xs text-slate-500 mt-1">PNG, JPG o GIF. Hasta 10 MB.</p>
        <input ref={input} type="file" accept={TIPOS_IMAGEN.join(',')} className="sr-only" aria-label="Elegir imagen"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
        <button type="button" onClick={() => input.current?.click()} className={`${ui.btn} mt-3 h-9`}><Upload size={15} /> Subir desde el equipo</button>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <Texto value={enlace} onChange={setEnlace} label="Enlace de una imagen" placeholder="o pega el enlace de una imagen" />
        <button type="button" disabled={!/^https?:\/\//i.test(enlace.trim())} onClick={() => { onEnlace(enlace.trim()); setEnlace(''); }} className={`${ui.btn} h-10 shrink-0`}>Usar</button>
      </div>
    </div>
  );
}

function Miniatura({ src, onSustituir, onRecortar, onQuitar, puedeRecortar }) {
  const input = useRef(null);
  const peso = esIncrustada(src) ? formatSize(pesoDataUrl(src)) : 'Enlace externo';
  return (
    <div className="rounded-lg border border-slate-200 p-2.5">
      <div className="rounded-md bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-2"><img src={src} alt="" className="mx-auto max-h-40 w-auto" /></div>
      <p className="mt-2 text-xs text-slate-500">{peso}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <input ref={input} type="file" accept={TIPOS_IMAGEN.join(',')} className="sr-only" aria-label="Sustituir imagen"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onSustituir(f); e.target.value = ''; }} />
        <button type="button" onClick={() => input.current?.click()} className={`${ui.btn} h-8 px-2.5 text-[13px]`}><RefreshCw size={13} /> Sustituir</button>
        {onRecortar && (
          <button type="button" onClick={onRecortar} disabled={!puedeRecortar} title={puedeRecortar ? '' : 'Para recortar, sube la imagen desde tu equipo'}
            className={`${ui.btn} h-8 px-2.5 text-[13px]`}><Crop size={13} /> Recortar</button>
        )}
        {onQuitar && <button type="button" onClick={onQuitar} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 size={13} /> Quitar</button>}
      </div>
    </div>
  );
}

// ---------- Formulario de cada bloque ----------
function EditorBloque({ bloque, cambiar, onRecortar }) {
  const [error, setError] = useState('');
  const set = (campo) => (valor) => cambiar({ [campo]: valor });
  const subir = (campo, recortarDespues) => async (file) => {
    setError('');
    try {
      const data = await leerImagen(file);
      cambiar(campo === 'imagen' ? { imagen: data, original: data } : { [campo]: data });
      if (recortarDespues && file.type !== 'image/gif') onRecortar(data);
    } catch (e) {
      setError(e.message || 'No se pudo leer la imagen.');
    }
  };

  switch (bloque.tipo) {
    case 'imagen':
      return (
        <>
          <Seccion>
            {imagenSegura(bloque.imagen)
              ? <Miniatura src={bloque.imagen} onSustituir={subir('imagen')} puedeRecortar={esIncrustada(bloque.original || bloque.imagen) && !/^data:image\/gif/i.test(bloque.imagen)}
                onRecortar={() => onRecortar(bloque.original || bloque.imagen)} onQuitar={() => cambiar({ imagen: '', original: '' })} />
              : <SubirImagen onArchivo={subir('imagen')} onEnlace={(url) => cambiar({ imagen: url, original: '' })} error={error} />}
            {error && imagenSegura(bloque.imagen) && <p className="text-xs font-medium text-rose-600">{error}</p>}
          </Seccion>
          <Seccion titulo="Tamaño">
            <Segmentos label="Tamaño" opciones={[['escala', 'Escala'], ['rellenar', 'Borde a borde']]} valor={bloque.modo} onChange={set('modo')} />
            {bloque.modo === 'escala' ? (
              <>
                <Rango label="Escala" value={bloque.ancho} min={10} max={100} unidad="%" onChange={set('ancho')} />
                {bloque.ancho < 100 && <Segmentos label="Alineación" opciones={[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]} valor={bloque.alineacion} onChange={set('alineacion')} />}
              </>
            ) : <p className="text-xs text-slate-500">Ocupa todo el ancho de la columna blanca, sin espacio a los lados, pero nunca invade los márgenes de color. Ideal para la cabecera.</p>}
          </Seccion>
          <Seccion titulo="Enlace">
            <Texto value={bloque.enlace} onChange={set('enlace')} label="Enlace de la imagen" placeholder="https://example.com" />
            <p className="text-xs text-slate-500">Al pulsar la imagen se abre en una pestaña nueva.</p>
          </Seccion>
          <Seccion titulo="Texto alternativo">
            <Texto value={bloque.alt} onChange={set('alt')} label="Texto alternativo" placeholder="Ej. Calendario de obligaciones" />
            <p className="text-xs text-slate-500">Se lee cuando el correo bloquea las imágenes.</p>
          </Seccion>
        </>
      );
    case 'encabezado':
      return (
        <>
          <Seccion><Campo label="Texto" hint="Enter para pasar a otra línea."><Area value={bloque.texto} onChange={set('texto')} label="Texto del encabezado" /></Campo></Seccion>
          <Seccion titulo="Estilo">
            <Segmentos label="Estilo" opciones={[['barra', 'Barra naranja'], ['franja', 'Franja oscura'], ['simple', 'Simple']]} valor={bloque.estilo} onChange={set('estilo')} />
            <Segmentos label="Tamaño" opciones={[['grande', 'Grande'], ['mediano', 'Mediano'], ['pequeno', 'Pequeño']]} valor={bloque.tamano} onChange={set('tamano')} />
            {bloque.estilo === 'simple' && <Segmentos label="Alineación" opciones={[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]} valor={bloque.alineacion} onChange={set('alineacion')} />}
          </Seccion>
        </>
      );
    case 'parrafo':
      return (
        <>
          <Seccion><Campo label="Texto" hint="Enter para pasar a otra línea."><Area value={bloque.texto} onChange={set('texto')} rows={7} label="Texto del párrafo" /></Campo></Seccion>
          <Seccion titulo="Estilo">
            <Segmentos label="Alineación" opciones={[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]} valor={bloque.alineacion} onChange={set('alineacion')} />
            <Rango label="Tamaño de letra" value={bloque.tamano} min={12} max={20} unidad=" px" onChange={set('tamano')} />
            <Check checked={bloque.recuadro} onChange={set('recuadro')}>Con recuadro</Check>
          </Seccion>
        </>
      );
    case 'boton':
      return (
        <>
          <Seccion><ListaBotones botones={bloque.botones} onChange={set('botones')} ayuda="Cada botón lleva a su enlace. En el celular se acomodan uno debajo del otro." /></Seccion>
          <Seccion titulo="Estilo">
            <Segmentos label="Color" opciones={[['naranja', 'Naranja'], ['azul', 'Azul oscuro']]} valor={bloque.color} onChange={set('color')} />
            <Segmentos label="Alineación" opciones={[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]} valor={bloque.alineacion} onChange={set('alineacion')} />
          </Seccion>
        </>
      );
    case 'divisor':
      return (
        <Seccion>
          <Rango label="Grosor" value={bloque.grosor} min={1} max={4} unidad=" px" onChange={set('grosor')} />
          <Segmentos label="Color" opciones={[['#d1d5db', 'Gris'], ['#D4681C', 'Naranja'], ['#171E27', 'Azul oscuro']]} valor={bloque.color} onChange={set('color')} />
        </Seccion>
      );
    case 'espaciador':
      return <Seccion><Rango label="Alto" value={bloque.alto} min={8} max={96} step={4} unidad=" px" onChange={set('alto')} /></Seccion>;
    case 'logotipo':
      return (
        <>
          <Seccion>
            <Miniatura src={bloque.logo || EMAIL_ASSETS.logo} onSustituir={subir('logo')} />
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            {bloque.logo !== EMAIL_ASSETS.logo && <button type="button" onClick={() => cambiar({ logo: EMAIL_ASSETS.logo })} className="text-[13px] font-semibold text-brand-700 hover:underline cursor-pointer">Usar el logo de MHORIZON</button>}
          </Seccion>
          <Seccion titulo="Tamaño"><Rango label="Ancho" value={bloque.ancho} min={60} max={240} step={10} unidad=" px" onChange={set('ancho')} /></Seccion>
          <Seccion titulo="Enlace"><Texto value={bloque.enlace} onChange={set('enlace')} label="Enlace del logotipo" placeholder="https://mhorizon.com.ec" /></Seccion>
        </>
      );
    case 'redes':
      return <Seccion><CamposRedes redes={bloque.redes} onChange={set('redes')} /></Seccion>;
    case 'pie':
      return (
        <>
          <Seccion titulo="Botones">
            <ListaBotones botones={bloque.botones} onChange={set('botones')} ayuda="Cambia el enlace de cada uno: por ejemplo el del archivo para descargar." />
          </Seccion>
          <Seccion titulo="Logo">
            {bloque.logo
              ? <Miniatura src={bloque.logo} onSustituir={subir('logo')} onQuitar={() => cambiar({ logo: '' })} />
              : <button type="button" onClick={() => cambiar({ logo: EMAIL_ASSETS.logo })} className="text-[13px] font-semibold text-brand-700 hover:underline cursor-pointer">Poner el logo de MHORIZON</button>}
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          </Seccion>
          <Seccion titulo="Redes sociales"><CamposRedes redes={bloque.redes} onChange={set('redes')} /></Seccion>
          <Seccion titulo="Botón de suscripción">
            <Texto value={bloque.botonTexto} onChange={set('botonTexto')} label="Texto del botón de suscripción" placeholder="Vacío = sin botón" />
            <Texto value={bloque.botonUrl} onChange={set('botonUrl')} label="Enlace del botón de suscripción" placeholder="https://..." />
          </Seccion>
          <Seccion titulo="Textos legales">
            <Campo label="Derechos reservados"><Area value={bloque.copyright} onChange={set('copyright')} rows={2} label="Derechos reservados" /></Campo>
            <Campo label="Por qué lo recibe"><Area value={bloque.mensaje} onChange={set('mensaje')} rows={2} label="Por qué lo recibe" /></Campo>
            <Campo label="Dirección"><Area value={bloque.direccion} onChange={set('direccion')} rows={2} label="Dirección" /></Campo>
          </Seccion>
          <Seccion titulo="Darse de baja">
            <Campo label="Texto"><Area value={bloque.bajaTexto ?? BAJA_BASE.bajaTexto} onChange={set('bajaTexto')} rows={2} label="Texto para darse de baja" /></Campo>
            <Texto value={bloque.bajaBoton ?? BAJA_BASE.bajaBoton} onChange={set('bajaBoton')} label="Texto del enlace" placeholder={BAJA_BASE.bajaBoton} />
            <p className="text-xs text-slate-500">Va siempre al final del pie, en letra pequeña. El enlace lo pone el servidor para cada persona: quien se da de baja sale de la cola de envíos y su etiqueta pasa a ser «Desuscrito».</p>
          </Seccion>
        </>
      );
    default:
      return null;
  }
}

// ---------- Editor ----------
// Línea donde caerá el bloque que se arrastra
const Linea = () => (
  <div className="pointer-events-none relative z-20 h-0">
    <div className="absolute -top-px inset-x-0 h-0.5 bg-navy-700">
      <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-navy-700" />
      <span className="absolute -right-1.5 -top-[5px] h-3 w-3 rounded-full bg-navy-700" />
    </div>
  </div>
);
const BotonLado = ({ onClick, label, disabled, children, danger, ...props }) => (
  <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={disabled} aria-label={label} title={label} {...props}
    className={`h-8 w-8 grid place-items-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default ${danger ? 'text-rose-600 hover:bg-rose-50' : ''}`}>
    {children}
  </button>
);

// Editor a pantalla completa, como el de Mailchimp: bloques a la izquierda, el correo al centro.
// Los bloques se arrastran al correo (o se pulsan para agregarlos bajo el bloque elegido)
export default function EmailDesigner({ bloques: bloquesIniciales, estilos: estilosIniciales, onChange, onClose }) {
  const [doc, setDoc] = useState({ bloques: bloquesIniciales, estilos: estilosIniciales });
  const [historial, setHistorial] = useState({ atras: [], adelante: [] });
  const ultimoCambio = useRef({ clave: null, t: 0 });
  const [seleccion, setSeleccion] = useState(null);
  const [pestana, setPestana] = useState('bloques');
  const [dispositivo, setDispositivo] = useState('escritorio');
  const [destino, setDestino] = useState(null); // índice donde caería lo que se arrastra
  const [recorte, setRecorte] = useState(null); // { id, src }
  const arrastrando = useRef(null);
  const refs = useRef({});
  const { bloques, estilos } = doc;
  const actual = bloques.find(b => b.id === seleccion);

  // Cada cambio se guarda en el historial; las teclas seguidas en un mismo campo cuentan como un solo paso
  const docRef = useRef(doc);
  const aplicar = useCallback((siguiente, clave = null) => {
    const prev = docRef.current;
    const nuevo = typeof siguiente === 'function' ? siguiente(prev) : siguiente;
    const ahora = Date.now();
    const juntar = clave && ultimoCambio.current.clave === clave && ahora - ultimoCambio.current.t < 1200;
    ultimoCambio.current = { clave, t: ahora };
    if (!juntar) setHistorial(h => ({ atras: [...h.atras, prev].slice(-MAX_HISTORIAL), adelante: [] }));
    docRef.current = nuevo;
    setDoc(nuevo);
  }, []);

  useEffect(() => { onChange(doc.bloques, doc.estilos); }, [doc, onChange]);

  const irA = (nuevo, nuevoHistorial) => {
    ultimoCambio.current = { clave: null, t: 0 };
    docRef.current = nuevo;
    setDoc(nuevo);
    setHistorial(nuevoHistorial);
  };
  const deshacer = () => {
    if (historial.atras.length === 0) return;
    irA(historial.atras[historial.atras.length - 1], { atras: historial.atras.slice(0, -1), adelante: [doc, ...historial.adelante] });
  };
  const rehacer = () => {
    if (historial.adelante.length === 0) return;
    const [siguiente, ...resto] = historial.adelante;
    irA(siguiente, { atras: [...historial.atras, doc], adelante: resto });
  };
  const atajos = useRef({});
  atajos.current = { deshacer, rehacer };

  useEffect(() => {
    const onKey = (e) => {
      const enCampo = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !enCampo) { e.preventDefault(); if (e.shiftKey) atajos.current.rehacer(); else atajos.current.deshacer(); }
      if (e.key === 'Escape' && !recorte) { if (seleccion) setSeleccion(null); else onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seleccion, recorte, onClose]);

  // La página de atrás no se desplaza mientras el editor está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const cambiarBloque = (id, cambios) => aplicar(d => ({ ...d, bloques: d.bloques.map(b => (b.id === id ? { ...b, ...cambios } : b)) }), `${id}:${Object.keys(cambios).join()}`);
  const cambiarEstilos = (cambios) => aplicar(d => ({ ...d, estilos: { ...d.estilos, ...cambios } }));
  const insertar = (bloque, posicion) => { aplicar(d => ({ ...d, bloques: [...d.bloques.slice(0, posicion), bloque, ...d.bloques.slice(posicion)] })); setSeleccion(bloque.id); };
  const moverA = (id, posicion) => aplicar(d => {
    const desde = d.bloques.findIndex(b => b.id === id);
    if (desde < 0) return d;
    const lista = [...d.bloques];
    const [b] = lista.splice(desde, 1);
    lista.splice(posicion > desde ? posicion - 1 : posicion, 0, b);
    return { ...d, bloques: lista };
  });
  const quitar = (id) => { aplicar(d => ({ ...d, bloques: d.bloques.filter(b => b.id !== id) })); if (seleccion === id) setSeleccion(null); };
  const duplicar = (id) => {
    const i = bloques.findIndex(b => b.id === id);
    insertar(duplicarBloque(bloques[i]), i + 1);
  };

  // Al pulsar un bloque de la lista: debajo del bloque elegido, o justo antes del pie
  const posicionPorDefecto = () => {
    const i = bloques.findIndex(b => b.id === seleccion);
    if (i >= 0) return i + 1;
    const pie = bloques.findIndex(b => b.tipo === 'pie');
    return pie >= 0 ? pie : bloques.length;
  };

  const imagenDesdeArchivo = async (file, posicion) => {
    try {
      const data = await leerImagen(file);
      insertar(crearBloque('imagen', { imagen: data, original: data, alt: file.name.replace(/\.[a-z]+$/i, '') }), posicion);
    } catch { /* tipo o peso no válido: el bloque no se crea */ }
  };

  // ----- Arrastrar y soltar -----
  const calcularDestino = (clientY) => {
    let i = 0;
    for (; i < bloques.length; i++) {
      const el = refs.current[bloques[i].id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) break;
    }
    return i;
  };
  const alArrastrarSobre = (e) => {
    const tipos = Array.from(e.dataTransfer.types || []);
    if (!arrastrando.current && !tipos.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = arrastrando.current?.mover ? 'move' : 'copy';
    const i = calcularDestino(e.clientY);
    if (i !== destino) setDestino(i);
  };
  const alSoltar = (e) => {
    e.preventDefault();
    const i = destino ?? calcularDestino(e.clientY);
    const a = arrastrando.current;
    setDestino(null);
    arrastrando.current = null;
    if (a?.tipo) insertar(crearBloque(a.tipo), i);
    else if (a?.mover) moverA(a.mover, i);
    else {
      const file = Array.from(e.dataTransfer.files || []).find(f => TIPOS_IMAGEN.includes(f.type));
      if (file) imagenDesdeArchivo(file, i);
    }
  };
  const terminarArrastre = () => { arrastrando.current = null; setDestino(null); };

  const ancho = dispositivo === 'movil' ? 375 : ANCHO_CORREO;

  return (
    <div role="dialog" aria-modal="true" aria-label="Editor del correo" className="fixed inset-0 z-[60] flex flex-col bg-white animate-fade-in">
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Cerrar editor" className="h-9 w-9 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
          <p className="truncate text-[15px] font-semibold text-slate-900">Diseño del correo</p>
        </div>
        <div className="hidden sm:flex rounded-lg bg-slate-100 p-0.5">
          {[['escritorio', Monitor, 'Escritorio'], ['movil', Smartphone, 'Móvil']].map(([key, Icon, label]) => (
            <button type="button" key={key} onClick={() => setDispositivo(key)} aria-pressed={dispositivo === key} aria-label={label} title={label}
              className={`h-8 w-10 grid place-items-center rounded-md cursor-pointer ${dispositivo === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={deshacer} disabled={historial.atras.length === 0} aria-label="Deshacer" title="Deshacer (Ctrl+Z)" className="h-9 w-9 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"><Undo2 size={17} /></button>
          <button type="button" onClick={rehacer} disabled={historial.adelante.length === 0} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" className="h-9 w-9 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"><Redo2 size={17} /></button>
          <button type="button" onClick={onClose} className={`${ui.btnPrimary} ml-2 h-9`}>Listo</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Panel: lista de bloques y estilos, o la configuración del bloque elegido */}
        <aside className="order-2 lg:order-1 flex h-[46vh] lg:h-auto w-full lg:w-[320px] shrink-0 flex-col border-t lg:border-t-0 lg:border-r border-slate-200 bg-white">
          {actual ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
                <button type="button" onClick={() => setSeleccion(null)} aria-label="Volver a los bloques" className="h-8 w-8 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"><ArrowLeft size={17} /></button>
                <p className="flex-1 text-center text-[15px] font-semibold text-slate-900 pr-8">{NOMBRE_TIPO[actual.tipo]}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <EditorBloque key={actual.id} bloque={actual} cambiar={(c) => cambiarBloque(actual.id, c)} onRecortar={(src) => setRecorte({ id: actual.id, src })} />
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                <button type="button" onClick={() => duplicar(actual.id)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"><Copy size={14} /> Duplicar</button>
                <button type="button" onClick={() => quitar(actual.id)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-600 hover:underline cursor-pointer"><Trash2 size={14} /> Eliminar bloque</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex border-b border-slate-100 px-2">
                {[['bloques', 'Bloques'], ['estilos', 'Estilos']].map(([key, label]) => (
                  <button type="button" key={key} onClick={() => setPestana(key)} aria-pressed={pestana === key}
                    className={`flex-1 border-b-2 px-3 py-3 text-sm font-semibold cursor-pointer ${pestana === key ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {pestana === 'bloques' ? (
                  <>
                    <p className="text-[13px] font-semibold text-slate-800">Bloques de contenido</p>
                    <p className="mt-0.5 text-xs text-slate-500">Arrastra un bloque al correo, o púlsalo para agregarlo debajo del bloque elegido. También puedes soltar una imagen de tu equipo sobre el correo.</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {TIPOS_BLOQUE.map(({ tipo, nombre }) => {
                        const Icono = ICONO[tipo];
                        return (
                          <button type="button" key={tipo} draggable
                            onDragStart={(e) => { arrastrando.current = { tipo }; e.dataTransfer.setData(MIME_NUEVO, tipo); e.dataTransfer.effectAllowed = 'copy'; }}
                            onDragEnd={terminarArrastre}
                            onClick={() => insertar(crearBloque(tipo), posicionPorDefecto())}
                            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 cursor-grab active:cursor-grabbing transition-colors">
                            <Icono size={18} className="text-slate-500" />
                            <span className="leading-tight">{nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-5">
                    <Campo label="Fondo exterior" hint="El color de los márgenes laterales. El correo mide siempre 600 px de ancho: las imágenes se ajustan a ese ancho y nunca invaden los márgenes.">
                      <div className="flex flex-wrap gap-2">
                        {FONDOS.map(([color, nombre]) => (
                          <button type="button" key={color} onClick={() => cambiarEstilos({ fondo: color })} aria-pressed={estilos.fondo === color} title={nombre}
                            className={`h-9 w-9 rounded-lg border cursor-pointer ${estilos.fondo === color ? 'ring-2 ring-brand-600 ring-offset-2 border-transparent' : 'border-slate-300'}`} style={{ background: color }}>
                            <span className="sr-only">{nombre}</span>
                          </button>
                        ))}
                      </div>
                    </Campo>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Correo */}
        <main className="order-1 lg:order-2 min-h-0 flex-1 overflow-auto transition-colors" style={{ background: estilos.fondo }}
          onClick={() => setSeleccion(null)}>
          {/* Los márgenes de color siempre se ven y la columna no se encoge: si la pantalla es angosta, se desplaza */}
          <div className="w-max min-w-full px-4 py-6 sm:px-12 sm:py-10">
            <div className="relative mx-auto bg-white shadow-sm transition-[width] duration-300" style={{ width: ancho }}
              onDragOver={alArrastrarSobre} onDrop={alSoltar}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(null); }}
              onClickCapture={(e) => { if (e.target.closest('a')) e.preventDefault(); }}>
              {bloques.length === 0 && (
                <div className="px-6 py-16 text-center text-sm text-slate-500">Arrastra aquí el primer bloque.</div>
              )}
              {bloques.map((b, i) => {
                const activo = b.id === seleccion;
                return (
                  <div key={b.id}>
                    {destino === i && <Linea />}
                    <div ref={(el) => { refs.current[b.id] = el; }} role="button" tabIndex={0} aria-label={`Editar ${NOMBRE_TIPO[b.tipo]}`} aria-pressed={activo}
                      onClick={(e) => { e.stopPropagation(); setSeleccion(b.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setSeleccion(b.id); }}
                      className={`group relative cursor-pointer outline-offset-[-1px] ${activo ? 'outline outline-2 outline-navy-700' : 'hover:outline hover:outline-1 hover:outline-navy-700/50'}`}>
                      {(activo) && <span className="absolute left-0 -top-5 z-10 rounded-t-md bg-navy-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{NOMBRE_TIPO[b.tipo]}</span>}
                      <div dangerouslySetInnerHTML={{ __html: renderBloque(b, estilos) }} />
                      {/* Herramientas al costado, fuera del correo (dentro en celular) */}
                      <div className={`absolute top-0 z-10 flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md right-1 sm:right-auto sm:left-full sm:ml-2 ${activo ? 'flex' : 'hidden group-hover:flex'}`}>
                        <BotonLado label="Arrastrar para mover" draggable
                          onDragStart={(e) => { e.stopPropagation(); arrastrando.current = { mover: b.id }; e.dataTransfer.setData(MIME_MOVER, b.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={terminarArrastre}><GripVertical size={15} /></BotonLado>
                        <BotonLado label="Subir" disabled={i === 0} onClick={() => moverA(b.id, i - 1)}><ArrowUp size={15} /></BotonLado>
                        <BotonLado label="Bajar" disabled={i === bloques.length - 1} onClick={() => moverA(b.id, i + 2)}><ArrowDown size={15} /></BotonLado>
                        <BotonLado label="Duplicar" onClick={() => duplicar(b.id)}><Copy size={14} /></BotonLado>
                        <BotonLado label="Eliminar" danger onClick={() => quitar(b.id)}><Trash2 size={14} /></BotonLado>
                      </div>
                    </div>
                  </div>
                );
              })}
              {destino === bloques.length && <Linea />}
            </div>
          </div>
        </main>
      </div>

      {recorte && (
        <ImageCropper src={recorte.src} onCancel={() => setRecorte(null)}
          onDone={(data) => { cambiarBloque(recorte.id, { imagen: data }); setRecorte(null); }} />
      )}
    </div>
  );
}
