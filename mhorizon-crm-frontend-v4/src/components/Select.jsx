import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Desplegable propio del CRM (reemplaza al <select> del navegador, que en cada sistema se ve distinto).
// options: [[valor, etiqueta], ...]. Se maneja con mouse y con teclado: flechas, Inicio/Fin, Enter y Escape
export default function Select({ value, onChange, options, label, className = '', align = 'left', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const id = useId();
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  const actual = options[index];

  useEffect(() => {
    if (!open) return undefined;
    const fuera = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [open]);

  // La opción activa siempre a la vista cuando la lista es larga
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const abrir = () => { if (disabled) return; setActive(index); setOpen(true); };
  const elegir = (i) => {
    const opcion = options[i];
    setOpen(false);
    root.current?.querySelector('button')?.focus();
    if (opcion && opcion[0] !== value) onChange(opcion[0]);
  };

  const teclas = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    const mover = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (mover) { e.preventDefault(); setActive(a => Math.min(options.length - 1, Math.max(0, a + mover))); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); }
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => (open ? setOpen(false) : abrir())} onKeyDown={teclas}
        aria-haspopup="listbox" aria-expanded={open} aria-label={label} aria-controls={open ? `${id}-lista` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-left text-sm font-medium text-slate-700 outline-none transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-200 hover:border-slate-300 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/20'}`}>
        <span className="truncate">{actual?.[1] ?? ''}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`} />
      </button>
      {open && (
        <ul ref={list} id={`${id}-lista`} role="listbox" aria-label={label}
          className={`absolute z-40 mt-1.5 max-h-72 min-w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg animate-fade-in ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {options.map(([v, texto], i) => {
            const elegido = v === value;
            return (
              <li key={String(v)} id={`${id}-${i}`} data-i={i} role="option" aria-selected={elegido}
                onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => elegir(i)}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md py-2 pl-2 pr-3 text-sm ${i === active ? 'bg-slate-100 text-slate-900' : 'text-slate-700'} ${elegido ? 'font-semibold text-brand-700' : ''}`}>
                <Check size={15} className={`shrink-0 ${elegido ? 'text-brand-600' : 'invisible'}`} />
                {texto}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
