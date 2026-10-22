import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import CountUp from './CountUp';
import Skeleton from './Skeleton';
import Tip from './Tip';
import { COLORS, ui } from '../utils/theme';


// Diferencia frente al promedio de todas las campañas (verde si lo supera, rojo si queda por debajo)
export function DeltaBadge({ value, unit = 'pts' }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const rounded = Math.round(value);
  const up = rounded >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span title="Comparado con el promedio de todas tus campañas"
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon size={13} />{up ? '+' : ''}{rounded} {unit}
    </span>
  );
}

// Porcentaje en la tabla; al pasar el mouse cambia por la cantidad (tip)
export const RateBar = ({ value, tip }) => (
  <span className="text-sm font-semibold text-slate-800 tabular-nums"><Tip text={tip}>{value}%</Tip></span>
);

export const BarRow = ({ label, value, max, color = COLORS.navy }) => (
  <div>
    <div className="flex justify-between text-[13px] mb-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full animate-bar transition-[width] duration-500" style={{ width: `${max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0}%`, background: color }} />
    </div>
  </div>
);

export const LegendDot = ({ color, label, active = true, onClick }) => {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-pressed={onClick ? active : undefined}
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-slate-600' : 'text-slate-400 line-through'} ${onClick ? 'cursor-pointer hover:text-slate-900' : ''}`}>
      <span className="h-2 w-2 rounded-full" style={{ background: active ? color : '#cbd5e1' }} />{label}
    </Tag>
  );
};

export const Panel = ({ title, subtitle, right, className = '', bodyClassName = '', children }) => (
  <section className={`${ui.card} ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className={`px-5 pb-5 ${bodyClassName}`}>{children}</div>
  </section>
);

// Indicador: nombre, cifra grande y una línea de detalle. Los que se pueden pulsar abren la lista de contactos
export function Stat({ label, value, hint, delta, loading, onClick, tip, animate = true }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`group text-left bg-white p-5 flex flex-col ${onClick ? 'cursor-pointer transition-colors hover:bg-slate-50' : ''}`}>
      <span className="flex items-center justify-between text-[13px] font-medium text-slate-500">
        {label}
        {onClick && <ChevronRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />}
      </span>
      {loading ? <Skeleton className="mt-3 h-8 w-20" /> : (
        <span className="mt-2 flex items-baseline gap-2.5">
          <span className="text-[28px] leading-none font-bold text-slate-900 tabular-nums tracking-tight"><Tip text={tip}>{animate ? <CountUp value={value} /> : value}</Tip></span>
          <DeltaBadge value={delta} />
        </span>
      )}
      <span className="mt-2.5 block text-[13px] text-slate-500">{hint}</span>
    </Tag>
  );
}

// Fila de indicadores en una sola tarjeta, separados por líneas finas
export const StatGrid = ({ children }) => (
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100">{children}</section>
);
