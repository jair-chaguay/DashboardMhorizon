import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../api/api';

export default function ManualBroadcast() {
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fase, setFase] = useState(1);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState(''); // <--- NUEVO: Filtrar por etiqueta opcional
  const [archivos, setArchivos] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);

  const modulosQuill = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
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
    if (etiquetaFiltro.trim() !== '') {
      formData.append('etiqueta', etiquetaFiltro.trim());
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
      setEtiquetaFiltro('');
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
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        Difusión Manual Segmentada
      </h2>

      <form onSubmit={handleDespachar} className="max-w-3xl space-y-6">
        
        {/* Selección de Fase */}
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Público Objetivo (Fase del CRM)
          </label>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                type="button"
                key={num}
                onClick={() => setFase(num)}
                className={`cursor-pointer duration-300 py-2 px-4 text-sm font-semibold rounded-md border transition-all ${
                  fase === num 
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Fase {num}
              </button>
            ))}
          </div>

          {/* NUEVO: Campo opcional para filtrar por etiqueta específica */}
          <div className="mt-4">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Filtrar por Etiqueta (Opcional - Déjalo vacío para enviar a toda la Fase {fase})
            </label>
            <input 
              type="text"
              value={etiquetaFiltro}
              onChange={(e) => setEtiquetaFiltro(e.target.value)}
              placeholder="Ej. VIP, Inversionista..."
              className="w-full p-2.5 bg-white border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Asunto */}
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
            id="file-upload"
            type="file" 
            multiple
            onChange={(e) => setArchivos(e.target.files)}
            className="w-full p-2 border border-gray-300 rounded-lg bg-white"
          />
        </div>

        {message && (
          <div className={`p-4 rounded-lg font-medium text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSending}
          className="bg-orange-500 hover:bg-[#171E27] duration-300 text-white font-bold py-3 px-6 rounded-md shadow-lg flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSending ? 'Encolando...' : <> Enviar a Fase {fase} {etiquetaFiltro ? `(Etiqueta: ${etiquetaFiltro})` : ''}</>}
        </button>
      </form>
    </div>
  );
}