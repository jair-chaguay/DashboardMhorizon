// Laravel devuelve fechas "YYYY-MM-DD HH:mm:ss"; con "/" Safari también las interpreta
export function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(/-/g, '/'));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isWithinFilter(date, filter) {
  if (filter === 'Todos') return true;
  if (!date) return false;
  const now = new Date();
  if (filter === '7dias') return (now - date) <= 7 * 24 * 60 * 60 * 1000;
  if (filter === '30dias') return (now - date) <= 30 * 24 * 60 * 60 * 1000;
  if (filter === 'esteMes') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return true;
}

// Clave ordenable por día (hora local)
export function toDayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const formatHora = (date) => date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
// "hace 5 min", "hace 3 h", "ayer"... Una fecha futura se muestra como "ahora"
export function timeAgo(date, now = new Date()) {
  const minutes = Math.floor(Math.max(now.getTime() - date.getTime(), 0) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

export const formatDayLabel = (date) => date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

export function formatDateTime(date) {
  if (!date) return 'Fecha desconocida';
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const formatFechaHora = (date) => `${date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })}, ${formatHora(date)}`;
