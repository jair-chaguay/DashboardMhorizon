import { useState } from 'react';
import { FlaskConical, Loader2, X } from 'lucide-react';
import Modal from './Modal';
import StatusMessage from './StatusMessage';
import { ui } from '../utils/theme';

const ULTIMOS_KEY = 'mhorizon:correos-prueba';
const MAX_CORREOS = 5;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Los últimos correos de prueba se recuerdan solo en este navegador
function leerUltimos() {
  try { return window.localStorage.getItem(ULTIMOS_KEY) || ''; } catch { return ''; }
}
function guardarUltimos(valor) {
  try { window.localStorage.setItem(ULTIMOS_KEY, valor); } catch { /* sin almacenamiento */ }
}

// Envía el correo que se está armando solo a las direcciones escritas.
// No cuenta como campaña: no aparece en Campañas ni en las métricas y no cambia a ningún prospecto
export default function TestEmailModal({ isOpen, onClose, asunto, onEnviar }) {
  const [texto, setTexto] = useState(leerUltimos);
  const [enviando, setEnviando] = useState(false);
  const [message, setMessage] = useState(null);

  const correos = [...new Set(texto.split(/[\s,;]+/).map(t => t.trim().toLowerCase()).filter(Boolean))];
  const invalidos = correos.filter(c => !EMAIL_VALIDO.test(c));
  const aviso = invalidos.length > 0 ? `Revisa: ${invalidos.join(', ')}`
    : correos.length > MAX_CORREOS ? `Máximo ${MAX_CORREOS} correos por prueba.` : '';
  const listo = correos.length > 0 && !aviso;

  const cerrar = () => {
    if (enviando) return;
    setMessage(null);
    onClose();
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    setMessage(null);
    try {
      await onEnviar(correos);
      guardarUltimos(correos.join(', '));
      setMessage({ type: 'success', text: `Prueba encolada. Llegará en unos minutos a ${correos.join(', ')} con el asunto "[Prueba] ${asunto}".` });
    } catch (error) {
      const detail = error?.response?.data?.message;
      setMessage({ type: 'error', text: detail ? `No se pudo enviar la prueba: ${detail}` : 'No se pudo enviar la prueba.' });
      console.error(error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={cerrar} className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
      <form onSubmit={enviar}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Enviar correo de prueba</h3>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="correos-prueba" className={`${ui.label} block mb-2`}>Enviar a</label>
            <input id="correos-prueba" type="text" autoFocus value={texto} onChange={(e) => { setTexto(e.target.value); setMessage(null); }}
              className={`${ui.input} w-full`} placeholder="tu@mhorizon.com.ec" />
            <p className={`text-xs mt-1.5 ${aviso ? 'font-medium text-amber-600' : 'text-slate-500'}`}>
              {aviso || `Hasta ${MAX_CORREOS} correos, separados por comas.`}
            </p>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-snug text-slate-600">
            Es solo una prueba: no aparece en Campañas ni en las métricas y no cambia a ningún prospecto.
            Llega con el mismo remitente y diseño, pero sin medir aperturas ni clics, y el enlace para darse de baja no hace nada.
          </p>
          <StatusMessage message={message} className="p-3 rounded-lg" />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button type="button" onClick={cerrar} disabled={enviando} className={ui.btn}>Cerrar</button>
          <button type="submit" disabled={!listo || enviando} className={ui.btnPrimary}>
            {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><FlaskConical size={16} /> Enviar prueba</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}
