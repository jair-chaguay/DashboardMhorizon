// Estados que escribe el worker de Python en leadss.status:
//   "Contactado (Fase N)", "Contactado IA Fase N (x/y)", "Avanzó a Fase N (...)" -> se le envió correo
//   "Conversando con IA (Fase N)", "Derivado a Equipo"                      -> respondió
//   "NO CONTACTAR", "Retirado (...)", "Terminado (Sin interacción)"          -> fuera de la automatización
const REPLIED = /^(respondi[oó]|conversando con ia|derivado a equipo)/i;
const CONTACTED = /^(contactado|avanz[oó] a fase|enviado)/i;
const STOPPED = /^(no contactar|retirado|terminado)/i;

export const isReplied = (status) => REPLIED.test(String(status || ''));

// Color del punto que acompaña al estado en las tablas
export function statusDot(status) {
  if (isReplied(status)) return 'bg-emerald-500';
  if (CONTACTED.test(String(status || ''))) return 'bg-navy-700';
  if (STOPPED.test(String(status || ''))) return 'bg-rose-400';
  return 'bg-slate-300';
}
