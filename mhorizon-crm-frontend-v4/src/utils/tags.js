// Las etiquetas pueden llegar como string JSON o como arreglo
export function parseTags(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const uniqueTags = (leads) => Array.from(new Set(leads.flatMap(l => parseTags(l.etiquetas))));
