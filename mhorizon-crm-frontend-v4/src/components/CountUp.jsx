import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Cifra que sube hasta su valor ("40", "63%", "56.8%"); si cambia, parte desde la cifra anterior
export default function CountUp({ value, duration = 700 }) {
  const text = String(value ?? '');
  const match = text.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  const target = match ? Number(match[1]) : null;
  const decimals = match?.[1].split('.')[1]?.length || 0;
  const suffix = match ? match[2] : '';
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (target === null) return undefined;
    const begin = from.current;
    const ms = reducedMotion() ? 0 : duration;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = ms === 0 ? 1 : Math.min((now - start) / ms, 1);
      const value = begin + (target - begin) * (1 - Math.pow(1 - t, 3));
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  if (target === null) return text;
  return <>{shown.toFixed(decimals)}{suffix}</>;
}
