// Bloque gris que parpadea mientras cargan los datos
export default function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}
