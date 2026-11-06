// Correo con diseño (formato campaña): bloques que se convierten en HTML para correo.
// Todo va en tablas con estilos en línea porque Gmail y Outlook ignoran casi todo el CSS
import { EMAIL_ASSETS } from './emailAssets';

const C = { navy: '#171E27', orange: '#D4681C', text: '#1f2937', muted: '#4b5563' };
const FONT = 'Arial, Helvetica, sans-serif';
export const ANCHO_CORREO = 600;

// Fondo exterior: los márgenes laterales de color alrededor de la columna de 600 px, como en Mailchimp.
// Siempre están y no cambian de tamaño; solo se elige su color. Dentro de la columna, el contenido deja 24 px
// a cada lado (salvo las imágenes "borde a borde", que llegan al borde de la columna y nunca la pasan)
export const ESTILOS_BASE = { fondo: '#eef0f3', margen: 24 };
export const FONDOS = [['#eef0f3', 'Gris claro'], ['#ffffff', 'Blanco'], ['#fdf4ec', 'Crema'], ['#171e27', 'Azul oscuro']];
export const COLORES_BOTON = { naranja: C.orange, azul: C.navy };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const conSaltos = (s) => esc(s).replace(/\n/g, '<br>');
// Solo enlaces e imágenes con esquemas seguros; el resto se descarta
export const enlaceSeguro = (url) => { const u = String(url || '').trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ''; };
export const imagenSegura = (url) => { const u = String(url || '').trim(); return /^https?:\/\//i.test(u) || /^data:image\/(png|jpe?g|gif|webp)[;,]/i.test(u) ? u : ''; };
export const esIncrustada = (url) => /^data:image\//i.test(String(url || ''));

// Outlook de escritorio (Windows) arma el correo con el motor de Word: ignora padding, margin, display y
// border-radius en <a> y <div>, y también max-width. Por eso todo lo que da forma (márgenes, cajas)
// va en celdas de tabla con atributos (bgcolor, align, width), el ancho de 600 px se fija con una tabla
// que solo lee Outlook (comentarios <!--[if mso]>) y los botones van en VML. Es la técnica de Mailchimp y Brevo
const mso = (html) => `<!--[if mso]>${html}<![endif]-->`;
const fuente = (size, alto = 1.6, extra = '') => `font-family:${FONT};font-size:${size}px;line-height:${Math.round(size * alto)}px;${extra}`;
const tabla = (filas, extra = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${extra}">${filas}</table>`;
const celda = (contenido, padding, align = 'left', extra = '') => `<td align="${align}" style="padding:${padding};text-align:${align};${extra}">${contenido}</td>`;
const fila = (contenido, padding, align = 'left') => tabla(`<tr>${celda(contenido, padding, align)}</tr>`);
const vacio = (texto, m) => fila(`<div style="border:2px dashed #cbd5e1;border-radius:6px;padding:36px 12px;text-align:center;${fuente(14, 1.4)}color:#64748b;background:#f8fafc">${esc(texto)}</div>`, `8px ${m}px`);
const conEnlace = (html, url) => { const href = enlaceSeguro(url); return href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none">${html}</a>` : html; };

// Botón "a prueba de Outlook", igual que Mailchimp: Outlook de escritorio recibe un rectángulo redondeado en VML
// (su propio formato de dibujo) con el texto centrado en una sola línea; el resto de correos recibe una celda
// con color, esquinas redondeadas y el enlace con relleno para que se pueda pulsar todo el botón
const ALTO_BOTON = 46;
const boton = (texto, url, color = C.orange) => {
  const href = esc(enlaceSeguro(url) || '#');
  const mayus = esc(String(texto).toUpperCase());
  // Ancho para Outlook: el texto en negrita de 15 px ocupa unos 10,5 px por letra, más el relleno de los lados
  const ancho = Math.ceil(String(texto).length * 10.5 + 56);
  const vml = `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${ALTO_BOTON}px;v-text-anchor:middle;width:${ancho}px" arcsize="13%" stroke="f" fillcolor="${color}">`
    + `<w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:bold;white-space:nowrap">${mayus}</center></v:roundrect>`;
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 auto"><tr>`
    + `<td align="center" bgcolor="${color}" style="background:${color};border-radius:6px">`
    + `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;${fuente(15, 1.2, 'font-weight:bold;')}color:#ffffff;text-decoration:none;text-transform:uppercase;white-space:nowrap;border-radius:6px">${esc(texto)}</a>`
    + '</td></tr></table>';
  return mso(vml) + `<!--[if !mso]><!-->${html}<!--<![endif]-->`;
};
// Varios botones en una fila: en Outlook, una celda por botón con su separación; en el resto, bloques que
// bajan a otra línea si no caben (celular)
const grupo = (piezas, align = 'center', separacion = 8, vertical = 6) => {
  if (!piezas.length) return '';
  const abre = mso(`<table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0"><tr>`);
  const cuerpo = piezas.map(html => mso(`<td style="padding:${vertical}px ${separacion}px">`)
    + `<div style="display:inline-block;margin:${vertical}px ${separacion}px;vertical-align:top">${html}</div>`
    + mso('</td>')).join('');
  return `<div style="text-align:${align};font-size:0;line-height:0">${abre}${cuerpo}${mso('</tr></table>')}</div>`;
};
const botones = (lista, color, align, separacion) => grupo((lista || []).filter(x => x.texto).map(x => boton(x.texto, x.url, color)), align, separacion);

export const REDES = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['linkedin', 'LinkedIn'], ['web', 'Sitio web']];
const redesHtml = (redes = {}) => grupo(REDES.map(([key, nombre]) => {
  const href = enlaceSeguro(redes[key]);
  return href ? `<a href="${esc(href)}" target="_blank" style="text-decoration:none"><img src="${EMAIL_ASSETS.redes[key]}" alt="${nombre}" width="36" height="36" style="display:block;width:36px;height:36px;border:0"></a>` : '';
}).filter(Boolean), 'center', 5, 0);

// Darse de baja: va siempre en el pie. El worker cambia {{enlace_baja}} por el enlace de cada destinatario
// (/track/unsubscribe?email=...), que lo saca de los envíos y le pone la etiqueta "Desuscrito" (ver BACKEND.md)
export const ENLACE_BAJA = '{{enlace_baja}}';
export const BAJA_BASE = { bajaTexto: 'Si ya no deseas recibir nuestros correos, puedes', bajaBoton: 'darte de baja aquí' };
// Discreto: una línea pequeña y gris con el enlace subrayado, sin botón
const bajaHtml = (b) => {
  const texto = String(b.bajaTexto ?? BAJA_BASE.bajaTexto).trim();
  const etiqueta = String(b.bajaBoton || '').trim() || BAJA_BASE.bajaBoton;
  const enlace = `<a href="${ENLACE_BAJA}" target="_blank" style="color:${C.muted};text-decoration:underline">${esc(etiqueta)}</a>`;
  return `${texto ? `${conSaltos(texto)} ` : ''}${enlace}.`;
};

const RENDER = {
  imagen: (b, m) => {
    const src = imagenSegura(b.imagen);
    if (!src) return vacio('Imagen: sube un archivo o pega un enlace', m);
    if (b.modo === 'rellenar') {
      const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${ANCHO_CORREO}" style="display:block;width:100%;max-width:${ANCHO_CORREO}px;height:auto;border:0">`;
      return fila(conEnlace(img, b.enlace), '0');
    }
    const ancho = Math.round((ANCHO_CORREO - 2 * m) * (Number(b.ancho) || 100) / 100);
    const align = b.alineacion || 'center';
    const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="${ancho}" style="display:inline-block;width:100%;max-width:${ancho}px;height:auto;border:0;vertical-align:top">`;
    return fila(conEnlace(img, b.enlace), `6px ${m}px`, align);
  },
  encabezado: (b, m) => {
    const size = { grande: 28, mediano: 22, pequeno: 17 }[b.tamano] || 28;
    if (b.estilo === 'franja') {
      const t = Math.min(size, 22);
      return fila(tabla(`<tr><td align="center" bgcolor="${C.navy}" style="background:${C.navy};border-radius:6px;padding:13px 16px;text-align:center;${fuente(t, 1.3, 'font-weight:bold;')}color:#ffffff">${conSaltos(b.texto)}</td></tr>`), `8px ${m}px`);
    }
    const borde = b.estilo === 'barra' ? `border-left:5px solid ${C.orange};padding:4px 0 4px 18px;` : '';
    const alin = b.estilo === 'barra' ? 'left' : (b.alineacion || 'left');
    return fila(tabla(`<tr><td align="${alin}" style="${borde}${fuente(size, 1.25, 'font-weight:bold;')}color:${C.navy};text-align:${alin}">${conSaltos(b.texto)}</td></tr>`), `20px ${m}px 12px`);
  },
  parrafo: (b, m) => {
    const caja = b.recuadro ? `border:2px solid ${C.navy};padding:12px 14px;` : '';
    const alin = b.alineacion || 'left';
    return fila(tabla(`<tr><td align="${alin}" style="${caja}text-align:${alin};${fuente(Number(b.tamano) || 15)}color:${C.text}">${conSaltos(b.texto)}</td></tr>`), `6px ${m}px`);
  },
  boton: (b, m) => {
    const html = botones(b.botones, COLORES_BOTON[b.color], b.alineacion || 'center', 8);
    return html ? fila(html, `6px ${Math.max(m - 8, 0)}px`, b.alineacion || 'center') : vacio('Botón sin texto', m);
  },
  divisor: (b, m) => fila(tabla(`<tr><td style="border-top:${Number(b.grosor) || 1}px solid ${b.color || '#d1d5db'};font-size:1px;line-height:1px;height:1px">&nbsp;</td></tr>`), `14px ${m}px`),
  espaciador: (b) => { const alto = Number(b.alto) || 24; return tabla(`<tr><td style="height:${alto}px;line-height:${alto}px;font-size:1px">&nbsp;</td></tr>`); },
  logotipo: (b, m) => {
    const src = imagenSegura(b.logo);
    if (!src) return vacio('Logotipo: sube una imagen', m);
    const ancho = Number(b.ancho) || 120;
    return fila(conEnlace(`<img src="${esc(src)}" alt="MHORIZON" width="${ancho}" style="display:inline-block;width:${ancho}px;max-width:100%;height:auto;border:0">`, b.enlace), `12px ${m}px`, 'center');
  },
  redes: (b, m) => { const html = redesHtml(b.redes); return html ? fila(html, `10px ${m}px`, 'center') : vacio('Redes sociales: agrega al menos un enlace', m); },
  pie: (b, m) => {
    const logo = imagenSegura(b.logo);
    const texto = (t, size, padding, extra = '') => celda(t, padding, 'center', `${fuente(size, 1.6, extra)}color:${C.text}`);
    const partes = [
      botones(b.botones, C.orange, 'center', 8) && celda(botones(b.botones, C.orange, 'center', 8), '0 0 12px', 'center'),
      logo && celda(`<img src="${esc(logo)}" alt="MHORIZON" width="110" style="display:inline-block;width:110px;height:auto;border:0">`, '0 0 12px', 'center'),
      redesHtml(b.redes) && celda(redesHtml(b.redes), '0', 'center'),
      b.botonTexto && celda(grupo([boton(b.botonTexto, b.botonUrl, C.orange)], 'center', 0, 0), '18px 0 4px', 'center'),
      b.copyright && texto(conSaltos(b.copyright), 12, '18px 0 6px', 'font-style:italic;'),
      b.mensaje && texto(conSaltos(b.mensaje), 12, '0 0 6px'),
      b.direccion && texto(conSaltos(b.direccion), 12, '8px 0 0'),
      celda(bajaHtml(b), '10px 0 0', 'center', `${fuente(11)}color:${C.muted}`),
    ].filter(Boolean);
    return fila(tabla(partes.map(p => `<tr>${p}</tr>`).join('')), `20px ${m}px 28px`, 'center');
  },
};

export const renderBloque = (bloque, estilos = ESTILOS_BASE) => (RENDER[bloque.tipo] ? RENDER[bloque.tipo](bloque, Number(estilos.margen) || 0) : '');

// Correo completo: fondo exterior y columna blanca de 600 px. El fondo va como bgcolor de una tabla
// (Outlook no pinta el fondo de un <div>) y el ancho se fija para Outlook con una tabla de 600 px
export function renderCorreo(bloques, { estilos = ESTILOS_BASE } = {}) {
  const fondo = estilos.fondo || ESTILOS_BASE.fondo;
  const cuerpo = bloques.map(b => renderBloque(b, estilos)).join('');
  const columna = `<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-collapse:collapse;width:100%;max-width:${ANCHO_CORREO}px;margin:0 auto;background:#ffffff">${cuerpo ? `<tr><td>${cuerpo}</td></tr>` : ''}</table>`;
  return tabla(`<tr><td align="center" bgcolor="${fondo}" style="padding:32px 12px;background:${fondo}">`
    + mso(`<table role="presentation" align="center" width="${ANCHO_CORREO}" cellpadding="0" cellspacing="0" border="0"><tr><td width="${ANCHO_CORREO}">`)
    + columna
    + mso('</td></tr></table>')
    + '</td></tr>', `background:${fondo}`).replace('<table role="presentation" width="100%"', `<table role="presentation" width="100%" bgcolor="${fondo}"`);
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
  margen: ESTILOS_BASE.margen,
});
