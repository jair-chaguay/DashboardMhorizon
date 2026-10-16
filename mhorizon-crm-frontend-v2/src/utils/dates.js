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
  if (filter === 'esteMes') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  return true;
}

// Clave ordenable por día (hora local)
export function toDayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const formatDayLabel = (date) => date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

export function formatDateTime(date) {
  if (!date) return 'Fecha desconocida';
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
