// Título de la página con su descripción y, a la derecha, las acciones (filtros, botones)
export default function PageHeader({ children, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-6">
      <div className="min-w-0">
        <h2 className="text-[22px] font-bold text-slate-900 tracking-tight">{children}</h2>
        {description && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
