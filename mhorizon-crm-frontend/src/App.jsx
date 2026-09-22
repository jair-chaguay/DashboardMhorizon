/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from './../api/api'

function App() {
  const [data, setData] = useState({ leads: [], linkClicks: [], emailLogs: [] });
  const [loading, setLoading] = useState(true);
  const [modalDetails, setModalDetails] = useState({ isOpen: false, title: '', leads: [] });
  
  const [campaignSearch, setCampaignSearch] = useState(''); // Ahora es un buscador
  const [dateFilter, setDateFilter] = useState('Todos');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/leads'); 

      if (response.data && response.data.leads) {
        setData({
          leads: response.data.leads || [],
          linkClicks: response.data.link_clicks || [],
          emailLogs: response.data.email_logs || []
        });
      }
    } catch (error) {
      console.error("Error conectando a Laravel: ", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Construir la lista de autocompletado para el buscador
  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set();
    (data.emailLogs || []).forEach(log => {
      if (log.campaign_name) campaigns.add(log.campaign_name);
    });
    return Array.from(campaigns);
  }, [data.emailLogs]);

  // Función robusta para chequear fechas en Laravel (incluso en Safari/iOS)
  const checkDate = (dateStr) => {
    if (dateFilter === 'Todos') return true;
    if (!dateStr) return false;
    
    // Convertir '2026-09-22 15:00:00' a formato compatible
    const logDate = new Date(dateStr.replace(/-/g, '/')); 
    const now = new Date();

    if (dateFilter === '7dias') {
      return (now - logDate) <= 7 * 24 * 60 * 60 * 1000;
    } else if (dateFilter === 'esteMes') {
      return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // 1. Filtrar LOGS NUEVOS (Basado en la búsqueda y fecha)
  const filteredLogs = useMemo(() => {
    let logs = data.emailLogs || [];
    
    // Si escribió algo en el buscador
    if (campaignSearch.trim() !== '') {
      logs = logs.filter(log => log.campaign_name?.toLowerCase().includes(campaignSearch.toLowerCase()));
    }
    
    // Filtrar por fecha
    logs = logs.filter(log => checkDate(log.created_at));
    
    return logs;
  }, [data.emailLogs, campaignSearch, dateFilter]);


  // 2. Filtrar DATOS VIEJOS (Si no hay búsqueda, mostramos todo respetando la fecha)
  const isGlobalView = campaignSearch.trim() === '';

  const metrics = useMemo(() => {
    // VISTA GLOBAL (Suma lo antiguo con lo nuevo, respetando el filtro de fecha)
    if (isGlobalView) {
      const leadsFiltrados = (data.leads || []).filter(l => checkDate(l.updated_at || l.created_at));
      const clicksFiltrados = (data.linkClicks || []).filter(c => checkDate(c.created_at));

      const sent = leadsFiltrados.reduce((acc, l) => acc + (l.sent || 1), 0);
      const delivered = leadsFiltrados.reduce((acc, l) => acc + (l.delivered || 1), 0);
      const uniqueOpens = leadsFiltrados.filter(l => l.opens > 0).length;
      const uniqueClicks = leadsFiltrados.filter(l => l.clicks > 0).length;
      
      const totalOpens = leadsFiltrados.reduce((acc, l) => acc + l.opens, 0);
      const totalClicks = clicksFiltrados.length;

      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
      const openRate = delivered > 0 ? Math.round((uniqueOpens / delivered) * 100) : 0;
      const clickRate = delivered > 0 ? Math.round((uniqueClicks / delivered) * 100) : 0;
      const ctor = uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 100) : 0;

      return { 
        sent, delivered, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0,
        totalOpens, totalClicks,
        deliveryRate: `${deliveryRate}%`, openRate: `${openRate}%`, clickRate: `${clickRate}%`, ctor: `${ctor}%` 
      };
    }

    // VISTA FILTRADA POR CAMPAÑA (Usa solo logs nuevos de esa campaña)
    const sentEvents = filteredLogs.filter(l => l.event_type === 'sent');
    const openEvents = filteredLogs.filter(l => l.event_type === 'open');
    const clickEvents = filteredLogs.filter(l => l.event_type === 'click');
    const sent = sentEvents.length;
    
    const uniqueOpens = new Set(openEvents.map(e => e.email)).size;
    const uniqueClicks = new Set(clickEvents.map(e => e.email)).size;

    const deliveryRate = sent > 0 ? 100 : 0;
    const openRate = sent > 0 ? Math.round((uniqueOpens / sent) * 100) : 0;
    const clickRate = sent > 0 ? Math.round((uniqueClicks / sent) * 100) : 0;
    const ctor = uniqueOpens > 0 ? Math.round((uniqueClicks / uniqueOpens) * 100) : 0;

    return { 
      sent, delivered: sent, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0,
      totalOpens: openEvents.length, totalClicks: clickEvents.length,
      deliveryRate: `${deliveryRate}%`, openRate: `${openRate}%`, clickRate: `${clickRate}%`, ctor: `${ctor}%` 
    };
  }, [data.leads, data.linkClicks, filteredLogs, isGlobalView, dateFilter]);


  const funnelData = [
    {name: 'Email sent', value: metrics.sent},
    {name: 'Email delivered', value: metrics.delivered},
    {name: 'Unique opens', value: metrics.uniqueOpens},
    {name: 'Unique clicks', value: metrics.uniqueClicks}
  ].reverse();


  const linkInsights = useMemo(() => {
    const urls = {};
    
    if (isGlobalView) {
      (data.linkClicks || []).filter(c => checkDate(c.created_at)).forEach(click => {
        if (!urls[click.url]) urls[click.url] = { total: 0, uniqueUsers: new Set(), alias: extractAlias(click.url) };
        urls[click.url].total += 1;
        urls[click.url].uniqueUsers.add(click.email);
      });
    } else {
      filteredLogs.filter(log => log.event_type === 'click').forEach(click => {
        if (!urls[click.url]) urls[click.url] = { total: 0, uniqueUsers: new Set(), alias: extractAlias(click.url) };
        urls[click.url].total += 1;
        urls[click.url].uniqueUsers.add(click.email);
      });
    }

    return Object.entries(urls).map(([url, info]) => ({
      url, alias: info.alias, total: info.total, unique: info.uniqueUsers.size,
      rate: metrics.uniqueOpens > 0 ? ((info.uniqueUsers.size / metrics.uniqueOpens) * 100).toFixed(1) + '%' : '0%'
    })).sort((a, b) => b.total - a.total);
  }, [data.linkClicks, filteredLogs, metrics.uniqueOpens, isGlobalView, dateFilter]);

  function extractAlias(url){
    try{
      const path = new URL(url).pathname.split('/').pop();
      return path ? path.replace(/-/g, '') : 'Home / Raíz';
    }catch(e){
      return e;
    }
  }

  const timeSeriesData = useMemo(() => {
    const datesMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      datesMap[dateStr] = { date: dateStr, sent: 0, opens: 0, clicks: 0 };
    }

    if (isGlobalView) {
      (data.leads || []).filter(l => checkDate(l.created_at)).forEach(lead => {
        const date = new Date(lead.created_at.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        if (!datesMap[date]) datesMap[date] = { date, sent: 0, opens: 0, clicks: 0 };
        datesMap[date].sent += (lead.sent || 1);
        if (lead.opens > 0) datesMap[date].opens += lead.opens;
      });
      (data.linkClicks || []).filter(c => checkDate(c.created_at)).forEach(click => {
        const date = new Date(click.created_at.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        if (!datesMap[date]) datesMap[date] = { date, sent: 0, opens: 0, clicks: 0 };
        datesMap[date].clicks += 1;
      });
    } else {
      filteredLogs.forEach(log => {
        const date = new Date(log.created_at.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        if (!datesMap[date]) datesMap[date] = { date, sent: 0, opens: 0, clicks: 0 };
        
        if (log.event_type === 'sent') datesMap[date].sent += 1;
        if (log.event_type === 'open') datesMap[date].opens += 1;
        if (log.event_type === 'click') datesMap[date].clicks += 1;
      });
    }

    return Object.values(datesMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data.leads, data.linkClicks, filteredLogs, isGlobalView, dateFilter]);


  const openDetails = (type) => {
    let affectedEmails = new Set();
    let title = "";

    if (isGlobalView) {
      if (type === 'sent') {
        (data.leads || []).filter(l => checkDate(l.updated_at)).forEach(l => { if (l.sent > 0 || l.fase > 0) affectedEmails.add(l.email); });
        title = "Correos Enviados (Todos los tiempos)";
      } else if (type === 'opens') {
        (data.leads || []).filter(l => checkDate(l.updated_at)).forEach(l => { if (l.opens > 0) affectedEmails.add(l.email); });
        title = "Contactos que Abrieron (Todos los tiempos)";
      }
    } else {
      if (type === 'sent') {
        filteredLogs.filter(l => l.event_type === 'sent').forEach(l => affectedEmails.add(l.email));
        title = `Correos Enviados - ${campaignSearch}`;
      } else if (type === 'opens') {
        filteredLogs.filter(l => l.event_type === 'open').forEach(l => affectedEmails.add(l.email));
        title = `Contactos que Abrieron - ${campaignSearch}`;
      }
    }

    const filteredLeads = data.leads.filter(lead => affectedEmails.has(lead.email));
    setModalDetails({ isOpen: true, title, leads: filteredLeads });
  };


  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        
        <div className="border-b border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-blue-600 font-bold text-lg">← Panel Analítico</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Tracking Activo
            </span>
          </div>
          
          {/* NUEVOS FILTROS CON BUSCADOR DE CAMPAÑA */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            
            <div className="relative">
              <input 
                list="campaign-options"
                placeholder="🔍 Buscar campaña..."
                className="bg-white border border-gray-300 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2 w-64 text-gray-700 font-medium shadow-sm outline-none"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
              />
              <datalist id="campaign-options">
                {uniqueCampaigns.map((camp, idx) => (
                  <option key={idx} value={camp} />
                ))}
              </datalist>
            </div>

            <select 
              className="bg-white border border-gray-300 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2 text-gray-700 font-medium shadow-sm outline-none"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="Todos">📅 Todos los tiempos</option>
              <option value="7dias">Últimos 7 días</option>
              <option value="esteMes">Este mes</option>
            </select>

            <button onClick={fetchData} className="ml-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md text-sm transition">
              {loading ? '↻ Cargando...' : '↻ Actualizar'}
            </button>
          </div>
        </div>

        <div className="p-6 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>

          {/* Fila 1: KPIs (Delivery & Interactions) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4 flex justify-between">
                Delivery 
                <span onClick={() => openDetails('sent')} className="text-[#171E27] hover:text-[#D46822] text-xs cursor-pointer hover:underline">
                  View details
                </span>
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <MetricBox label="Delivery rate" value={metrics.deliveryRate} />
                <MetricBox label="Blocked" value={metrics.blocked} />
                <MetricBox label="Delivery failed" value={metrics.failed} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4 flex justify-between">
                Interactions 
                <span onClick={() => openDetails('opens')} className="text-[#171E27] text-xs hover:text-[#D46822] cursor-pointer hover:underline">
                  View details
                </span>
              </h3>
              <div className="grid grid-cols-5 gap-2">
                <MetricBox label="Open rate" value={metrics.openRate} />
                <MetricBox label="Click rate" value={metrics.clickRate} />
                <MetricBox label="Click-to-open rate" value={metrics.ctor} />
                <MetricBox label="Marked as spam" value={metrics.spam} />
                <MetricBox label="Unsubscribed" value={metrics.unsubscribed} />
              </div>
            </div>

          </div>

          {/* Fila 2: Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
            {/* Gráfico 1: Delivery trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Delivery trend</h3>
              <div className="h-40 w-full bg-white relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" axisLine={true} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 11}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="linear" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
                <MiniStat label="Sent" value={metrics.sent} color="border-blue-500" />
                <MiniStat label="Delivered" value={metrics.delivered} color="border-pink-500" />
                <MiniStat label="Unique opens" value={metrics.uniqueOpens} color="border-teal-500" />
                <MiniStat label="Unique clicks" value={metrics.uniqueClicks} color="border-gray-500" />
              </div>
            </div>

            {/* Gráfico 2: Delivery Funnel */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Delivery funnel</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 11}} width={100} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} />
                    <Bar dataKey="value" fill="#6366f1" barSize={12} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#6b7280', fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Fila 3: Heatmap & Link Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Gráfico 3: Engagement trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 flex">
              <div className="flex-1 pr-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Engagement trend</h3>
                <div className="h-40 w-full bg-white relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="linear" dataKey="opens" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      <Line type="linear" dataKey="clicks" stroke="#ec4899" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="w-24 pl-4 border-l border-gray-100 flex flex-col justify-center gap-6">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total opens</div>
                  <div className="text-2xl font-bold text-gray-900">{metrics.totalOpens}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total clicks</div>
                  <div className="text-2xl font-bold text-gray-900">{metrics.totalClicks}</div>
                </div>
              </div>
            </div>
            
            {/* Link Insights Tabla */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-600">Link insights</h3>
                <button className="text-gray-500 text-sm flex items-center gap-1">☷ Group by</button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 font-medium text-gray-500">URL</th>
                      <th className="pb-3 font-medium text-gray-500">Link alias</th>
                      <th className="pb-3 font-medium text-gray-500">Total clicks</th>
                      <th className="pb-3 font-medium text-gray-500">Unique clicks</th>
                      <th className="pb-3 font-medium text-gray-500">Click rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkInsights.map((link, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 truncate max-w-[200px] block">
                            {link.url}
                          </a>
                        </td>
                        <td className="py-3 text-gray-700">{link.alias}</td>
                        <td className="py-3 text-gray-900">{link.total}</td>
                        <td className="py-3 text-gray-900">{link.unique}</td>
                        <td className="py-3 text-gray-900">{link.rate}</td>
                      </tr>
                    ))}
                    {linkInsights.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-400">No clicks recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      </div>

      {modalDetails.isOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              
              <div className="flex justify-between items-center p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  {modalDetails.title} <span className="text-gray-500 text-sm font-normal">({modalDetails.leads.length})</span>
                </h3>
                <button 
                  onClick={() => setModalDetails({ isOpen: false, title: '', leads: [] })}
                  className="text-gray-400 hover:text-gray-700 font-bold text-xl"
                >
                  ×
                </button>
              </div>

              <div className="overflow-y-auto p-5">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium text-center">Aperturas</th>
                      <th className="pb-2 font-medium text-center">Clics</th>
                      <th className="pb-2 font-medium text-center">Efectividad (CTOR)</th>
                      <th className="pb-2 font-medium">Fase CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalDetails.leads.map((lead, idx) => {
                      const porcentaje = lead.opens > 0 
                        ? Math.min(Math.round((lead.clicks / lead.opens) * 100), 100) 
                        : 0;

                      let colorClass = "bg-gray-100 text-gray-500"; 
                      if (porcentaje >= 50) colorClass = "bg-green-100 text-green-700"; 
                      else if (porcentaje > 0) colorClass = "bg-yellow-100 text-yellow-700"; 

                      return (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 text-gray-900 font-medium">{lead.email}</td>
                          <td className="py-3 text-center text-blue-600 font-bold">{lead.opens}</td>
                          <td className="py-3 text-center text-pink-600 font-bold">{lead.clicks}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${colorClass}`}>
                              {porcentaje}%
                            </span>
                          </td>
                          <td className="py-3 text-gray-600">Fase {lead.fase}</td>
                        </tr>
                      );
                    })}
                    {modalDetails.leads.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-400">
                          No hay prospectos en esta categoría todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
      )}
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div>
      <div className="text-3xl font-light text-gray-900 mb-1">{value}</div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-tight">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className={`border-l-2 ${color} pl-2`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-tight">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default App;