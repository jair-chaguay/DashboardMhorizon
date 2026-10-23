import { useState, useEffect } from 'react';
import { UploadCloud, Search, Tag, X, Trash2 } from 'lucide-react';
import api from '../api/api';
import Swal from 'sweetalert2'
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { selectClass, ui } from '../utils/theme';

export default function Audience() {
  const [file, setFile] = useState(null);
  const [etiquetasUpload, setEtiquetasUpload] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el modal de etiquetas manuales
  const [modalTag, setModalTag] = useState({ isOpen: false, email: '' });
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');

  const [filtroEtiqueta, setFiltroEtiqueta] = useState('Todas');
  const etiquetasUnicas = Array.from(new Set(leads.flatMap(l => {
    try { return JSON.parse(l.etiquetas || '[]'); } catch { return []; }
  })))

  const handleQuitarEtiqueta = async (email, etiquetaQuitar) => {
    try {
      await api.post('/leads/etiquetas/remove', { email, etiqueta: etiquetaQuitar });
      fetchLeads();
    } catch (error) {
      alert("Error al quitar la etiqueta", error);
    }
  };

  const handleEliminarProspecto = async (email) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanetenmente a ${email} de la base de datos?`)) {
      return;
    }
    try {
      await api.post('/leads/delete', { email });

       Swal.fire({
        title: '¡Éxito!',
        text: 'El usuario se elimino satisfactoriamente.',
        icon: 'success',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#28a745'
      })
      fetchLeads();
    } catch (error) {
      console.error('Error al eliminar el prospecto', error);
      alert('Hubo un error al intentar eliminar al prospecto');
    }
  }

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads');
      const leadsArray = Array.isArray(response.data) ? response.data : (response.data.data || []);
      setLeads(leadsArray);
    } catch (error) {
      console.error('Error al cargar leads', error);
      setLeads([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };


  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('csv_file', file);
    if (etiquetasUpload.trim() !== '') {
      formData.append('etiquetas', etiquetasUpload);
    }

    try {
      await api.post('/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: 'Base de datos cargada y etiquetas asignadas correctamente.' });
      setFile(null);
      setEtiquetasUpload('');
      // Resetea visualmente el input de archivo
      document.getElementById('csv-file-input').value = '';
      fetchLeads();
    } catch (error) {
      setMessage({ type: 'error', text: 'Hubo un error al subir el archivo CSV.' });
      console.log(error);
    } finally {
      setUploading(false);
    }
  };

  const handleAgregarEtiquetaManual = async (e) => {
    e.preventDefault();
    if (!nuevaEtiqueta.trim()) return;

    try {
      await api.post('/leads/etiquetas', {
        email: modalTag.email,
        etiquetas: nuevaEtiqueta
      });
      setModalTag({ isOpen: false, email: '' });
      setNuevaEtiqueta('');
      fetchLeads();
    } catch (error) {
      console.error('Error al agregar etiqueta', error);
      alert('Hubo un error al guardar la etiqueta');
    }
  };

  const leadsFiltrados = leads.filter(l => l.email.includes(searchTerm)).filter(l => {
    if (filtroEtiqueta === 'Todas') return true;
    try {
      const tags = JSON.parse(l.etiquetas || '[]');
      if (filtroEtiqueta === 'SinEtiqueta') return tags.length === 0;
      return tags.includes(filtroEtiqueta);
    } catch { return false; }
  });

  return (
    <div className="space-y-5">
      <PageHeader description="Tus prospectos, su fase en el embudo y sus etiquetas.">Base de datos</PageHeader>

      {/* Sección de Carga Masiva con CSV y Etiquetas */}
      <section className={`${ui.card} p-5`}>
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-slate-900">Cargar prospectos desde CSV</h3>
          <p className="text-[13px] text-slate-500 mt-0.5">Las etiquetas que escribas se asignan a todos los prospectos del archivo.</p>
        </div>
        <form onSubmit={handleUpload} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <label className={`relative w-full md:flex-1 min-w-0 h-10 flex items-center gap-3 px-3 rounded-lg border border-dashed cursor-pointer transition-colors ${file ? 'border-slate-300 bg-slate-50' : 'border-slate-300 hover:border-slate-400'}`}>
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <UploadCloud size={17} className={`shrink-0 ${file ? 'text-brand-600' : 'text-slate-400'}`} />
            {file
              ? <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{file.name}</span>
              : <span className="min-w-0 flex-1 truncate text-sm text-slate-500"><span className="font-semibold text-slate-700">Elegir archivo CSV</span></span>}
          </label>
          <input
            type="text"
            placeholder="Etiquetas (ej. VIP, Evento, Inversionista)"
            value={etiquetasUpload}
            onChange={(e) => setEtiquetasUpload(e.target.value)}
            className={`${ui.input} w-full md:w-80`}
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className={`${ui.btnPrimary} px-5 whitespace-nowrap`}
          >
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </button>
        </form>
        {message && (
          <div role="status" className={`mt-4 p-3 rounded-lg text-sm font-medium animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </section>

      {/* Listado de Prospectos */}
      <section className={`${ui.card} overflow-hidden`}>
        <div className="p-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar correo..."
              aria-label="Buscar correo"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${ui.input} pl-9 w-full`}
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-[13px] text-slate-500 hidden sm:inline mr-1">{leadsFiltrados.length} de {leads.length}</span>
            <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)} className={`${selectClass} w-full sm:w-auto`} aria-label="Filtrar por etiqueta">
              <option value="Todas">Etiqueta: todas</option>
              <option value="SinEtiqueta">Sin etiquetas</option>
              {etiquetasUnicas.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-y border-slate-100">
                <th className={ui.th}>Correo electrónico</th>
                <th className={ui.th}>Fase</th>
                <th className={ui.th}>Estado</th>
                <th className={ui.th}>Etiquetas</th>
                <th className={ui.th}><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-slate-500">No hay prospectos registrados. Sube un CSV para comenzar.</td>
                </tr>
              ) : (
                leadsFiltrados.map((lead, idx) => (
                  <tr key={idx} className="group border-t border-slate-100 first:border-t-0 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-5 font-medium text-slate-900">{lead.email}</td>
                    <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap">Fase {lead.fase || 1}</td>
                    <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap">{lead.status || 'Pendiente'}</td>

                    {/* Renderizado de Etiquetas */}
                    <td className="py-2.5 px-5">
                      {(() => {
                        try {
                          const tags = lead.etiquetas ? JSON.parse(lead.etiquetas) : [];
                          return tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium">
                                  {tag}
                                  <button onClick={() => handleQuitarEtiqueta(lead.email, tag)} title={`Quitar ${tag}`} aria-label={`Quitar ${tag}`} className="cursor-pointer text-slate-400 hover:text-rose-600 rounded p-0.5 transition-colors">
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          );
                        } catch {
                          return <span className="text-slate-300">—</span>;
                        }
                      })()}
                    </td>

                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModalTag({ isOpen: true, email: lead.email })}
                          className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Agregar etiqueta" aria-label="Agregar etiqueta"
                        >
                          <Tag size={15} />
                        </button>
                        <button onClick={() => handleEliminarProspecto(lead.email)} title="Eliminar" aria-label="Eliminar"
                          className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal flotante para agregar etiqueta manual */}
      <Modal isOpen={modalTag.isOpen} onClose={() => setModalTag({ isOpen: false, email: '' })} className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-slate-900">Añadir etiqueta</h3>
          <button onClick={() => setModalTag({ isOpen: false, email: '' })} aria-label="Cerrar" className="text-slate-400 hover:text-slate-800 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Prospecto: <span className="font-bold">{modalTag.email}</span>
        </p>
        <form onSubmit={handleAgregarEtiquetaManual}>
          <input
            type="text"
            autoFocus
            placeholder="Ej. VIP, Promo, etc."
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            className={`${ui.input} w-full mb-4`}
          />
          <button
            type="submit"
            disabled={!nuevaEtiqueta.trim()}
            className={`${ui.btnPrimary} w-full`}
          >
            Guardar etiqueta
          </button>
        </form>
      </Modal>
    </div>
  );
}
