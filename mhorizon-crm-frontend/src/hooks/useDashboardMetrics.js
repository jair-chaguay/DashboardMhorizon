import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/api';

export const useDashboardMetrics = (isAuthenticated, onUnauthorized) => {
  const [data, setData] = useState({ leads: [], linkClicks: [], emailLogs: [] });
  const [loading, setLoading] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('Todos');
  const [modalDetails, setModalDetails] = useState({ isOpen: false, title: '', leads: [] });

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
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
      if (error.response && error.response.status === 401) {
        if (onUnauthorized) onUnauthorized(); // Llamamos al logout si falla el token
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, onUnauthorized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set();
    (data.emailLogs || []).forEach(log => {
      if (log.campaign_name) campaigns.add(log.campaign_name);
    });
    return Array.from(campaigns);
  }, [data.emailLogs]);

  const checkDate = useCallback((dateStr) => {
    if (dateFilter === 'Todos') return true;
    if (!dateStr) return false;
    const logDate = new Date(dateStr.replace(/-/g, '/'));
    const now = new Date();
    if (dateFilter === '7dias') return (now - logDate) <= 7 * 24 * 60 * 60 * 1000;
    if (dateFilter === 'esteMes') return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
    return true;
  }, [dateFilter]);

  const filteredLogs = useMemo(() => {
    let logs = data.emailLogs || [];
    if (campaignSearch.trim() !== '') {
      logs = logs.filter(log => log.campaign_name?.toLowerCase().includes(campaignSearch.toLowerCase()));
    }
    return logs.filter(log => checkDate(log.created_at));
  }, [data.emailLogs, campaignSearch, checkDate]);

  const isGlobalView = campaignSearch.trim() === '';

  const metrics = useMemo(() => {
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

      return { sent, delivered, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0, totalOpens, totalClicks, deliveryRate: `${deliveryRate}%`, openRate: `${openRate}%`, clickRate: `${clickRate}%`, ctor: `${ctor}%` };
    }

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

    return { sent, delivered: sent, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0, totalOpens: openEvents.length, totalClicks: clickEvents.length, deliveryRate: `${deliveryRate}%`, openRate: `${openRate}%`, clickRate: `${clickRate}%`, ctor: `${ctor}%` };
  }, [data.leads, data.linkClicks, filteredLogs, isGlobalView, checkDate]);

  const funnelData = [
    {name: 'Email sent', value: metrics.sent},
    {name: 'Email delivered', value: metrics.delivered},
    {name: 'Unique opens', value: metrics.uniqueOpens},
    {name: 'Unique clicks', value: metrics.uniqueClicks}
  ].reverse();

  const crmFunnelData = useMemo(() => {
    let f1 = 0, f2 = 0, f3 = 0, f4 = 0, f5 = 0;
    const relevantLeads = isGlobalView ? (data.leads || []) : (data.leads || []).filter(lead => filteredLogs.some(log => log.email === lead.email));
    relevantLeads.forEach(lead => {
      if (lead.fase === 1) f1++;
      else if (lead.fase === 2) f2++;
      else if (lead.fase === 3) f3++;
      else if (lead.fase === 4) f4++;
      else if (lead.fase >= 5) f5++;
    });
    return [
      {name: 'F1 (Introducción)', value: f1}, {name: 'F2 (Historias)', value: f2}, {name: 'F3 (2da Opinión)', value: f3}, {name: 'F4 (Membresía)', value: f4}, {name: 'F5 (Seguimiento)', value: f5}
    ].reverse();
  }, [data.leads, filteredLogs, isGlobalView]);

  function extractAlias(url){
    try{
      const path = new URL(url).pathname.split('/').pop();
      return path ? path.replace(/-/g, '') : 'Home / Raíz';
    }catch(e){ return e; }
  }

  const linkInsights = useMemo(() => {
    const urls = {};
    const sourceData = isGlobalView ? (data.linkClicks || []).filter(c => checkDate(c.created_at)) : filteredLogs.filter(log => log.event_type === 'click');
    sourceData.forEach(click => {
      if (!urls[click.url]) urls[click.url] = { total: 0, uniqueUsers: new Set(), alias: extractAlias(click.url) };
      urls[click.url].total += 1;
      urls[click.url].uniqueUsers.add(click.email);
    });
    return Object.entries(urls).map(([url, info]) => ({
      url, alias: info.alias, total: info.total, unique: info.uniqueUsers.size,
      rate: metrics.uniqueOpens > 0 ? ((info.uniqueUsers.size / metrics.uniqueOpens) * 100).toFixed(1) + '%' : '0%'
    })).sort((a, b) => b.total - a.total);
  }, [data.linkClicks, filteredLogs, metrics.uniqueOpens, isGlobalView, checkDate]);

  const deviceData = useMemo(() => {
    let mobile = 0, desktop = 0, unknown = 0;
    filteredLogs.filter(log => log.event_type === 'open' || log.event_type === 'click').forEach(log => {
      if(!log.user_agent) { unknown++; return; }
      if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(log.user_agent.toLowerCase())) mobile++;
      else desktop++;
    });
    if ((mobile + desktop + unknown) === 0) return [];
    return [
      {name: 'Móvil', value:mobile, color: '#f43f5e'}, {name: 'Escritorio', value: desktop, color: '#3b82f6'}, {name: 'Desconocido', value: unknown, color: '#94a3b8'}
    ];
  }, [filteredLogs]);

  const timeSeriesData = useMemo(() => {
    const datesMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      datesMap[d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })] = { date: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), sent: 0, opens: 0, clicks: 0 };
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
  }, [data.leads, data.linkClicks, filteredLogs, isGlobalView, checkDate]);

  const hourlyActivityData = useMemo (() => {
    const hours = Array.from({length: 24}, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, aperturas: 0, clics: 0 }));
    if(isGlobalView){
      (data.leads || []).filter(l => checkDate(l.updated_at)).forEach(lead => {
        if(lead.updated_at && lead.opens > 0) hours[new Date(lead.updated_at.replace(/-/g, '/')).getHours()].aperturas += lead.opens;
      });
      (data.linkClicks || []).filter(c => checkDate(c.created_at)).forEach(click => {
        if(click.created_at) hours[new Date(click.created_at.replace(/-/g, '/')).getHours()].clics += 1;
      });
    } else {
      filteredLogs.forEach(log => {
        if(log.created_at && (log.event_type === 'open' || log.event_type === 'click')){
          const h = new Date(log.created_at.replace(/-/g, '/')).getHours();
          if(log.event_type === 'open') hours[h].aperturas +=1;
          if(log.event_type === 'click') hours[h].clics +=1;
        }
      });
    }
    return hours;
  }, [data.leads, data.linkClicks, filteredLogs, isGlobalView, checkDate]);

  const campaignsSummary = useMemo(() => {
    const summary = {};
    (data.emailLogs || []).forEach(log => {
      const campName = log.campaign_name || 'Campaña General (Sin Nombre)';
      if (!summary[campName]) {
        summary[campName] = { 
          name: campName, sent: 0, opens: 0, clicks: 0, lastDate: null, uniqueOpens: new Set(), uniqueClicks: new Set() 
        };
      }
      const logDate = new Date(log.created_at.replace(/-/g, '/'));
      if (!summary[campName].lastDate || logDate > summary[campName].lastDate) {
        summary[campName].lastDate = logDate;
      }
      if (log.event_type === 'sent') summary[campName].sent++;
      if (log.event_type === 'open') { summary[campName].opens++; summary[campName].uniqueOpens.add(log.email); }
      if (log.event_type === 'click') { summary[campName].clicks++; summary[campName].uniqueClicks.add(log.email); }
    });

    return Object.values(summary).map(camp => {
      const delivered = camp.sent; 
      const openRate = delivered > 0 ? ((camp.uniqueOpens.size / delivered) * 100).toFixed(1) : 0;
      const clickRate = delivered > 0 ? ((camp.uniqueClicks.size / delivered) * 100).toFixed(1) : 0;
      const dateOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      const formattedDate = camp.lastDate ? camp.lastDate.toLocaleDateString('es-ES', dateOptions) : 'Fecha desconocida';

      return { ...camp, openRate, clickRate, dateStr: formattedDate };
    }).sort((a, b) => b.lastDate - a.lastDate); 
  }, [data.emailLogs]);

  // Lógica de apertura del Modal (Devuelta al hook donde puede acceder a `data` de forma segura)
  const openDetails = useCallback((type) => {
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

    const computedLeads = [];
    (data.leads || []).forEach(lead => {
      if(affectedEmails.has(lead.email)){
        if(isGlobalView){
          computedLeads.push({ ...lead, displayOpens: lead.opens || 0, displayClicks: lead.clicks || 0 });
        } else {
          const userLogs = filteredLogs.filter(log => log.email === lead.email);
          computedLeads.push({ 
            ...lead, 
            displayOpens: userLogs.filter(log => log.event_type === 'open').length, 
            displayClicks: userLogs.filter(log => log.event_type === 'click').length 
          });
        }
      }
    });
    computedLeads.sort((a,b) => b.displayClicks - a.displayClicks || b.displayOpens - a.displayOpens);
    setModalDetails({ isOpen: true, title, leads: computedLeads });
  }, [data.leads, isGlobalView, filteredLogs, campaignSearch, checkDate]);

  return {
    loading, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    uniqueCampaigns, filteredLogs, isGlobalView, metrics, funnelData, crmFunnelData, linkInsights, deviceData, 
    timeSeriesData, hourlyActivityData, campaignsSummary,
    modalDetails, setModalDetails, openDetails
  };
};