// Colores y estilos compartidos (el color de marca vive en index.css como brand-* y navy-*)
// Misma lectura en todas las pantallas: enviados = gris azulado, aperturas = azul de marca, clics = naranja de marca
export const COLORS = { primary: '#d4681c', navy: '#0a2c5e', sent: '#9aa7b8', opens: '#0a2c5e', clicks: '#d4681c', soft: '#f5c8a0', grid: '#eef0f3', axis: '#94a3b8', gray: '#e5e7ec' };

export const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgb(15 23 42 / 0.06)', fontSize: 12 };
export const axisTick = { fontSize: 11, fill: COLORS.axis };

// Clases base para que tarjetas, botones, campos y tablas se vean igual en todo el sistema
export const ui = {
  card: 'bg-white border border-slate-200/80 rounded-2xl',
  btnPrimary: 'h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  btn: 'h-10 px-3.5 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  iconBtn: 'h-10 w-10 grid place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:cursor-wait cursor-pointer',
  input: 'h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20',
  th: 'py-2.5 px-5 text-xs font-semibold text-slate-500 whitespace-nowrap',
  label: 'text-[13px] font-semibold text-slate-700',
};

export const selectClass = 'h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 cursor-pointer';
