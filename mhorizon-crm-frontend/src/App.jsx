/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect,useCallback,  useMemo } from 'react';
import { Mail, Eye, MousePointerClick, AlertTriangle, Users, Download } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import api from './../api/api'

function App() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/leads'); 
      console.log("Respuesta de Laravel:", response.data);
      
      if (Array.isArray(response.data)) {
        setLeads(response.data); // Si es un array directo [...]
      } 
      else if (response.data && Array.isArray(response.data.data)) {
        setLeads(response.data.data); // Si Laravel lo envolvió en { data: [...] }
      } 
      else {
        console.error("Laravel no devolvió una lista válida:", response.data);
        setLeads([]); // Forzamos un array vacío para que React no explote
      }

      
    } catch (error) {
      console.error("❌ Error conectando a Laravel:", error);
      
      if (error.response && error.response.status === 401) {
          console.error("No autorizado. Redirigir a login...");
      }
      setLeads([]); 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

   const handleSincronizar = async () => {
    await fetchLeads();
  };

  // --- DATOS MATEMÁTICOS Y MOCKUP VISUAL ---
  // --- PUENTE MATEMÁTICO REAL (DATOS DINÁMICOS DESDE LARAVEL) ---
  
  // 1. Cálculos de Totales y Tasas para los KPIs
  const totales = useMemo(() => {
    if (!leads || leads.length === 0) return { aperturas: 0, clics: 0, total: 0, rebotes: 0, tasaApertura: '0%', tasaClics: '0%' };
    
    const aperturas = leads.reduce((acc, lead) => acc + lead.opens, 0);
    const clics = leads.reduce((acc, lead) => acc + lead.clicks, 0);
    const total = leads.length;
    
    // Si un prospecto tiene estado "Rebote" (por si lo implementas luego)
    const rebotes = leads.filter(l => l.status && l.status.toLowerCase().includes('rebote')).length;
    
    // Cálculo de tasas (Porcentaje sobre el total de prospectos)
    const prospectosQueAbrieron = leads.filter(l => l.opens > 0).length;
    const prospectosQueClicaron = leads.filter(l => l.clicks > 0).length;
    
    const tasaApertura = total > 0 ? Math.round((prospectosQueAbrieron / total) * 100) + '%' : '0%';
    const tasaClics = prospectosQueAbrieron > 0 ? Math.round((prospectosQueClicaron / prospectosQueAbrieron) * 100) + '%' : '0%'; // CTOR

    return { aperturas, clics, total, rebotes, tasaApertura, tasaClics };
  }, [leads]);


  // 2. Lógica para el Anillo (Distribución CRM Dinámica)
  const donutData = useMemo(() => {
    let superEngaged = 0; // Interactúan mucho (Clics)
    let lectores = 0;     // Solo abren (Aperturas > 0 pero 0 clics)
    let enRiesgo = 0;     // Fase avanzada pero no han abierto, o fase baja
    let inactivos = 0;    // 0 interacción total

    leads.forEach(lead => {
      if (lead.clicks > 0) {
        superEngaged++;
      } else if (lead.opens > 0) {
        lectores++;
      } else if (lead.fase > 2 && lead.opens === 0) {
        enRiesgo++;
      } else {
        inactivos++;
      }
    });

    const totalClasificados = superEngaged + lectores + enRiesgo + inactivos || 1; // Evitar dividir por cero

    return [
      { name: 'Super Engaged', value: superEngaged, perc: Math.round((superEngaged / totalClasificados) * 100) },
      { name: 'Lectores', value: lectores, perc: Math.round((lectores / totalClasificados) * 100) },
      { name: 'En Riesgo', value: enRiesgo, perc: Math.round((enRiesgo / totalClasificados) * 100) },
      { name: 'Inactivos', value: inactivos, perc: Math.round((inactivos / totalClasificados) * 100) },
    ];
  }, [leads]);


  // 3. Lógica para la Curva de Área (Agrupando por Hora del Día)
  const datosTiempoReal = useMemo(() => {
    // Esqueleto de franjas horarias
    const franjas = {
      "00:00": { time: "00:00", opens: 0, clicks: 0 },
      "04:00": { time: "04:00", opens: 0, clicks: 0 },
      "08:00": { time: "08:00", opens: 0, clicks: 0 },
      "12:00": { time: "12:00", opens: 0, clicks: 0 },
      "16:00": { time: "16:00", opens: 0, clicks: 0 },
      "20:00": { time: "20:00", opens: 0, clicks: 0 },
      "23:59": { time: "23:59", opens: 0, clicks: 0 },
    };

    leads.forEach(lead => {
      // Usamos el campo updated_at de Laravel para saber a qué hora interactuó
      if (lead.updated_at && (lead.opens > 0 || lead.clicks > 0)) {
        const date = new Date(lead.updated_at);
        const hour = date.getHours();

        // Agrupamos en el bloque horario correspondiente
        let key = "00:00";
        if (hour >= 4 && hour < 8) key = "04:00";
        else if (hour >= 8 && hour < 12) key = "08:00";
        else if (hour >= 12 && hour < 16) key = "12:00";
        else if (hour >= 16 && hour < 20) key = "16:00";
        else if (hour >= 20 && hour <= 23) key = "20:00";

        // Sumamos el volumen para levantar la gráfica
        franjas[key].opens += lead.opens;
        franjas[key].clicks += lead.clicks;
      }
    });

    return Object.values(franjas);
  }, [leads]);

  const COLORES_PIE = ['#06b6d4', '#6366f1', '#eab308', '#ef4444'];

  return (
    <div className="min-h-screen bg-[#171E27] text-slate-300 p-6 font-sans selection:bg-cyan-900">
      <div className="max-w-[1400px] mx-auto w-full">
        
        {/* Cabecera Tipo Centro de Mando */}
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
           
            <h1 className="text-3xl font-bold text-white tracking-tight">Monitoreo de Telemetría y<br/>Clasificación CRM</h1>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <div className="flex bg-[#1E293B] rounded-lg p-1 text-sm font-medium">
              <button className="px-4 py-1.5 bg-slate-700 text-white rounded-md shadow">Últimas 24h</button>
              <button className="px-4 py-1.5 text-slate-400 hover:text-white transition">7 días</button>
              <button className="px-4 py-1.5 text-slate-400 hover:text-white transition">30 días</button>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleSincronizar}
                disabled={loading}
                className="flex items-center gap-2 bg-[#1E293B] hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                <Download size={16} /> {loading ? 'Actualizando...' : 'Sincronizar'}
              </button>
            </div>
          </div>
        </header>

        {/* Tarjetas KPI Superiores (5 columnas) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KPICard title="Prospectos Totales" icon={<Users size={20} className="text-cyan-400"/>} value={totales.total} subval="En Base" color="text-cyan-400" />
          <KPICard title="Tasa de Apertura" icon={<Eye size={20} className="text-emerald-400"/>} value={totales.tasaApertura} subval={`Vistos: ${totales.aperturas}`} color="text-emerald-400" />
          <KPICard title="Tasa de Clics (CTOR)" icon={<MousePointerClick size={20} className="text-indigo-400"/>} value={totales.tasaClics} subval={`Clics: ${totales.clics}`} color="text-indigo-400" />
          <KPICard title="Rebotes" icon={<AlertTriangle size={20} className="text-rose-400"/>} value={totales.rebotes} subval="Limpieza" color="text-rose-400" />
          <KPICard title="Emails Interactuados" icon={<Mail size={20} className="text-cyan-400"/>} value={totales.aperturas + totales.clics} subval="Telemetría" color="text-cyan-400" />
        </div>

        {/* Sección Central: Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Gráfico 1: Curva de Área (Ocupa 2/3) */}
          <div className="lg:col-span-2 bg-[#162032] border border-slate-800 p-6 rounded-xl shadow-lg relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Curva de Aperturas vs. Clics</h3>
                <p className="text-xs text-slate-400 mt-1">Dispersión por micro-lotes de entrega (Webhook Mandrill)</p>
              </div>
              <div className="flex gap-2 text-xs font-bold bg-[#0B1120] p-1 rounded-md">
                <span className="px-3 py-1 bg-cyan-900/50 text-cyan-400 rounded">Aperturas</span>
                <span className="px-3 py-1 text-slate-400">Clics</span>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosTiempoReal} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10}/>
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px' }}
                    itemStyle={{ color: '#F8FAFC' }}
                  />
                  <Area type="monotone" dataKey="opens" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorOpens)" />
                  <Area type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorClicks)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Mapa de calor simulado (Horarios Pico) */}
            <div className="mt-4 bg-[#0B1120] rounded-lg p-3 border border-slate-800 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 w-24">
                <Mail size={14}/> Horarios Pico
              </span>
              <div className="flex-1 flex h-4 rounded overflow-hidden opacity-80 gap-[1px]">
                <div className="bg-cyan-950 w-1/6"></div>
                <div className="bg-cyan-900 w-1/6"></div>
                <div className="bg-cyan-800 w-1/6"></div>
                <div className="bg-cyan-600 w-1/6"></div>
                <div className="bg-cyan-400 w-1/6"></div>
                <div className="bg-cyan-900 w-1/6"></div>
              </div>
            </div>
          </div>

          {/* Gráfico 2: Distribución (Ocupa 1/3) */}
          <div className="bg-[#162032] border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col">
            <h3 className="text-lg font-bold text-white mb-1">Distribución de Usuarios</h3>
            <p className="text-xs text-slate-400 mb-6">Segmentos dinámicos computados</p>
            
            <div className="flex-1 relative min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} innerRadius="70%" outerRadius="90%" paddingAngle={2} dataKey="value" stroke="none">
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px' }}/>
                </PieChart>
              </ResponsiveContainer>
              {/* Texto en el centro del Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
                <span className="text-2xl font-bold text-white">{totales.total > 0 ? totales.total : "0"}</span>
                <span className="text-xs text-slate-400">Perfiles CRM</span>
              </div>
            </div>

            {/* Leyenda personalizada debajo del Donut */}
            {/* Leyenda personalizada debajo del Donut */}
            <div className="mt-4 space-y-2">
              {donutData.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORES_PIE[i] }}></span>
                    <span className="text-slate-300 font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400">{item.perc}%</span>
                    <span className="text-xs text-slate-500">({item.value})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Tabla Inferior con Tema Oscuro */}
        <div className="bg-[#162032] border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-[#1E293B]/50">
            <h2 className="text-lg font-bold text-white">Detalle Operativo del CRM</h2>
            {loading && <span className="text-xs text-cyan-400 font-bold animate-pulse">Syncing...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B1120] text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Email del Prospecto</th>
                  <th className="px-6 py-4 font-semibold">Fase Actual</th>
                  <th className="px-6 py-4 font-semibold text-center">Aperturas</th>
                  <th className="px-6 py-4 font-semibold text-center">Clics</th>
                  <th className="px-6 py-4 font-semibold">Estado Telemetría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {leads.length === 0 && !loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                      Modo Escucha Activo. Esperando recepción de Webhooks...
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#1E293B]/40 transition duration-200">
                      <td className="px-6 py-4 text-sm font-medium text-slate-200">{lead.email}</td>
                      <td className="px-6 py-4">
                        <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 py-1 px-3 rounded text-xs font-bold">
                          Fase {lead.fase}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-cyan-400">{lead.opens > 0 ? lead.opens : '-'}</td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-purple-400">{lead.clicks > 0 ? lead.clicks : '-'}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-400 flex items-center gap-2">
                        {lead.opens > 0 ? <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>}
                        {lead.status || 'Registrado'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// Componente reutilizable para las 5 tarjetas de arriba
function KPICard({ title, icon, value, subval, color }) {
  return (
    <div className="bg-[#162032] border border-slate-800 p-5 rounded-xl shadow flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <h4 className="text-3xl font-bold text-white">{value}</h4>
          <span className={`text-xs font-bold ${color}`}>{subval}</span>
        </div>
        <div className="w-full bg-slate-800 h-1 mt-3 rounded overflow-hidden">
          <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{width: '65%'}}></div>
        </div>
      </div>
    </div>
  );
}

export default App;