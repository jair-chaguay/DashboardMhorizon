import { useState, useEffect } from 'react';
import { UploadCloud, Search, Database, Tag, X } from 'lucide-react';
import api from '../api/api';

export default function Audience() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [modalTag, setModalTag] = useState({isOpen: false, email: ''});
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');

  const fetchLeads = async () => {
    try {
      const response = await api.get('/leads');
      const leadsArray = Array.isArray(response.data)? response.data: (response.data.data || []);
      setLeads(leadsArray);
    } catch (error) {
      console.error('Error al cargar leads', error);
      setLeads([])
    }
  };

  const handleAgregarEtiqueta = async (e) =>{
    e.preventDefault();
    if(!nuevaEtiqueta.trim()) return;

    try{
      await api.post('/leads/etiquetas', {
        email: modalTag.email,
        etiquetas: nuevaEtiqueta
      });
      setModalTag({isOpen: false, email: ''});
      setNuevaEtiqueta('');
      fetchLeads();
    }catch (error){
      console.error('Error al agregar etiqueta', error);
      alert('Hubo un error al guardar la etiqueta');
    }
  }

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
    if(etiquetas.trim() !== ''){
      formData.append('etiquetas', etiquetas);
    }

    try {
      await api.post('/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage({ type: 'success', text: 'Base de datos cargada correctamente.' });
      setFile(null);
      fetchLeads();
    } catch (error) {
      setMessage({ type: 'error', text: 'Hubo un error al subir el archivo CSV.' });
      console.log(error)
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
         Base de Datos CRM
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database size={18} /> Cargar nuevos prospectos (CSV)
        </h3>
        <form onSubmit={handleUpload} className="flex transition-colors duration-300 items-center gap-4">
          <input 
            type="file" 
            accept=".csv, .txt" 
            onChange={handleFileChange}
            className="block w-full transition-all duration-300 cursor-pointer text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#D46822] file:text-white hover:file:bg-[#171E27] border border-gray-300 rounded-md"
          />
          <input 
            type="text" 
            placeholder="Etiquetas (ej. Inversores)"
            value={etiquetas}
            onChange={(e)=> setEtiquetas(e.target.value)}
            className="block w-64 py-2 px-3 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#D46822]"
          />

          <button 
            type="submit" 
            disabled={!file || uploading}
            className="bg-orange-500 hover:bg-[#171E27] text-white font-bold py-2 px-6 rounded-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer duration-300"
          >
            {uploading ? 'Subiendo...' : <><UploadCloud size={18} /> Subir</>}
          </button>
        </form>
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h3 className="font-semibold text-gray-700">Directorio de Prospectos</h3>
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
                <th className="py-3 px-6 font-medium">Acción</th>      
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-8 text-center text-gray-500">No hay prospectos registrados. Sube un CSV para comenzar.</td>
                </tr>
              ) : (
                leads.filter(l => l.email.includes(searchTerm)).map((lead, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 font-medium text-gray-900">{lead.email}</td>
                    <td className="py-3 px-6 text-center">
                      <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-xs">
                        Fase {lead.fase || 1}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-gray-500 text-xs">{lead.status || 'Pendiente'}</td>
                    <td className="py-3 px-6 ">{(()=> {
                      try{
                        const tags = lead.etiquetas ? JSON.parse(lead.etiquetas) : [];
                        return tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag,i)=> (
                              <span key={i} className="bg-gray-200 text-gray-700 px-2 py-0 5 rounded-full text-xs font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-40 text-xs">-</span>
                        );
                      }catch {
                        return <span className="text-gray-400 text-xs">-</span>
                      }
                    })}</td>

                    <td className="py-3 px-6 text-center">
                    <button 
                      onClick={() => setModalTag({ isOpen: true, email: lead.email })}
                      className="text-gray-400 hover:text-orange-500 transition-colors cursor-pointer"
                      title="Agregar Etiqueta"
                    >
                      <Tag size={18} />
                    </button>
                  </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modalTag.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Añadir Etiqueta</h3>
              <button onClick={() => setModalTag({ isOpen: false, email: '' })} className="text-gray-500 hover:text-gray-800">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Prospecto: <span className="font-semibold">{modalTag.email}</span>
            </p>
            <form onSubmit={handleAgregarEtiqueta}>
              <input
                type="text"
                autoFocus
                placeholder="Ej. VIP, Promo..."
                value={nuevaEtiqueta}
                onChange={(e) => setNuevaEtiqueta(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 outline-none mb-4"
              />
              <button 
                type="submit" 
                disabled={!nuevaEtiqueta.trim()}
                className="w-full bg-orange-500 hover:bg-[#171E27] text-white font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer"
              >
                Guardar Etiqueta
              </button>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}