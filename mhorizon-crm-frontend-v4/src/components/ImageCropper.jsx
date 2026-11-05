import { useEffect, useRef, useState } from 'react';
import { Crop, Square, RectangleHorizontal, RectangleVertical, RotateCcw, X } from 'lucide-react';
import { ui } from '../utils/theme';
import { cargarImagen, recortar, tipoDeDataUrl } from '../utils/images';

// Proporciones en píxeles (ancho / alto); "libre" no fija ninguna
const FORMATOS = [
  { key: 'libre', label: 'Formato libre', icon: Crop, ratio: null },
  { key: 'cuadrado', label: 'Cuadrado', icon: Square, ratio: 1 },
  { key: 'horizontal', label: 'Horizontal', icon: RectangleHorizontal, ratio: 16 / 9 },
  { key: 'vertical', label: 'Vertical', icon: RectangleVertical, ratio: 3 / 4 },
  { key: 'original', label: 'Original', icon: RotateCcw, ratio: null },
];
const MIN = 0.04;
const TODO = { x: 0, y: 0, w: 1, h: 1 };
const ESQUINAS = ['nw', 'ne', 'sw', 'se'];
const BORDES = ['n', 's', 'e', 'w'];
const POS = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize', ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize', se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize', s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize', w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// El recuadro más grande de esa proporción, centrado en la imagen
function centrado(ratio, natW, natH) {
  const k = ratio * natH / natW; // ancho en fracción por cada unidad de alto en fracción
  const w = k <= 1 ? k : 1;
  const h = k <= 1 ? 1 : 1 / k;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

// Recorte en la misma pantalla: se arrastra el recuadro o sus esquinas y se elige una proporción
export default function ImageCropper({ src, onCancel, onDone }) {
  const [img, setImg] = useState(null);
  const [rect, setRect] = useState(TODO);
  const [formato, setFormato] = useState('libre');
  const caja = useRef(null);
  const arrastre = useRef(null);

  useEffect(() => {
    let vivo = true;
    cargarImagen(src).then(i => { if (vivo) setImg(i); }).catch(() => {});
    return () => { vivo = false; };
  }, [src]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const ratio = FORMATOS.find(f => f.key === formato)?.ratio ?? null;

  const elegirFormato = (f) => {
    setFormato(f.key === 'original' ? 'libre' : f.key);
    if (!img) return;
    setRect(f.ratio ? centrado(f.ratio, img.naturalWidth, img.naturalHeight) : TODO);
  };

  const empezar = (e, modo) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastre.current = { modo, x0: e.clientX, y0: e.clientY, r0: rect };
  };

  const mover = (e) => {
    const a = arrastre.current;
    if (!a || !caja.current || !img) return;
    const box = caja.current.getBoundingClientRect();
    const dx = (e.clientX - a.x0) / box.width;
    const dy = (e.clientY - a.y0) / box.height;
    const r = a.r0;
    if (a.modo === 'mover') {
      setRect({ ...r, x: limitar(r.x + dx, 0, 1 - r.w), y: limitar(r.y + dy, 0, 1 - r.h) });
      return;
    }
    let { x, y, w, h } = r;
    const der = r.x + r.w;
    const abajo = r.y + r.h;
    if (a.modo.includes('e')) w = limitar(r.w + dx, MIN, 1 - r.x);
    if (a.modo.includes('w')) { x = limitar(r.x + dx, 0, der - MIN); w = der - x; }
    if (a.modo.includes('s')) h = limitar(r.h + dy, MIN, 1 - r.y);
    if (a.modo.includes('n')) { y = limitar(r.y + dy, 0, abajo - MIN); h = abajo - y; }
    if (ratio) {
      // Con proporción fija manda el ancho; el alto se ajusta y, si no cabe, se recorta el ancho
      const k = img.naturalWidth / img.naturalHeight / ratio;
      h = w * k;
      const espacio = a.modo.includes('n') ? abajo : 1 - r.y;
      if (h > espacio) { h = espacio; w = h / k; }
      if (a.modo.includes('w')) x = der - w;
      y = a.modo.includes('n') ? abajo - h : r.y;
    }
    setRect({ x, y, w, h });
  };
  const soltar = () => { arrastre.current = null; };

  const aplicar = () => {
    if (!img) return;
    onDone(recortar(img, rect, tipoDeDataUrl(src)));
  };

  const pct = (v) => `${(v * 100).toFixed(3)}%`;
  const tamPx = img ? `${Math.round(rect.w * img.naturalWidth)} × ${Math.round(rect.h * img.naturalHeight)} px` : '';
  const manijas = ratio ? ESQUINAS : [...ESQUINAS, ...BORDES];

  return (
    <div role="dialog" aria-modal="true" aria-label="Recortar imagen" className="fixed inset-0 z-[80] flex flex-col bg-navy-900 animate-fade-in">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-[15px] font-semibold">Recortar imagen</p>
        <button type="button" onClick={onCancel} aria-label="Cancelar" className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 cursor-pointer"><X size={18} /></button>
      </div>

      <div className="flex-1 min-h-0 grid place-items-center px-4 py-2 select-none" onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
        {img ? (
          <div ref={caja} className="relative inline-block max-w-full touch-none">
            <img src={src} alt="" draggable={false} className="block max-w-full max-h-[calc(100vh-13rem)] w-auto h-auto" />
            <div className="absolute inset-0 overflow-hidden">
              <div onPointerDown={(e) => empezar(e, 'mover')}
                className="absolute cursor-move border-2 border-white"
                style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), boxShadow: '0 0 0 9999px rgba(15, 20, 27, 0.62)' }}>
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/25" />)}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute" style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}>
              {manijas.map(m => (
                <span key={m} onPointerDown={(e) => empezar(e, m)}
                  className={`pointer-events-auto absolute h-3.5 w-3.5 rounded-sm border-2 border-navy-900 bg-white ${POS[m]}`} />
              ))}
            </div>
          </div>
        ) : <p className="text-sm text-white/70">Cargando imagen...</p>}
      </div>

      <div className="border-t border-white/10 bg-navy-900 px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FORMATOS.map(f => {
              const Icon = f.icon;
              const activo = f.key === formato && f.key !== 'original';
              return (
                <button type="button" key={f.key} onClick={() => elegirFormato(f)} aria-pressed={activo}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium cursor-pointer transition-colors ${activo ? 'bg-white text-navy-900' : 'text-white/80 hover:bg-white/10'}`}>
                  <Icon size={14} />{f.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 tabular-nums">{tamPx}</span>
            <button type="button" onClick={onCancel} className="h-10 px-3.5 rounded-lg text-sm font-semibold text-white/85 hover:bg-white/10 cursor-pointer">Cancelar</button>
            <button type="button" onClick={aplicar} disabled={!img} className={ui.btnPrimary}>Listo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
