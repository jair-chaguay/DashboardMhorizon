// Rearma los bloques del editor a partir del HTML de un correo con diseño ya enviado.
// Sirve para reutilizar campañas enviadas antes de que se guardaran sus bloques: lee el HTML
// que arma renderCorreo (una tabla por bloque dentro de la columna blanca) y reconoce cada bloque.
// Entiende también el HTML de la primera versión del editor (antes de los ajustes para Outlook)
import { ANCHO_CORREO, COLORES_BOTON, ENLACE_BAJA, ESTILOS_BASE, REDES, crearBloque } from './emailBlocks';

const MARGEN = ESTILOS_BASE.margen;
// El navegador entrega los colores de style como rgb(...)
function rgbAHex(color) {
  const m = String(color || '').match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? `#${m.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('')}` : String(color || '');
}
const igual = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const estilo = (el, prop) => el?.style?.getPropertyValue(prop) || '';
const px = (valor) => parseInt(String(valor), 10) || 0;
// Texto con los <br> convertidos en saltos de línea
const textoDe = (el) => {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return (copia.textContent || '').replace(/\u00a0/g, ' ').trim();
};
// Botones del correo: un <a> en mayúsculas (dentro de una celda con color, o con su propio fondo en la primera versión)
const anclasBoton = (el) => [...el.querySelectorAll('a')].filter(a => estilo(a, 'text-transform') === 'uppercase');
const botonesDe = (el) => anclasBoton(el).map(a => ({ texto: textoDe(a), url: a.getAttribute('href') === '#' ? '' : a.getAttribute('href') || '' })).filter(b => b.texto);
const colorDe = (el) => {
  const a = anclasBoton(el)[0];
  const color = a?.parentElement?.getAttribute('bgcolor') || rgbAHex(estilo(a, 'background-color'));
  return Object.keys(COLORES_BOTON).find(k => igual(COLORES_BOTON[k], color)) || 'naranja';
};
const fondoDe = (el) => el?.getAttribute('bgcolor') || rgbAHex(estilo(el, 'background-color'));
const enlaceDe = (img) => { const href = img.closest('a')?.getAttribute('href') || ''; return href === '#' ? '' : href; };
const redesDe = (el) => {
  const redes = Object.fromEntries(REDES.map(([key]) => [key, '']));
  el.querySelectorAll('a > img').forEach(img => {
    const red = REDES.find(([, nombre]) => igual(nombre, img.getAttribute('alt')));
    if (red) redes[red[0]] = enlaceDe(img);
  });
  return redes;
};
const esRedes = (el) => { const imgs = el.querySelectorAll('a > img[width="36"]'); return imgs.length > 0 && imgs.length === el.querySelectorAll('img').length; };
// Celda que lleva el contenido de un bloque: la de "fila()", la primera de la tabla
const celdaDe = (tabla) => tabla.querySelector('td');

function pieDesde(tabla) {
  const pie = crearBloque('pie', { botones: [], logo: '', botonTexto: '', botonUrl: '', copyright: '', mensaje: '', direccion: '' });
  pie.redes = Object.fromEntries(REDES.map(([key]) => [key, '']));
  // Cada parte del pie: una fila de su tabla interna, o (primera versión) un elemento dentro de un <div>
  const celda = celdaDe(tabla);
  const interna = celda?.querySelector('table');
  const partes = interna && interna.parentElement === celda ? [...interna.rows].map(tr => tr.cells[0]) : [...(celda?.firstElementChild?.children || [])];
  let visto = false; // ya pasó el logotipo o las redes: el siguiente botón es el de "Suscribirme"
  const textos = [];
  partes.forEach(td => {
    if (!td) return;
    const baja = td.querySelector(`a[href="${ENLACE_BAJA}"]`);
    if (baja) {
      pie.bajaBoton = textoDe(baja);
      const copia = td.cloneNode(true);
      copia.querySelector('a')?.remove();
      pie.bajaTexto = textoDe(copia).replace(/\.\s*$/, '').trim();
      return;
    }
    if (esRedes(td)) { pie.redes = redesDe(td); visto = true; return; }
    const img = td.tagName === 'IMG' ? td : td.querySelector('img');
    if (img) { pie.logo = img.getAttribute('src') || ''; visto = true; return; }
    const lista = botonesDe(td);
    if (lista.length) {
      if (visto) { pie.botonTexto = lista[0].texto; pie.botonUrl = lista[0].url; } else pie.botones = lista;
      return;
    }
    if (estilo(td, 'font-style') === 'italic') { pie.copyright = textoDe(td); return; }
    textos.push(td);
  });
  // Mensaje y dirección: la dirección va separada arriba (padding 8px)
  textos.forEach((td, i) => {
    if (estilo(td, 'padding-top') === '8px' || estilo(td, 'margin-top') === '14px' || (i > 0 && !pie.direccion)) pie.direccion = textoDe(td);
    else pie.mensaje = textoDe(td);
  });
  return pie;
}

