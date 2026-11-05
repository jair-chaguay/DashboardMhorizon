// Imágenes del correo con diseño: se leen en el navegador y viajan en el cuerpo como data:image.
// Al encolar la campaña, el servidor las guarda como archivos públicos y cambia cada una por su enlace (ver BACKEND.md)
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/gif'];
export const IMAGEN_MAX_MB = 10;
const ANCHO_MAX = 1600; // el doble del ancho del correo, para pantallas de alta densidad

const leerComoDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const cargarImagen = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Las fotos muy grandes se reducen para que el correo no pese de más; los GIF se dejan tal cual para no perder la animación
export async function leerImagen(file) {
  if (!TIPOS_IMAGEN.includes(file.type)) throw new Error('Solo se aceptan imágenes PNG, JPG o GIF.');
  if (file.size > IMAGEN_MAX_MB * 1048576) throw new Error(`La imagen pesa más de ${IMAGEN_MAX_MB} MB.`);
  const dataUrl = await leerComoDataUrl(file);
  if (file.type === 'image/gif') return dataUrl;
  const img = await cargarImagen(dataUrl);
  if (img.naturalWidth <= ANCHO_MAX) return dataUrl;
  return recortar(img, { x: 0, y: 0, w: 1, h: 1 }, file.type);
}

// Recorta (fracciones de 0 a 1 de la imagen original) y devuelve un data:image
export function recortar(img, rect, tipo = 'image/png') {
  const sx = Math.round(rect.x * img.naturalWidth);
  const sy = Math.round(rect.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));
  const escala = Math.min(1, ANCHO_MAX / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * escala);
  canvas.height = Math.round(sh * escala);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return tipo === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
}

export const tipoDeDataUrl = (url) => (String(url).match(/^data:(image\/[a-z]+)/i)?.[1] || 'image/png').toLowerCase();
export const pesoDataUrl = (url) => Math.round((String(url).split(',')[1] || '').length * 0.75);
