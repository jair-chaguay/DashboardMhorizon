import { useState } from 'react';
import { Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import api from '../api/api';
import Modal from './Modal';
import { ui } from '../utils/theme';
import { confirmAction } from '../utils/notify';

const VACIO = { email: '', nombre: '', smtp_host: '', smtp_port: '', smtp_usuario: '', smtp_password: '' };

// Correos de remitente registrados en el servidor: se agregan y se eliminan aquí.
// La contraseña SMTP solo viaja al guardar; el servidor la cifra y nunca la devuelve
export default function SenderManager({ isOpen, onClose, remitentes, onCambio }) {
  const [form, setForm] = useState(VACIO);
  const [smtpAbierto, setSmtpAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const campo = (key) => ({ value: form[key], onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })) });

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const datos = { email: form.email.trim(), nombre: form.nombre.trim() };
      if (smtpAbierto && form.smtp_host.trim()) {
        Object.assign(datos, { smtp_host: form.smtp_host.trim(), smtp_port: Number(form.smtp_port) || null, smtp_usuario: form.smtp_usuario.trim() || null, smtp_password: form.smtp_password || null });
      }
      const { data } = await api.post('/remitentes', datos);
      setForm(VACIO);
      setSmtpAbierto(false);
      await onCambio(data?.id);
    } catch (err) {
      const errores = err?.response?.data?.errors;
      setError(errores?.email ? 'Ese correo ya está registrado o no es válido.' : err?.response?.data?.message || 'No se pudo agregar el remitente.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (r) => {
    const ok = await confirmAction({ title: '¿Eliminar remitente?', text: `Ya no se podrá enviar desde ${r.email}. Las campañas enviadas no cambian.`, confirmText: 'Sí, eliminar', danger: true });
    if (!ok) return;
    setError('');
    try {
      await api.delete(`/remitentes/${r.id}`);
      await onCambio();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el remitente.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Correos de remitente</h3>
          <p className="text-[13px] text-slate-500 mt-0.5">Las cuentas desde las que puedes enviar tus difusiones.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="h-8 w-8 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X size={17} /></button>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-5">
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {remitentes.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Aún no hay remitentes registrados.</li>}
          {remitentes.map(r => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{r.nombre}</p>
                <p className="truncate text-xs text-slate-500">{r.email}{r.smtp_propio ? ' · servidor propio' : ''}</p>
              </div>
              {r.predeterminado && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"><Star size={11} /> Principal</span>}
              <button type="button" onClick={() => eliminar(r)} disabled={remitentes.length === 1} aria-label={`Eliminar ${r.email}`}
                title={remitentes.length === 1 ? 'Debe quedar al menos un remitente' : 'Eliminar'}
                className="h-8 w-8 grid place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed cursor-pointer"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>

        <form onSubmit={agregar} className="space-y-3">
          <p className={ui.label}>Agregar remitente</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1">Correo</span>
              <input type="email" required maxLength={255} {...campo('email')} className={`${ui.input} w-full`} placeholder="ventas@mhorizon.com.ec" />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1">Nombre que verán</span>
              <input type="text" required maxLength={120} {...campo('nombre')} className={`${ui.input} w-full`} placeholder="Ej. Ana de MHORIZON" />
            </label>
          </div>

          <label className="flex items-start gap-2 text-[13px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={smtpAbierto} onChange={(e) => setSmtpAbierto(e.target.checked)} className="mt-0.5 accent-brand-600" />
            <span>Esta cuenta usa su propio servidor de correo <span className="text-slate-500">(si no, se envía con la cuenta principal y este correo aparece como remitente)</span></span>
          </label>
          {smtpAbierto && (
            <div className="grid sm:grid-cols-[1fr_96px] gap-3 animate-fade-in">
              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">Servidor SMTP</span>
                <input type="text" required maxLength={255} {...campo('smtp_host')} className={`${ui.input} w-full`} placeholder="mail.mhorizon.com.ec" />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">Puerto</span>
                <input type="number" min={1} max={65535} {...campo('smtp_port')} className={`${ui.input} w-full`} placeholder="465" />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">Usuario</span>
                <input type="text" maxLength={255} autoComplete="off" {...campo('smtp_usuario')} className={`${ui.input} w-full`} placeholder="Igual al correo" />
              </label>
              <label className="block">
                <span className="block text-xs text-slate-500 mb-1">Contraseña</span>
                <input type="password" maxLength={255} autoComplete="new-password" {...campo('smtp_password')} className={`${ui.input} w-full`} />
              </label>
            </div>
          )}

          {error && <p className="text-[13px] font-medium text-rose-600">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={guardando} className={ui.btnPrimary}>
              {guardando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Agregar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