function bloqueDesde(tabla) {
  const td = celdaDe(tabla);
  if (!td) return null;
  if (tabla.querySelector(`a[href="${ENLACE_BAJA}"]`) || /copyright/i.test(tabla.textContent)) return pieDesde(tabla);
  // Bloque vacío (marcador punteado): no se copia
  if (/dashed/.test(tabla.innerHTML) && !tabla.querySelector('img')) return null;
  const imgs = tabla.querySelectorAll('img');
  if (imgs.length > 0 && esRedes(tabla)) return crearBloque('redes', { redes: redesDe(tabla) });
  if (imgs.length === 1) {
    const img = imgs[0];
    const src = img.getAttribute('src') || '';
    const ancho = px(img.getAttribute('width'));
    if (igual(img.getAttribute('alt'), 'MHORIZON') && estilo(img, 'width') !== '100%') {
      return crearBloque('logotipo', { logo: src, ancho: ancho || 110, enlace: enlaceDe(img) });
    }
    const datos = { imagen: src, original: /^data:image\//i.test(src) ? src : '', alt: img.getAttribute('alt') || '', enlace: enlaceDe(img) };
    if (estilo(td, 'padding') === '0px' || ancho >= ANCHO_CORREO) return crearBloque('imagen', { ...datos, modo: 'rellenar', ancho: 100 });
    const pct = Math.min(100, Math.max(10, Math.round(ancho / (ANCHO_CORREO - 2 * MARGEN) * 100))) || 100;
    return crearBloque('imagen', { ...datos, modo: 'escala', ancho: pct, alineacion: td.getAttribute('align') || estilo(td.querySelector('div'), 'text-align') || 'center' });
  }
  const lista = botonesDe(tabla);
  if (lista.length) {
    const alin = tabla.querySelector('div[style*="text-align"]');
    return crearBloque('boton', { botones: lista, color: colorDe(tabla), alineacion: estilo(alin, 'text-align') || 'center' });
  }
  const interna = td.querySelector('td') || td;
  const linea = td.querySelector('[style*="border-top"]');
  if (linea && !textoDe(td)) return crearBloque('divisor', { grosor: px(estilo(linea, 'border-top-width')) || 1, color: rgbAHex(estilo(linea, 'border-top-color')) || '#d1d5db' });
  if (!textoDe(tabla)) {
    const alto = px(estilo(td, 'height'));
    return alto ? crearBloque('espaciador', { alto }) : null;
  }
  const size = px(estilo(interna, 'font-size')) || 15;
  if (estilo(interna, 'font-weight') === 'bold') {
    const franja = fondoDe(interna);
    const barra = estilo(interna, 'border-left-width');
    const tamano = size >= 26 ? 'grande' : size >= 20 ? 'mediano' : 'pequeno';
    return crearBloque('encabezado', {
      texto: textoDe(interna), tamano,
      estilo: franja ? 'franja' : barra ? 'barra' : 'simple',
      alineacion: estilo(interna, 'text-align') || 'left',
    });
  }
  return crearBloque('parrafo', {
    texto: textoDe(interna),
    tamano: size,
    alineacion: estilo(interna, 'text-align') || 'left',
    recuadro: px(estilo(interna, 'border-top-width')) >= 2,
  });
}


// Devuelve { bloques, estilos } o null si el HTML no es un correo del editor de diseño
export function bloquesDesdeHtml(html) {
  if (!html || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fondo = (fondoDe(doc.body.firstElementChild) || ESTILOS_BASE.fondo).toLowerCase();
  // La columna blanca de 600 px; sus bloques son las tablas de su primera celda
  const columna = [...doc.querySelectorAll('table')].find(t => /max-width:\s*600px/.test(t.getAttribute('style') || ''));
  const celda = columna?.rows[0]?.cells[0];
  let bloques = celda ? [...celda.children].filter(el => el.tagName === 'TABLE').map(bloqueDesde).filter(Boolean) : [];
  // Si el HTML tiene otra forma, al menos se rescatan las imágenes y se agrega el pie
  if (bloques.length === 0) {
    bloques = [...doc.querySelectorAll('img')].filter(img => !/^(MHORIZON|Facebook|Instagram|X|LinkedIn|Sitio web)$/i.test(img.getAttribute('alt') || ''))
      .map(img => crearBloque('imagen', { imagen: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '', enlace: enlaceDe(img) }));
    if (bloques.length === 0) return null;
    bloques.push(crearBloque('pie'));
  }
  return { bloques, estilos: { fondo } };
}
