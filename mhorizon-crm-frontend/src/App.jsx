import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from './api/api';

// Componentes y Hooks Importados
import Login from './components/Login';
import DetailsModal from './components/DetailsModal';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';

const MetricBox = ({ label, value }) => (
  <div>
    <div className="text-3xl font-light text-gray-900 mb-1">{value}</div>
    <div className="text-xs font-medium text-gray-500 uppercase tracking-tight">{label}</div>
  </div>
);

const MiniStat = ({ label, value, color }) => (
  <div className={`border-l-2 ${color} pl-2`}>
    <div className="text-[10px] text-gray-500 uppercase tracking-tight">{label}</div>
    <div className="text-sm font-semibold text-gray-900">{value}</div>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('admin_user')) || null);
  
  // ESTADOS DE VISTA Y PAGINACIÓN
  const [viewMode, setViewMode] = useState('list'); // 'list' o 'detail'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  // EL useCallback AQUÍ ELIMINA EL BUCLE INFINITO DEL "CARGANDO..."
  const handleLogout = useCallback(async () => {
    try { await api.post('/logout'); } catch (e) { console.error("Error al cerrar sesión", e); }
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const { 
    loading, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    uniqueCampaigns, metrics, funnelData, crmFunnelData, linkInsights, deviceData, 
    timeSeriesData, hourlyActivityData, campaignsSummary, isGlobalView,
    modalDetails, setModalDetails, openDetails
  } = useDashboardMetrics(isAuthenticated, handleLogout);

  // Lógica de Paginación
  const totalPages = Math.ceil((campaignsSummary?.length || 0) / ITEMS_PER_PAGE);
  const paginatedCampaigns = (campaignsSummary || []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  // Funciones de navegación
  const handleViewReport = (campaignName) => {
    setCampaignSearch(campaignName);
    setDateFilter('Todos');
    setViewMode('detail');
  };

  const handleGlobalReport = () => {
    setCampaignSearch('');
    setDateFilter('Todos');
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setCampaignSearch('');
    setViewMode('list');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={(u, token) => {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(u);
      setIsAuthenticated(true);
    }} />
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        
        {/* Cabecera Principal */}
        <div className="border-b border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            {viewMode === 'detail' && (
              <button onClick={handleBackToList} className="text-gray-500 hover:text-gray-800 transition mr-2 cursor-pointer font-medium">
                ← Volver
              </button>
            )}
            <span className="text-[#151E28] font-bold text-lg">MHORIZON Campaigns</span>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            {viewMode === 'detail' && (
              <>
                <div className="relative hidden md:block">
                  <input list="campaign-options" placeholder=" Buscar campaña..."
                    className="bg-white border border-gray-300 text-sm rounded-md block p-2 w-64 text-gray-700 outline-none"
                    value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} />
                  <datalist id="campaign-options">
                    {uniqueCampaigns.map((camp, idx) => <option key={idx} value={camp} />)}
                  </datalist>
                </div>
                <select className="cursor-pointer bg-white border border-gray-300 text-sm rounded-md block py-2 px-3 text-gray-700 outline-none"
                  value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="Todos">Todos los tiempos</option>
                  <option value="7dias">Últimos 7 días</option>
                  <option value="esteMes">Este mes</option>
                </select>
              </>
            )}
            <button onClick={fetchData} className="cursor-pointer px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition">
              {loading ? '↻ Cargando...' : '↻ Actualizar'}
            </button>
            <div className="hidden lg:block border-l border-gray-200 pl-4 ml-2">
              <span className="text-sm font-medium text-gray-700">Hola, {user?.nombre || 'Admin'}</span>
            </div>
            <button onClick={handleLogout} className="cursor-pointer text-sm text-[#D46822] hover:text-[#b95310] font-bold underline px-2">Salir</button>
          </div>
        </div>

        <div className="p-6 bg-white min-h-[600px]">
          
          {/* VISTA 1: TABLA DE CAMPAÑAS (PAGINADA) */}
          {viewMode === 'list' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Campañas Recientes</h2>
                <button 
                  onClick={handleGlobalReport}
                  className="cursor-pointer bg-[#151E28] text-white hover:bg-[#D46822] border border-blue-200 px-4 py-2 rounded-md text-sm font-semibold transition"
                >
                   Ver Reporte Global CRM
                </button>
              </div>

              {campaignsSummary.length === 0 && !loading ? (
                <div className="text-center py-12 text-gray-500">No hay campañas registradas todavía.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-3 font-medium px-4">Detalles</th>
                        <th className="pb-3 font-medium px-4">Público</th>
                        <th className="pb-3 font-medium px-4">Análisis</th>
                        <th className="pb-3 font-medium px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCampaigns.map((camp, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="py-4 px-4 align-top max-w-md">
                            <h3 className="text-teal-700 font-bold text-base mb-1 uppercase tracking-tight">{camp.name}</h3>
                            <div className="text-gray-500 text-xs flex items-center gap-1 mb-2">
                              <span></span> Correo electrónico ordinario
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold">Enviado</span>
                              <span className="text-gray-400 text-xs">{camp.dateStr}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-top">
                            <div className="text-teal-700 font-semibold text-sm">MHORIZON ECUADOR</div>
                            <div className="text-gray-500 text-xs mt-1">Enviar a Cliente, base...</div>
                            <div className="text-gray-900 font-medium text-xs mt-1">{camp.sent} destinatarios</div>
                          </td>
                          <td className="py-4 px-4 align-top">
                            <div className="flex gap-6">
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{camp.openRate}%</div>
                                <div className="text-gray-500 text-xs">Aperturas</div>
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{camp.clickRate}%</div>
                                <div className="text-gray-500 text-xs">Clics</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 align-middle text-right">
                            <button 
                              onClick={() => handleViewReport(camp.name)}
                              className="cursor-pointer border border-gray-300 text-gray-700 rounded hover:bg-gray-100 px-4 py-1.5 text-sm font-medium transition"
                            >
                              Ver reporte
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* CONTROLES DE PAGINACIÓN */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, campaignsSummary.length)} de {campaignsSummary.length} campañas
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition cursor-pointer"
                        >
                          Anterior
                        </button>
                        <button 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition cursor-pointer"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: DASHBOARD DETALLADO */}
          {viewMode === 'detail' && (
            <div className="animate-fade-in bg-gray-50 -m-6 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isGlobalView ? 'Reporte Global del CRM' : `Reporte: ${campaignSearch}`}
                </h2>
              </div>

              {/* Fila 1: KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4 flex justify-between">
                    Entrega <span onClick={() => openDetails('sent')} className="text-xs cursor-pointer hover:underline text-blue-500">Ver detalles</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <MetricBox label="Tasa de entrega" value={metrics.deliveryRate} />
                    <MetricBox label="Bloqueado" value={metrics.blocked} />
                    <MetricBox label="Falló" value={metrics.failed} />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4 flex justify-between">
                    Interacciones <span onClick={() => openDetails('opens')} className="text-xs cursor-pointer hover:underline text-blue-500">Ver detalles</span>
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    <MetricBox label="Apertura" value={metrics.openRate} />
                    <MetricBox label="Clics" value={metrics.clickRate} />
                    <MetricBox label="CTOR" value={metrics.ctor} />
                    <MetricBox label="Spam" value={metrics.spam} />
                    <MetricBox label="Desuscrito" value={metrics.unsubscribed} />
                  </div>
                </div>
              </div>

              {/* Fila 2: Embudos y Tendencias */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Tendencia de entrega</h3>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{top:5, right:10, left:-20, bottom:0}}>
                        <CartesianGrid vertical={false} stroke="#f3f4f6"/>
                        <XAxis dataKey="date" tick={{fontSize:11, fill:'#6b7280'}} dy={10} axisLine tickLine={false}/>
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#6b7280'}}/>
                        <Tooltip contentStyle={{ borderRadius: '8px' }}/>
                        <Line type="linear" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
                    <MiniStat label="Enviado" value={metrics.sent} color="border-blue-500" />
                    <MiniStat label="Entregado" value={metrics.delivered} color="border-pink-500" />
                    <MiniStat label="Aperturas" value={metrics.uniqueOpens} color="border-teal-500" />
                    <MiniStat label="Clics" value={metrics.uniqueClicks} color="border-gray-500" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Embudo de entrega</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData} layout="vertical" margin={{right:30, left:30}}>
                        <XAxis type="number" hide/>
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#4b5563'}} width={100}/>
                        <Tooltip cursor={{fill: '#f3f4f6'}}/>
                        <Bar dataKey="value" fill="#6366f1" barSize={12} radius={[0,4,4,0]} label={{position:'right', fill:'#6b7280', fontSize:11}}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Embudo Comercial</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={crmFunnelData} layout="vertical" margin={{right:30, left:10}}>
                        <XAxis type="number" hide/>
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#4b5563'}} width={120}/>
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" fill="#f59e0b" barSize={12} radius={[0,4,4,0]} label={{position:'right', fill:'#6b7280', fontSize:11}}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Fila 3: Dispositivos, Calor y Links */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Dispositivos</h3>
                  <div className="h-48 w-full flex items-center justify-center">
                    {deviceData.length === 0 ? <span className="text-gray-400 text-sm">Esperando datos...</span> : 
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deviceData} innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                          {deviceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Mapa de Calor (24h)</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyActivityData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="hour" axisLine={true} tickLine={false} tick={{fill: '#6b7280', fontSize: 10}} dy={10} interval="preserveStartEnd" minTickGap={5} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} />
                        <Bar dataKey="aperturas" name="Aperturas" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="clics" name="Clics" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-4">Link insights</h3>
                  <div className="overflow-y-auto max-h-48">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="pb-2 text-gray-500">URL</th>
                          <th className="pb-2 text-gray-500">Clics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkInsights.map((link, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition">
                            <td className="py-2">
                              <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 truncate max-w-[200px] block">{link.url}</a>
                            </td>
                            <td className="py-2 font-bold">{link.total}</td>
                          </tr>
                        ))}
                        {linkInsights.length === 0 && (
                           <tr><td colSpan="2" className="py-4 text-center text-gray-400">Sin clics registrados</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <DetailsModal modalDetails={modalDetails} setModalDetails={setModalDetails} />
    </div>
  );
}

export default App;