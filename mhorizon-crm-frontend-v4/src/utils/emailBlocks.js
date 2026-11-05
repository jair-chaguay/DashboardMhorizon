// Correo con diseño (formato campaña): bloques que se convierten en HTML para correo.
// Todo va en tablas con estilos en línea porque Gmail y Outlook ignoran casi todo el CSS
import { EMAIL_ASSETS } from './emailAssets';

const C = { navy: '#171E27', orange: '#D4681C', text: '#1f2937', muted: '#4b5563' };
const FONT = 'Arial, Helvetica, sans-serif';
export const ANCHO_CORREO = 600;

// Fondo exterior y margen lateral: lo que hace que se vea como campaña y no como un correo escrito
export const ESTILOS_BASE = { fondo: '#eef0f3', margen: 24 };
export const FONDOS = [['#eef0f3', 'Gris claro'], ['#ffffff', 'Blanco'], ['#fdf4ec', 'Crema'], ['#171e27', 'Azul oscuro']];
export const MARGENES = [0, 16, 24, 32, 40];
export const COLORES_BOTON = { naranja: C.orange, azul: C.navy };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const conSaltos = (s) => esc(s).replace(/\n/g, '<br>');
// Solo enlaces e imágenes con esquemas seguros; el resto se descarta
export const enlaceSeguro = (url) => { const u = String(url || '').trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ''; };
export const imagenSegura = (url) => { const u = String(url || '').trim(); return /^https?:\/\//i.test(u) || /^data:image\/(png|jpe?g|gif|webp)[;,]/i.test(u) ? u : ''; };
export const esIncrustada = (url) => /^data:image\//i.test(String(url || ''));

const tabla = (filas, extra = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${extra}">${filas}</table>`;
const fila = (contenido, padding) => tabla(`<tr><td style="padding:${padding}">${contenido}</td></tr>`);
const vacio = (texto, m) => fila(`<div style="border:2px dashed #cbd5e1;border-radius:6px;padding:36px 12px;text-align:center;font:14px ${FONT};color:#64748b;background:#f8fafc">${esc(texto)}</div>`, `8px ${m}px`);
const conEnlace = (html, url) => { const href = enlaceSeguro(url); return href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none">${html}</a>` : html; };
const boton = (texto, url, color = C.orange, margen = '6px 8px') => `<a href="${esc(enlaceSeguro(url) || '#')}" target="_blank" style="display:inline-block;margin:${margen};background:${color};border-radius:6px;padding:14px 26px;font:bold 15px ${FONT};color:#ffffff;text-decoration:none;text-transform:uppercase">${esc(texto)}</a>`;

export const REDES = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['linkedin', 'LinkedIn'], ['web', 'Sitio web']];
const redesHtml = (redes = {}) => REDES.map(([key, nombre]) => {
  const href = enlaceSeguro(redes[key]);
  return href ? `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 5px;text-decoration:none"><img src="${EMAIL_ASSETS.redes[key]}" alt="${nombre}" width="36" height="36" style="display:block;width:36px;height:36px;border:0"></a>` : '';
}).join('');

// Darse de baja: va siempre en el pie. El worker cambia {{enlace_baja}} por el enlace de cada destinatario
// (/track/unsubscribe?email=...), que lo saca de los envíos y le pone la etiqueta "Desuscrito" (ver BACKEND.md)
export const ENLACE_BAJA = '{{enlace_baja}}';
export const BAJA_BASE = { bajaTexto: 'Si ya no deseas recibir nuestros correos, puedes', bajaBoton: 'darte de baja aquí' };
// Discreto: una línea pequeña y gris con el enlace subrayado, sin botón
const bajaHtml = (b) => {
  const texto = String(b.bajaTexto ?? BAJA_BASE.bajaTexto).trim();
  const etiqueta = String(b.bajaBoton || '').trim() || BAJA_BASE.bajaBoton;
  const enlace = `<a href="${ENLACE_BAJA}" target="_blank" style="color:${C.muted};text-decoration:underline">${esc(etiqueta)}</a>`;
  return `<p style="margin:10px 0 0;font:11px/1.6 ${FONT};color:${C.muted}">${texto ? `${conSaltos(texto)} ` : ''}${enlace}.</p>`;
};

const RENDER = {
  imagen: (b, m) => {
    const src = imagenSegura(b.imagen);
    if (!src) return vacio('Imagen: sube un archivo o pega un enlace', m);
    if (b.modo === 'rellenar') {
      const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${ANCHO_CORREO}" style="display:block;width:100%;max-width:${ANCHO_CORREO}px;height:auto;border:0">`;
      return tabla(`<tr><td style="padding:0">${conEnlace(img, b.enlace)}</td></tr>`);
    }
    const ancho = Math.round((ANCHO_CORREO - 2 * m) * (Number(b.ancho) || 100) / 100);
    const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${ancho}" style="display:inline-block;width:100%;max-width:${ancho}px;height:auto;border:0;vertical-align:top">`;
    return fila(`<div style="text-align:${b.alineacion || 'center'};line-height:0">${conEnlace(img, b.enlace)}</div>`, `6px ${m}px`);
  },
  encabezado: (b, m) => {
    const size = { grande: 28, mediano: 22, pequeno: 17 }[b.tamano] || 28;
    if (b.estilo === 'franja') {
      return fila(tabla(`<tr><td style="background:${C.navy};border-radius:6px;padding:13px 16px;text-align:center;font:bold ${Math.min(size, 22)}px/1.3 ${FONT};color:#ffffff">${conSaltos(b.texto)}</td></tr>`), `8px ${m}px`);
    }
    const borde = b.estilo === 'barra' ? `border-left:5px solid ${C.orange};padding:4px 0 4px 18px;` : '';
    const alin = b.estilo === 'barra' ? 'left' : (b.alineacion || 'left');
    return fila(tabla(`<tr><td style="${borde}font:bold ${size}px/1.25 ${FONT};color:${C.navy};text-align:${alin}">${conSaltos(b.texto)}</td></tr>`), `20px ${m}px 12px`);
  },
  parrafo: (b, m) => {
    const caja = b.recuadro ? `border:2px solid ${C.navy};padding:12px 14px;` : '';
    return fila(tabla(`<tr><td style="${caja}text-align:${b.alineacion || 'left'};font:${Number(b.tamano) || 15}px/1.6 ${FONT};color:${C.text}">${conSaltos(b.texto)}</td></tr>`), `6px ${m}px`);
  },
  boton: (b, m) => {
    const html = (b.botones || []).filter(x => x.texto).map(x => boton(x.texto, x.url, COLORES_BOTON[b.color])).join('');
    return html ? fila(`<div style="text-align:${b.alineacion || 'center'}">${html}</div>`, `12px ${Math.max(m - 8, 0)}px`) : vacio('Botón sin texto', m);
  },
  divisor: (b, m) => fila(`<div style="border-top:${Number(b.grosor) || 1}px solid ${b.color || '#d1d5db'};font-size:1px;line-height:1px">&nbsp;</div>`, `14px ${m}px`),
  espaciador: (b) => { const alto = Number(b.alto) || 24; return tabla(`<tr><td style="height:${alto}px;line-height:${alto}px;font-size:1px">&nbsp;</td></tr>`); },
  logotipo: (b, m) => {
    const src = imagenSegura(b.logo);
    if (!src) return vacio('Logotipo: sube una imagen', m);
    const ancho = Number(b.ancho) || 120;
    return fila(`<div style="text-align:center;line-height:0">${conEnlace(`<img src="${esc(src)}" alt="MHORIZON" width="${ancho}" style="display:inline-block;width:${ancho}px;max-width:100%;height:auto;border:0">`, b.enlace)}</div>`, `12px ${m}px`);
  },
  redes: (b, m) => { const html = redesHtml(b.redes); return html ? fila(`<div style="text-align:center">${html}</div>`, `10px ${m}px`) : vacio('Redes sociales: agrega al menos un enlace', m); },
  pie: (b, m) => {
    const botones = (b.botones || []).filter(x => x.texto).map(x => boton(x.texto, x.url, C.orange, '6px 14px')).join('');
    const logo = imagenSegura(b.logo);
    const redes = redesHtml(b.redes);
    const textos = [
      b.copyright && `<p style="margin:18px 0 6px;font:italic 12px/1.6 ${FONT};color:${C.text}">${conSaltos(b.copyright)}</p>`,
      b.mensaje && `<p style="margin:0 0 6px;font:12px/1.6 ${FONT};color:${C.text}">${conSaltos(b.mensaje)}</p>`,
      b.direccion && `<p style="margin:14px 0 0;font:12px/1.6 ${FONT};color:${C.text}">${conSaltos(b.direccion)}</p>`,
      bajaHtml(b),
    ].filter(Boolean).join('');
    return fila('<div style="text-align:center">'
      + (botones ? `<div style="padding-bottom:18px">${botones}</div>` : '')
      + (logo ? `<img src="${esc(logo)}" alt="MHORIZON" width="110" style="display:inline-block;width:110px;height:auto;border:0;margin-bottom:12px">` : '')
      + (redes ? `<div>${redes}</div>` : '')
      + (b.botonTexto ? `<div style="padding:18px 0 4px">${boton(b.botonTexto, b.botonUrl, C.orange, '0')}</div>` : '')
      + textos
      + '</div>', `20px ${m}px 28px`);
  },
};

export const renderBloque = (bloque, estilos = ESTILOS_BASE) => (RENDER[bloque.tipo] ? RENDER[bloque.tipo](bloque, Number(estilos.margen) || 0) : '');

// Correo completo: fondo exterior y columna blanca de 600 px
export function renderCorreo(bloques, { estilos = ESTILOS_BASE } = {}) {
  const fondo = estilos.fondo || ESTILOS_BASE.fondo;
  const cuerpo = bloques.map(b => renderBloque(b, estilos)).join('');
  return `<div style="margin:0;padding:32px 0;background:${fondo}">${tabla(`<tr><td align="center" style="padding:0 12px"><table role="presentation" width="${ANCHO_CORREO}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:${ANCHO_CORREO}px;background:#ffffff">${cuerpo ? `<tr><td>${cuerpo}</td></tr>` : ''}</table></td></tr>`)}</div>`;
}

// Bloques que se pueden agregar, con sus valores iniciales (mismos nombres que en Mailchimp)
export const TIPOS_BLOQUE = [
  { tipo: 'imagen', nombre: 'Imagen', base: { imagen: '', original: '', alt: '', enlace: '', ancho: 100, modo: 'escala', alineacion: 'center' } },
  { tipo: 'encabezado', nombre: 'Encabezado', base: { texto: 'Título', estilo: 'barra', tamano: 'grande', alineacion: 'left' } },
  { tipo: 'parrafo', nombre: 'Párrafo', base: { texto: 'Escribe aquí tu texto.', alineacion: 'left', tamano: 15, recuadro: false } },
  { tipo: 'boton', nombre: 'Botón', base: { botones: [{ texto: 'Ver más', url: 'https://mhorizon.com.ec' }], color: 'naranja', alineacion: 'center' } },
  { tipo: 'divisor', nombre: 'Divisor', base: { grosor: 1, color: '#d1d5db' } },
  { tipo: 'espaciador', nombre: 'Espaciador', base: { alto: 24 } },
  { tipo: 'logotipo', nombre: 'Logotipo', base: { logo: EMAIL_ASSETS.logo, ancho: 110, enlace: 'https://mhorizon.com.ec' } },
  { tipo: 'redes', nombre: 'Redes sociales', base: { redes: { facebook: '', instagram: '', x: '', linkedin: '', web: 'https://mhorizon.com.ec' } } },
  {
    tipo: 'pie', nombre: 'Pie de página',
    base: {
      botones: [{ texto: 'Descargar archivo', url: '' }, { texto: 'Sitio web MHORIZON', url: 'https://mhorizon.com.ec' }],
      logo: EMAIL_ASSETS.logo,
      redes: { facebook: '', instagram: '', x: '', linkedin: '', web: 'https://mhorizon.com.ec' },
      botonTexto: 'Suscribirme',
      botonUrl: '',
      copyright: `Copyright (C) ${new Date().getFullYear()} MHORIZON-ECUADOR S.A. Todos los derechos reservados.`,
      mensaje: 'Has recibido este correo electrónico porque estás en nuestra base de datos.',
      ...BAJA_BASE,
      direccion: 'MHORIZON-ECUADOR S.A. - Carchi y Quisquis, Guayaquil - 090301 Ecuador',
    },
  },
];
export const NOMBRE_TIPO = Object.fromEntries(TIPOS_BLOQUE.map(t => [t.tipo, t.nombre]));

let contador = 0;
const nuevoId = () => `b${Date.now().toString(36)}${(contador++).toString(36)}`;
const copiar = (valor) => JSON.parse(JSON.stringify(valor));
export const crearBloque = (tipo, datos = {}) => ({ id: nuevoId(), tipo, ...copiar(TIPOS_BLOQUE.find(t => t.tipo === tipo).base), ...copiar(datos) });
export const duplicarBloque = (bloque) => ({ ...copiar(bloque), id: nuevoId() });
// Un correo nuevo empieza solo con el pie: el contenido (normalmente imágenes) lo pone quien lo arma
export const correoNuevo = () => [crearBloque('pie')];

// Avisos del diseño para la lista "Antes de enviar"
export function revisarBloques(bloques) {
  const imagenes = bloques.flatMap(b => (b.tipo === 'imagen' ? [b.imagen] : b.tipo === 'logotipo' ? [b.logo] : []));
  const sinImagen = imagenes.filter(u => !imagenSegura(u)).length;
  const subidas = imagenes.filter(esIncrustada).length;
  const locales = imagenes.filter(u => /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(u || '')).length;
  const botones = bloques.flatMap(b => [
    ...(b.tipo === 'boton' || b.tipo === 'pie' ? (b.botones || []).filter(x => x.texto) : []),
    ...(b.tipo === 'pie' && b.botonTexto ? [{ url: b.botonUrl }] : []),
  ]);
  const botonesSinEnlace = botones.filter(x => !enlaceSeguro(x.url)).length;
  const tienePie = bloques.some(b => b.tipo === 'pie');
  return { sinImagen, subidas, locales, botonesSinEnlace, tienePie };
}

// Texto de los bloques, para revisar [corchetes] y armar el extracto de la bandeja
export const textoBloques = (bloques) => bloques.flatMap(b => [
  b.tipo === 'encabezado' || b.tipo === 'parrafo' ? b.texto : '',
  ...(b.tipo === 'boton' ? b.botones.map(x => x.texto) : []),
]).filter(Boolean).join(' ');

// Peso sin las imágenes subidas: el servidor las cambia por enlaces antes de enviar
export const sinImagenesIncrustadas = (html) => html.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, 'https://img');

// Valida lo que viene del borrador o de un diseño guardado
export const bloquesValidos = (lista) => (Array.isArray(lista) ? lista.filter(b => b && typeof b === 'object' && NOMBRE_TIPO[b.tipo] && typeof b.id === 'string') : []);
export const estilosValidos = (e) => ({
  fondo: FONDOS.some(([f]) => f === e?.fondo) ? e.fondo : ESTILOS_BASE.fondo,
  margen: MARGENES.includes(Number(e?.margen)) ? Number(e.margen) : ESTILOS_BASE.margen,
});
