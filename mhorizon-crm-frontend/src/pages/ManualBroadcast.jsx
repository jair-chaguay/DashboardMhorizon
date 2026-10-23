import { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Send, Loader2, Paperclip } from 'lucide-react';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import { ui } from '../utils/theme';

const Step = ({ n, title, hint, children }) => (
  <section className={`${ui.card} p-5`}>
    <div className="flex items-start gap-3 mb-4">
      <span className="h-6 w-6 mt-px shrink-0 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold grid place-items-center">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-[13px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
    {children}
  </section>
);

export default function ManualBroadcast() {
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fase, setFase] = useState(1);
  const [archivos, setArchivos] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    api.get('/leads').then(res => {
      const leadsArray = Array.isArray(res.data) ? res.data : (res.data.data || []);
      const tagsSet = new Set();
      leadsArray.forEach(l => {
        try {
          const t = JSON.parse(l.etiquetas || '[]');
          t.forEach(tag => tagsSet.add(tag));
        } catch (e) { console.log(e) }
      });
      setAvailableTags(Array.from(tagsSet));
    }).catch(err => console.log('Error cargando etiquetas', err));
  }, []);

  const modulosQuill = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleDespachar = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('asunto', asunto);
    formData.append('cuerpo', cuerpo);
    formData.append('fase', fase);

    // Si escribió una etiqueta opcional, la enviamos al backend
    if (selectedTags.length > 0) {
      formData.append('etiqueta', selectedTags.join(','));
    }

    for (let i = 0; i < archivos.length; i++) {
      formData.append('adjuntos[]', archivos[i]);
    }

    try {
      await api.post('/campaign/manual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: 'Campaña encolada con éxito.' });
      setAsunto('');
      setCuerpo('');
      setSelectedTags([]);
      setArchivos([]);
      document.getElementById('file-upload').value = '';
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al encolar la campaña.' });
      console.log(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <PageHeader description="Elige la fase y las etiquetas, redacta el correo y envíalo a ese público.">Difusión manual</PageHeader>

      <form onSubmit={handleDespachar} className="max-w-3xl space-y-5">

        {/* Selección de Fase */}
        <Step n="1" title="Público objetivo" hint="Fase del CRM y, si quieres afinar, etiquetas.">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[1, 2, 3, 4, 5].map(num => {
              const activo = fase === num;
              return (
                <button
                  type="button"
                  key={num}
                  onClick={() => setFase(num)}
                  aria-pressed={activo}
                  className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${activo
                    ? 'bg-brand-50/60 border-brand-600 ring-1 ring-brand-600 text-brand-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  Fase {num}
                </button>
              );
            })}
          </div>

          {availableTags.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className={`${ui.label} mb-2.5`}>Filtrar por etiqueta <span className="font-normal text-slate-500">(opcional)</span></p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const activa = selectedTags.includes(tag);
                  return (
                    <button type="button" key={tag} onClick={() => toggleTag(tag)} aria-pressed={activa}
                      className={`cursor-pointer rounded-md border px-2.5 py-1 text-[13px] font-medium transition-colors ${activa
                        ? 'bg-navy-900 border-navy-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {tag}
                    </button>
                  );
                })}
              </div>
              {selectedTags.length === 0 && <p className="text-[13px] text-slate-500 mt-3">Si no selecciona ninguna, se enviará a todos los prospectos de la Fase {fase}.</p>}
            </div>
          )}
        </Step>

        <Step n="2" title="Mensaje" hint="Puedes pegar imágenes directamente en el editor.">
          <label htmlFor="asunto" className={`${ui.label} block mb-2`}>Asunto del correo</label>
          <input
            id="asunto"
            type="text"
            required
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className={`${ui.input} w-full`}
            placeholder="Ej. Propuesta exclusiva..."
          />

          {/* Cuerpo */}
          <p className={`${ui.label} mt-5 mb-2`}>Cuerpo del correo</p>
          <div className="editor-body">
            <ReactQuill
              theme="snow"
              value={cuerpo}
              onChange={setCuerpo}
              modules={modulosQuill}
            />
          </div>
        </Step>

        {/* Adjuntos */}
        <Step n="3" title="Adjuntos" hint="Opcional. PDF, Excel, imágenes, etc.">
          <label htmlFor="file-upload"
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
            <Paperclip size={16} /> {archivos.length > 0 ? `${archivos.length} archivo${archivos.length > 1 ? 's' : ''} seleccionado${archivos.length > 1 ? 's' : ''}` : 'Elegir archivos'}
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            onChange={(e) => setArchivos(e.target.files)}
            className="sr-only"
          />
        </Step>

        {message && (
          <div role="status" className={`p-3 rounded-lg font-medium text-sm animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isSending}
          className={`${ui.btnPrimary} h-11 px-6`}
        >
          {isSending ? <><Loader2 size={17} className="animate-spin" /> Encolando...</> : <><Send size={17} /> Enviar campaña</>}
        </button>
      </form>
    </div>
  );
}
