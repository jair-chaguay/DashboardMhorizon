import { useState, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../api/api';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';
import { useLeads } from '../hooks/useLeads';
import { confirmAction } from '../utils/notify';

// Fuera del componente: si se recrea en cada render, Quill reinicia la barra y pierde el foco
const modulosQuill = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ],
};

const FASES = [1, 2, 3, 4, 5];

// Quill deja "<p><br></p>" cuando el editor está vacío
const isEmptyBody = (html) => !/<img/i.test(html) && html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

export default function ManualBroadcast() {
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fase, setFase] = useState(1);
  const [archivos, setArchivos] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const { tags: availableTags } = useLeads();
  const fileInputRef = useRef(null);

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleDespachar = async (e) => {
    e.preventDefault();
    if (isEmptyBody(cuerpo)) {
      setMessage({ type: 'error', text: 'El cuerpo del correo está vacío.' });
      return;
    }

    const destino = selectedTags.length > 0
      ? `los prospectos de la Fase ${fase} con etiqueta: ${selectedTags.join(', ')}`
      : `TODOS los prospectos de la Fase ${fase}`;
    const confirmed = await confirmAction({
      title: '¿Enviar campaña?',
      text: `Se enviará "${asunto}" a ${destino}.`,
      confirmText: 'Sí, enviar',
    });
    if (!confirmed) return;

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

    archivos.forEach(archivo => formData.append('adjuntos[]', archivo));

    try {
      await api.post('/campaign/manual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: 'Campaña encolada con éxito.' });
      setAsunto('');
      setCuerpo('');
      setSelectedTags([]);
      setArchivos([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      const detail = error?.response?.data?.message;
      setMessage({ type: 'error', text: detail ? `Error al encolar la campaña: ${detail}` : 'Error al encolar la campaña.' });
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader>Difusión Manual Segmentada</PageHeader>

      <form onSubmit={handleDespachar} className="max-w-3xl space-y-6">

        {/* Selección de Fase */}
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Público Objetivo (Fase del CRM)
          </label>
          <div className="grid grid-cols-5 gap-3">
            {FASES.map(num => (
              <button
                type="button"
                key={num}
                onClick={() => setFase(num)}
                className={`cursor-pointer duration-300 py-2 px-4 text-sm font-semibold rounded-md border transition-all ${fase === num
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                Fase {num}
              </button>
            ))}
          </div>

          {availableTags.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-200">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-3">
                Filtrar por Etiqueta
              </label>
              <div className="flex flex-wrap gap-3">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center gap-2 bg-white border border-gray-300 px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)}
                      className='text-orange-500 rounded focus:ring-orange-500' />
                    <span className="text-sm font-medium text-gray-700">{tag}</span>
                  </label>
                ))}
              </div>
              {selectedTags.length === 0 && <span className="text-sm text-gray-400 mt-2 block">Si no selecciona ninguna, se enviará a TODOS los prospectos de la Fase {fase}</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Asunto del correo</label>
          <input
            type="text"
            required
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="Ej. Propuesta exclusiva..."
          />
        </div>

        {/* Cuerpo */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Cuerpo del correo (Puedes pegar imágenes)</label>
          <div className="bg-white rounded-lg">
            <ReactQuill
              theme="snow"
              value={cuerpo}
              onChange={setCuerpo}
              modules={modulosQuill}
              className="h-64 mb-12"
            />
          </div>
        </div>

        {/* Adjuntos */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 mt-4">Archivos Adjuntos (PDF, Excel, etc.)</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => setArchivos(Array.from(e.target.files))}
            className="w-full p-2 border border-gray-300 rounded-lg bg-white"
          />
        </div>

        {archivos.length > 0 && (
          <p className="text-xs text-gray-500 -mt-4">{archivos.length} archivo(s): {archivos.map(a => a.name).join(', ')}</p>
        )}

        <StatusMessage message={message} />

        <button
          type="submit"
          disabled={isSending}
          className="bg-orange-500 hover:bg-blue-200 duration-300 text-white font-bold py-3 px-6 rounded-md shadow-lg flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSending ? 'Encolando...' : 'Enviar Campaña'}
        </button>
      </form>
    </div>
  );
}