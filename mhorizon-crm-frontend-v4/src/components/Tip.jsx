import { useState } from 'react';

// Al pasar el mouse el valor cambia por el dato en números (por ejemplo 64% pasa a 18).
// Los dos textos quedan montados en la misma celda y solo se alterna cuál se ve, así el tamaño no cambia ni parpadea
export default function Tip({ text, children, className = '' }) {
  const [hover, setHover] = useState(false);
  if (!text) return children;
  return (
    <span onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className={`inline-grid whitespace-nowrap ${className}`}>
      <span className={`col-start-1 row-start-1 ${hover ? 'invisible' : ''}`}>{children}</span>
      <span className={`col-start-1 row-start-1 ${hover ? '' : 'invisible'}`} aria-hidden={!hover}>{text}</span>
    </span>
  );
}
