import { ui } from '../utils/theme';

// Tarjeta con título, subtítulo opcional y acciones a la derecha
export default function Panel({ title, subtitle, right, className = '', bodyClassName = '', children }) {
  return (
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
}
