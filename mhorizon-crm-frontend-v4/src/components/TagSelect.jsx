import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

// Desplegable para elegir varias etiquetas, con buscador y el número de prospectos de cada una.
// Las elegidas quedan debajo como fichas que se pueden quitar. Se maneja con mouse y con teclado
export default function TagSelect({ options, value, onChange, counts = {}, label = 'Etiquetas', placeholder = 'Elige las etiquetas' }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const input = useRef(null);
  const id = useId();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return options.filter(t => !q || t.toLowerCase().includes(q));
  }, [options, busqueda]);

  useEffect(() => {
    if (!open) return undefined;
    const fuera = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const abrir = () => { setBusqueda(''); setActive(0); setOpen(true); requestAnimationFrame(() => input.current?.focus()); };
  const alternar = (tag) => onChange(value.includes(tag) ? value.filter(t => t !== tag) : [...value, tag]);

  const teclas = (e) => {
    const mover = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (mover) { e.preventDefault(); setActive(a => Math.min(visibles.length - 1, Math.max(0, a + mover))); }
    else if (e.key === 'Enter') { e.preventDefault(); if (visibles[active]) alternar(visibles[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); root.current?.querySelector('button')?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const resumen = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} etiquetas elegidas`;

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={(e) => { if (!open && ['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); } }}
        aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-left text-sm font-medium outline-none transition-colors cursor-pointer ${value.length ? 'text-slate-800' : 'text-slate-400'} ${open ? 'border-brand-600 ring-2 ring-brand-600/20' : 'border-slate-200 hover:border-slate-300 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/20'}`}>
        <span className="truncate">{resumen}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 rounded-lg border border-slate-200 bg-white shadow-lg animate-fade-in">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input ref={input} type="text" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setActive(0); }} onKeyDown={teclas}
                placeholder="Buscar etiqueta" aria-label="Buscar etiqueta" aria-controls={`${id}-lista`} aria-activedescendant={visibles[active] ? `${id}-${active}` : undefined}
                className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-600" />
            </div>
          </div>
          <ul ref={list} id={`${id}-lista`} role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-64 overflow-auto p-1">
            {visibles.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Ninguna etiqueta coincide.</li>}
            {visibles.map((tag, i) => {
              const elegida = value.includes(tag);
              const n = counts[tag] ?? 0;
              return (
                <li key={tag} id={`${id}-${i}`} data-i={i} role="option" aria-selected={elegida}
                  onPointerEnter={() => setActive(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => alternar(tag)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md py-2 pl-2 pr-3 text-sm ${i === active ? 'bg-slate-100' : ''}`}>
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${elegida ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>
                    {elegida && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${elegida ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{tag}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${n ? 'text-slate-500' : 'text-slate-400'}`}>{n ? `${n} ${n === 1 ? 'prospecto' : 'prospectos'}` : 'sin activos'}</span>
                </li>
              );
            })}
          </ul>
          {value.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
              <span className="text-slate-500">{value.length} {value.length === 1 ? 'elegida' : 'elegidas'}</span>
              <button type="button" onClick={() => onChange([])} className="font-semibold text-brand-700 hover:underline cursor-pointer">Quitar todas</button>
            </div>
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-navy-900 py-1 pl-2.5 pr-1 text-[13px] font-medium text-white animate-fade-in">
              {tag}
              <button type="button" onClick={() => alternar(tag)} aria-label={`Quitar ${tag}`} className="grid h-5 w-5 place-items-center rounded text-white/70 hover:bg-white/15 hover:text-white cursor-pointer"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
