import { useState, useMemo, useRef } from 'react';
import { UploadCloud, Search, Database, Tag, X, Trash2 } from 'lucide-react';
import api from '../api/api';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusMessage from '../components/StatusMessage';
import { useLeads } from '../hooks/useLeads';
import { parseTags } from '../utils/tags';
import { confirmAction, notifyError, notifySuccess } from '../utils/notify';

const EMPTY_TAG_MODAL = { isOpen: false, email: '' };

export default function Audience() {
  const { leads, loading, fetchLeads, tags: etiquetasUnicas } = useLeads();
  const [file, setFile] = useState(null);
  const [etiquetasUpload, setEtiquetasUpload] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('Todas');
  const fileInputRef = useRef(null);

  // Estados para el modal de etiquetas manuales
  const [modalTag, setModalTag] = useState(EMPTY_TAG_MODAL);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');

  const closeTagModal = () => {
    setModalTag(EMPTY_TAG_MODAL);
    setNuevaEtiqueta('');
  };

  const leadsFiltrados = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return leads.filter(l => {
      if (search && !(l.email || '').toLowerCase().includes(search)) return false;
      if (filtroEtiqueta === 'Todas') return true;
      const tags = parseTags(l.etiquetas);
      if (filtroEtiqueta === 'SinEtiqueta') return tags.length === 0;
      return tags.includes(filtroEtiqueta);
    });
  }, [leads, searchTerm, filtroEtiqueta]);

  const handleQuitarEtiqueta = async (email, etiquetaQuitar) => {
    try {
      await api.post('/leads/etiquetas/remove', { email, etiqueta: etiquetaQuitar });
      fetchLeads();
    } catch (error) {
      console.error('Error al quitar la etiqueta', error);
      notifyError('No se pudo quitar la etiqueta.');
    }
  };

  const handleEliminarProspecto = async (email) => {
    const confirmed = await confirmAction({
      title: '¿Eliminar prospecto?',
      text: `Se eliminará permanentemente a ${email} de la base de datos.`,
      confirmText: 'Sí, eliminar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.post('/leads/delete', { email });
      notifySuccess('El usuario se eliminó satisfactoriamente.');
      fetchLeads();
    } catch (error) {
      console.error('Error al eliminar el prospecto', error);
      notifyError('Hubo un error al intentar eliminar al prospecto.');
    }
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
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchLeads();
    } catch (error) {
      const detail = error?.response?.data?.message;
      setMessage({ type: 'error', text: detail ? `Hubo un error al subir el archivo CSV: ${detail}` : 'Hubo un error al subir el archivo CSV.' });
      console.error(error);
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
      closeTagModal();
      fetchLeads();
    } catch (error) {
      console.error('Error al agregar etiqueta', error);
      notifyError('Hubo un error al guardar la etiqueta.');
    }
  };

  const renderEmptyRow = (text) => (
    <tr>
      <td colSpan="5" className="py-8 text-center text-gray-500">{text}</td>
    </tr>
  );

  return (
    <div className="p-8">
      <PageHeader>Base de Datos CRM</PageHeader>

      {/* Sección de Carga Masiva con CSV y Etiquetas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database size={18} /> Cargar nuevos prospectos (CSV)
        </h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-blue-200 border border-gray-300 rounded-md cursor-pointer"
            />
            <input
              type="text"
              placeholder="Etiquetas (ej. VIP, Evento, Inversionista)"
              value={etiquetasUpload}
              onChange={(e) => setEtiquetasUpload(e.target.value)}
              className="w-full md:w-80 py-2 px-3 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full md:w-auto bg-orange-500 hover:bg-blue-200 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer duration-300"
            >
              {uploading ? 'Subiendo...' : <><UploadCloud size={18} /> Subir</>}
            </button>
          </div>
        </form>
        <StatusMessage message={message} className="mt-4 p-3 rounded-md" />
      </div>

      {/* Listado de Prospectos */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-semibold text-gray-700">
            Directorio de Prospectos <span className="text-gray-400 text-sm font-normal">({leadsFiltrados.length} de {leads.length})</span>
          </h3>
          <div className="flex gap-3">
            <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)}
              className="py-2 px-3 border cursor-pointer border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white">
              <option value="Todas">Todas las etiquetas</option>
              <option value="SinEtiqueta">Sin etiquetas</option>
              {etiquetasUnicas.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-orange-500 w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-white text-gray-600">
                <th className="py-3 px-6 font-medium">Correo Electrónico</th>
                <th className="py-3 px-6 font-medium text-center">Fase Actual</th>
                <th className="py-3 px-6 font-medium">Estado</th>
                <th className="py-3 px-6 font-medium">Etiquetas</th>
                <th className="py-3 px-6 font-medium text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? renderEmptyRow('Cargando prospectos...')
                : leads.length === 0 ? renderEmptyRow('No hay prospectos registrados. Sube un CSV para comenzar.')
                : leadsFiltrados.length === 0 ? renderEmptyRow('Ningún prospecto coincide con la búsqueda o el filtro.')
                : leadsFiltrados.map((lead) => {
                  const tags = parseTags(lead.etiquetas);
                  return (
                    <tr key={lead.email} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-6 font-medium text-gray-900">{lead.email}</td>
                      <td className="py-3 px-6 text-center">
                        <span className="bg-blue-200 text-white font-bold px-2 py-1 rounded text-xs">
                          Fase {lead.fase || 1}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-gray-500 text-xs">{lead.status || 'Pendiente'}</td>

                      {/* Renderizado de Etiquetas */}
                      <td className="py-3 px-6">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold border border-gray-200">
                                {tag}
                                <button onClick={() => handleQuitarEtiqueta(lead.email, tag)} title={`Quitar ${tag}`} className="ml-2 cursor-pointer text-gray-400 hover:text-red-500 rounded-full p-0.5 transition-colors">
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="py-3 px-6 text-center">
                        <div className='flex items-center justify-center gap-3'>
                          <button
                            onClick={() => setModalTag({ isOpen: true, email: lead.email })}
                            className="text-gray-400 hover:text-orange-500 transition-colors cursor-pointer p-1"
                            title="Agregar Etiqueta"
                          >
                            <Tag size={18} />
                          </button>

                          <button onClick={() => handleEliminarProspecto(lead.email)} title='Eliminar' className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-1">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal flotante para agregar etiqueta manual */}
      <Modal isOpen={modalTag.isOpen} onClose={closeTagModal} className="bg-white p-6 rounded-lg shadow-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Añadir Etiqueta</h3>
          <button onClick={closeTagModal} aria-label="Cerrar" className="text-gray-500 hover:text-gray-800 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Prospecto: <span className="font-semibold">{modalTag.email}</span>
        </p>
        <form onSubmit={handleAgregarEtiquetaManual}>
          <input
            type="text"
            autoFocus
            placeholder="Ej. VIP, Promo, etc."
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none mb-4 text-sm"
          />
          <button
            type="submit"
            disabled={!nuevaEtiqueta.trim()}
            className="w-full bg-orange-500 hover:bg-blue-200 text-white font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer text-sm"
          >
            Guardar Etiqueta
          </button>
        </form>
      </Modal>
    </div>
  );
}
