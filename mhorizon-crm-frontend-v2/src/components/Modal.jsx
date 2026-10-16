import { useEffect } from 'react';

// Contenedor base de los modales: fondo oscuro, cierre con Escape o clic fuera
export default function Modal({ isOpen, onClose, className = '', children }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
