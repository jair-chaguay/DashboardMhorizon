// Entregabilidad a partir de email_logs.
// El backend puede enviar estos tipos de evento además de sent/open/click (ver BACKEND.md):
//   bounce (con bounce_type 'hard' o 'soft'), unsubscribe y spam.
// Si no llegan, todo queda en cero y las pantallas lo indican en vez de inventar datos.

// El worker de Python registra los rechazos como 'blocked' (5xx / destinatario rechazado / rebote leído por IMAP)
// y 'failed' (error temporal). Se leen como rebote duro y suave
const LEGACY_BOUNCES = { blocked: 'hard', failed: 'soft' };

const normalizeBounce = (log) => {
  if (LEGACY_BOUNCES[log.event_type]) return LEGACY_BOUNCES[log.event_type];
  const type = String(log.bounce_type || '').toLowerCase();
  if (type === 'hard' || type === 'duro') return 'hard';
  if (type === 'soft' || type === 'suave') return 'soft';
  return 'unknown';
};

// Resumen por correo único: un rebote o una baja cuenta una vez por persona.
// `events` guarda la fecha y el motivo más reciente de cada correo para mostrarlos en las listas
export function summarizeDeliverability(logs) {
  const hard = new Set(), soft = new Set(), unknown = new Set(), unsub = new Set(), spam = new Set();
  const events = new Map();
  logs.forEach(log => {
    const isBounce = log.event_type === 'bounce' || !!LEGACY_BOUNCES[log.event_type];
    if (!isBounce && !['unsubscribe', 'spam'].includes(log.event_type)) return;
    if (isBounce) ({ hard, soft, unknown })[normalizeBounce(log)].add(log.email);
    else if (log.event_type === 'unsubscribe') unsub.add(log.email);
    else spam.add(log.email);
    const key = `${isBounce ? 'bounce' : log.event_type}|${log.email}`;
    const prev = events.get(key);
    if (!prev || String(log.created_at) > String(prev.created_at)) events.set(key, { created_at: log.created_at, reason: log.bounce_reason || '', campaign: log.campaign_name || '' });
  });
  // Un correo con rebote duro no se cuenta además como suave
  hard.forEach(e => { soft.delete(e); unknown.delete(e); });
  soft.forEach(e => unknown.delete(e));
  const bounced = new Set([...hard, ...soft, ...unknown]);
  return {
    bounced, hard, soft, unknown, unsub, spam, events,
    bounces: bounced.size,
    hasBounceTypes: hard.size + soft.size > 0,
    hasDeliveryData: bounced.size + unsub.size + spam.size > 0,
  };
}

// Estado de entrega de un correo para mostrarlo junto al prospecto (el más grave primero)
export function deliveryFlag(email, summary) {
  if (summary.hard.has(email)) return { key: 'hard', label: 'Rebote duro', tone: 'bg-rose-50 text-rose-700' };
  if (summary.spam.has(email)) return { key: 'spam', label: 'Marcó spam', tone: 'bg-rose-50 text-rose-700' };
  if (summary.unsub.has(email)) return { key: 'unsub', label: 'Desuscrito', tone: 'bg-slate-100 text-slate-600' };
  if (summary.soft.has(email)) return { key: 'soft', label: 'Rebote suave', tone: 'bg-amber-50 text-amber-700' };
  if (summary.unknown.has(email)) return { key: 'bounce', label: 'Rebotó', tone: 'bg-amber-50 text-amber-700' };
  return null;
}

// Fecha y motivo del problema de entrega de un correo (para las listas)
export function deliveryEvent(email, summary) {
  const flag = deliveryFlag(email, summary);
  if (!flag) return null;
  const type = flag.key === 'spam' ? 'spam' : flag.key === 'unsub' ? 'unsubscribe' : 'bounce';
  return { ...flag, ...(summary.events.get(`${type}|${email}`) || {}) };
}

// Para quien no tuvo ningún problema de entrega
export const DELIVERED_FLAG = { key: 'ok', label: 'Entregado', tone: 'bg-emerald-50 text-emerald-700' };
