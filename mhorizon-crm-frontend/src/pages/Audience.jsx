import { useState, useEffect } from 'react';
import { UploadCloud, Search, Database, Tag, X, Trash2 } from 'lucide-react';
import api from '../api/api';
import Swal from 'sweetalert2'

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

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        Base de Datos CRM
      </h2>

      {/* Sección de Carga Masiva con CSV y Etiquetas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database size={18} /> Cargar nuevos prospectos (CSV)
        </h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
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
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Listado de Prospectos */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-semibold text-gray-700">Directorio de Prospectos</h3>
          <div className="flex gap-3">
            <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)}
              className="py-2 px-3 border cursor-pointer border-gray-300 rounded-md text-sm outline-none focus:rig-2 focus:ring-orange-500 bg-white">
              <option value="Todas">Todas las eitquetas</option>
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
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-500">No hay prospectos registrados. Sube un CSV para comenzar.</td>
                </tr>
              ) : (
                leads.filter(l => l.email.includes(searchTerm)).filter(l => {
                  if (filtroEtiqueta === 'Todas') return true;
                  try {
                    const tags = JSON.parse(l.etiquetas || '[]');
                    if (filtroEtiqueta === 'SinEtiqueta') return tags.length === 0;
                    return tags.includes(filtroEtiqueta);
                  } catch { return false; }
                }).map((lead, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 font-medium text-gray-900">{lead.email}</td>
                    <td className="py-3 px-6 text-center">
                      <span className="bg-blue-200 text-white font-bold px-2 py-1 rounded text-xs">
                        Fase {lead.fase || 1}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-gray-500 text-xs">{lead.status || 'Pendiente'}</td>

                    {/* Renderizado de Etiquetas */}
                    <td className="py-3 px-6">
                      {(() => {
                        try {
                          const tags = lead.etiquetas ? JSON.parse(lead.etiquetas) : [];
                          return tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tags.map((tag, i) => (
                                <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold border border-gray-200">
                                  {tag}
                                  <button onClick={() => handleQuitarEtiqueta(lead.email, tag)} className="ml-2 cursor-pointer text-gray-400 hover:text-red-500 rounded-full p-0 5-transition-colors">
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          );
                        } catch {
                          return <span className="text-gray-400 text-xs">-</span>;
                        }
                      })()}
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

                        <button onClick={()=> handleEliminarProspecto(lead.email)} title='Eliminar' className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-1">
                          <Trash2 size={18} />
                        </button>

                      </div>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal flotante para agregar etiqueta manual */}
      {modalTag.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Añadir Etiqueta</h3>
              <button onClick={() => setModalTag({ isOpen: false, email: '' })} className="text-gray-500 hover:text-gray-800 cursor-pointer">
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
          </div>
        </div>
      )}
    </div>
  );
}