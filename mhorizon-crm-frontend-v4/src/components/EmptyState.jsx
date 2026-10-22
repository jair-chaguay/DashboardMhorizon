// Ilustración de marca: un sol naranja sobre el horizonte
export function HorizonArt({ className = '' }) {
  return (
    <svg viewBox="0 0 120 72" className={className} aria-hidden="true">
      <defs><clipPath id="horizon-clip"><rect x="0" y="0" width="120" height="46" /></clipPath></defs>
      <g clipPath="url(#horizon-clip)">
        <circle cx="60" cy="46" r="28" fill="#fbe5d0" />
        <circle cx="60" cy="46" r="17" fill="#d4681c" />
      </g>
      <path d="M12 46h96" stroke="#0a2c5e" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 56h60M44 65h32" stroke="#0a2c5e" strokeWidth="2" strokeLinecap="round" opacity="0.16" />
    </svg>
  );
}

// Mensaje para cuando una lista o gráfica aún no tiene datos, con una acción sugerida
export default function EmptyState({ title, text, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-10 ${className}`}>
      <HorizonArt className="w-28" />
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
