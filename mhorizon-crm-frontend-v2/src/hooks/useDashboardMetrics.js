import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/api';
import { parseDate, isWithinFilter, toDayKey, formatDayLabel, formatDateTime } from '../utils/dates';

const EMPTY_MODAL = { isOpen: false, title: '', leads: [] };
const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

function extractAlias(url) {
  try {
    const path = new URL(url).pathname.split('/').pop();
    return path ? path.replace(/-/g, '') : 'Home / Raíz';
  } catch {
    return url;
  }
}

// Cuenta aperturas y clics por email a partir de los logs
function countEventsByEmail(logs) {
  const counts = new Map();
  logs.forEach(log => {
    if (log.event_type !== 'open' && log.event_type !== 'click') return;
    const entry = counts.get(log.email) || { opens: 0, clicks: 0 };
    if (log.event_type === 'open') entry.opens++;
    else entry.clicks++;
    counts.set(log.email, entry);
  });
  return counts;
}

export const useDashboardMetrics = () => {
  const [data, setData] = useState({ leads: [], linkClicks: [], emailLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('Todos');
  const [modalDetails, setModalDetails] = useState(EMPTY_MODAL);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/tracking/dashboard');
      setData({
        leads: res?.leads || [],
        linkClicks: res?.link_clicks || [],
        emailLogs: res?.email_logs || []
      });
    } catch (err) {
      console.error("Error conectando a Laravel: ", err);
      // El 401 lo maneja el interceptor de api.js (vuelve al Login)
      if (err.response?.status !== 401) setError('No se pudieron cargar las métricas. Intenta actualizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set();
    data.emailLogs.forEach(log => {
      if (log.campaign_name) campaigns.add(log.campaign_name);
    });
    return Array.from(campaigns);
  }, [data.emailLogs]);

  const checkDate = useCallback((dateStr) => isWithinFilter(parseDate(dateStr), dateFilter), [dateFilter]);

  const isGlobalView = campaignSearch.trim() === '';

  const filteredLogs = useMemo(() => {
    let logs = data.emailLogs;
    if (!isGlobalView) {
      const search = campaignSearch.trim().toLowerCase();
      logs = logs.filter(log => log.campaign_name?.toLowerCase().includes(search));
    }
    return logs.filter(log => checkDate(log.created_at));
  }, [data.emailLogs, campaignSearch, isGlobalView, checkDate]);

  const filteredLeads = useMemo(
    () => data.leads.filter(l => checkDate(l.updated_at || l.created_at)),
    [data.leads, checkDate]
  );

  const filteredClicks = useMemo(
    () => data.linkClicks.filter(c => checkDate(c.created_at)),
    [data.linkClicks, checkDate]
  );

  const metrics = useMemo(() => {
    let sent, delivered, uniqueOpens, uniqueClicks, totalOpens, totalClicks;

    if (isGlobalView) {
      sent = filteredLeads.reduce((acc, l) => acc + (l.sent || 1), 0);
      delivered = filteredLeads.reduce((acc, l) => acc + (l.delivered || 1), 0);
      uniqueOpens = filteredLeads.filter(l => l.opens > 0).length;
      uniqueClicks = filteredLeads.filter(l => l.clicks > 0).length;
      totalOpens = filteredLeads.reduce((acc, l) => acc + (l.opens || 0), 0);
      totalClicks = filteredClicks.length;
    } else {
      const openEvents = filteredLogs.filter(l => l.event_type === 'open');
      const clickEvents = filteredLogs.filter(l => l.event_type === 'click');
      sent = filteredLogs.filter(l => l.event_type === 'sent').length;
      delivered = sent;
      uniqueOpens = new Set(openEvents.map(e => e.email)).size;
      uniqueClicks = new Set(clickEvents.map(e => e.email)).size;
      totalOpens = openEvents.length;
      totalClicks = clickEvents.length;
    }

    return {
      sent, delivered, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0, totalOpens, totalClicks,
      deliveryRate: `${percent(delivered, sent)}%`,
      openRate: `${percent(uniqueOpens, delivered)}%`,
      clickRate: `${percent(uniqueClicks, delivered)}%`,
      ctor: `${percent(uniqueClicks, uniqueOpens)}%`,
    };
  }, [filteredLeads, filteredClicks, filteredLogs, isGlobalView]);

  const funnelData = useMemo(() => [
    { name: 'Email sent', value: metrics.sent },
    { name: 'Email delivered', value: metrics.delivered },
    { name: 'Unique opens', value: metrics.uniqueOpens },
    { name: 'Unique clicks', value: metrics.uniqueClicks }
  ].reverse(), [metrics]);

  const crmFunnelData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    const campaignEmails = new Set(filteredLogs.map(log => log.email));
    const relevantLeads = isGlobalView ? data.leads : data.leads.filter(lead => campaignEmails.has(lead.email));
    relevantLeads.forEach(lead => {
      if (lead.fase >= 1) counts[Math.min(lead.fase, 5) - 1]++;
    });
    const labels = ['F1 (Introducción)', 'F2 (Historias)', 'F3 (2da Opinión)', 'F4 (Membresía)', 'F5 (Seguimiento)'];
    return labels.map((name, i) => ({ name, value: counts[i] })).reverse();
  }, [data.leads, filteredLogs, isGlobalView]);

  const linkInsights = useMemo(() => {
    const urls = {};
    const sourceData = isGlobalView ? filteredClicks : filteredLogs.filter(log => log.event_type === 'click');
    sourceData.forEach(click => {
      if (!urls[click.url]) urls[click.url] = { total: 0, uniqueUsers: new Set(), alias: extractAlias(click.url) };
      urls[click.url].total += 1;
      urls[click.url].uniqueUsers.add(click.email);
    });
    return Object.entries(urls).map(([url, info]) => ({
      url, alias: info.alias, total: info.total, unique: info.uniqueUsers.size,
      rate: metrics.uniqueOpens > 0 ? ((info.uniqueUsers.size / metrics.uniqueOpens) * 100).toFixed(1) + '%' : '0%'
    })).sort((a, b) => b.total - a.total);
  }, [filteredClicks, filteredLogs, metrics.uniqueOpens, isGlobalView]);

  const deviceData = useMemo(() => {
    let mobile = 0, desktop = 0, unknown = 0;
    filteredLogs.filter(log => log.event_type === 'open' || log.event_type === 'click').forEach(log => {
      if (!log.user_agent) unknown++;
      else if (MOBILE_UA.test(log.user_agent)) mobile++;
      else desktop++;
    });
    if ((mobile + desktop + unknown) === 0) return [];
    return [
      { name: 'Móvil', value: mobile, color: '#f43f5e' }, { name: 'Escritorio', value: desktop, color: '#3b82f6' }, { name: 'Desconocido', value: unknown, color: '#94a3b8' }
    ];
  }, [filteredLogs]);

  const timeSeriesData = useMemo(() => {
    const days = {};
    const dayFor = (date) => {
      const key = toDayKey(date);
      if (!days[key]) days[key] = { key, date: formatDayLabel(date), sent: 0, opens: 0, clicks: 0 };
      return days[key];
    };

    // Siempre se muestran al menos los últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dayFor(d);
    }

    if (isGlobalView) {
      data.leads.filter(l => checkDate(l.created_at)).forEach(lead => {
        const date = parseDate(lead.created_at);
        if (!date) return;
        const day = dayFor(date);
        day.sent += (lead.sent || 1);
        day.opens += (lead.opens || 0);
      });
      filteredClicks.forEach(click => {
        const date = parseDate(click.created_at);
        if (date) dayFor(date).clicks += 1;
      });
    } else {
      filteredLogs.forEach(log => {
        const date = parseDate(log.created_at);
        if (!date) return;
        const day = dayFor(date);
        if (log.event_type === 'sent') day.sent += 1;
        if (log.event_type === 'open') day.opens += 1;
        if (log.event_type === 'click') day.clicks += 1;
      });
    }
    return Object.values(days).sort((a, b) => a.key.localeCompare(b.key));
  }, [data.leads, filteredClicks, filteredLogs, isGlobalView, checkDate]);

  const hourlyActivityData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, aperturas: 0, clics: 0 }));
    const hourOf = (value) => parseDate(value)?.getHours();

    if (isGlobalView) {
      data.leads.filter(l => checkDate(l.updated_at)).forEach(lead => {
        const h = hourOf(lead.updated_at);
        if (h !== undefined && lead.opens > 0) hours[h].aperturas += lead.opens;
      });
      filteredClicks.forEach(click => {
        const h = hourOf(click.created_at);
        if (h !== undefined) hours[h].clics += 1;
      });
    } else {
      filteredLogs.forEach(log => {
        const h = hourOf(log.created_at);
        if (h === undefined) return;
        if (log.event_type === 'open') hours[h].aperturas += 1;
        if (log.event_type === 'click') hours[h].clics += 1;
      });
    }
    return hours;
  }, [data.leads, filteredClicks, filteredLogs, isGlobalView, checkDate]);

  const campaignsSummary = useMemo(() => {
    const summary = {};
    data.emailLogs.forEach(log => {
      const campName = log.campaign_name || 'Campaña General (Sin Nombre)';
      if (!summary[campName]) {
        summary[campName] = { name: campName, sent: 0, opens: 0, clicks: 0, lastDate: null, uniqueOpens: new Set(), uniqueClicks: new Set() };
      }
      const camp = summary[campName];
      const logDate = parseDate(log.created_at);
      if (logDate && (!camp.lastDate || logDate > camp.lastDate)) camp.lastDate = logDate;
      if (log.event_type === 'sent') camp.sent++;
      if (log.event_type === 'open') { camp.opens++; camp.uniqueOpens.add(log.email); }
      if (log.event_type === 'click') { camp.clicks++; camp.uniqueClicks.add(log.email); }
    });

    return Object.values(summary).map(camp => {
      const delivered = camp.sent;
      const openRate = delivered > 0 ? ((camp.uniqueOpens.size / delivered) * 100).toFixed(1) : 0;
      const clickRate = delivered > 0 ? ((camp.uniqueClicks.size / delivered) * 100).toFixed(1) : 0;
      return { ...camp, openRate, clickRate, dateStr: formatDateTime(camp.lastDate) };
    }).sort((a, b) => (b.lastDate?.getTime() || 0) - (a.lastDate?.getTime() || 0));
  }, [data.emailLogs]);

  const openDetails = useCallback((type) => {
    const affectedEmails = new Set();
    let title = "";

    if (isGlobalView) {
      const leads = data.leads.filter(l => checkDate(l.updated_at));
      if (type === 'sent') {
        leads.forEach(l => { if (l.sent > 0 || l.fase > 0) affectedEmails.add(l.email); });
        title = "Correos Enviados (Todos los tiempos)";
      } else if (type === 'opens') {
        leads.forEach(l => { if (l.opens > 0) affectedEmails.add(l.email); });
        title = "Contactos que Abrieron (Todos los tiempos)";
      }
    } else {
      const eventType = type === 'sent' ? 'sent' : 'open';
      filteredLogs.filter(l => l.event_type === eventType).forEach(l => affectedEmails.add(l.email));
      title = `${type === 'sent' ? 'Correos Enviados' : 'Contactos que Abrieron'} - ${campaignSearch}`;
    }

    const counts = isGlobalView ? null : countEventsByEmail(filteredLogs);
    const computedLeads = data.leads
      .filter(lead => affectedEmails.has(lead.email))
      .map(lead => {
        if (isGlobalView) return { ...lead, displayOpens: lead.opens || 0, displayClicks: lead.clicks || 0 };
        const c = counts.get(lead.email) || { opens: 0, clicks: 0 };
        return { ...lead, displayOpens: c.opens, displayClicks: c.clicks };
      })
      .sort((a, b) => b.displayClicks - a.displayClicks || b.displayOpens - a.displayOpens);

    setModalDetails({ isOpen: true, title, leads: computedLeads });
  }, [data.leads, isGlobalView, filteredLogs, campaignSearch, checkDate]);

  const closeDetails = useCallback(() => setModalDetails(EMPTY_MODAL), []);

  return {
    loading, error, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    uniqueCampaigns, filteredLogs, isGlobalView, metrics, funnelData, crmFunnelData, linkInsights, deviceData,
    timeSeriesData, hourlyActivityData, campaignsSummary,
    modalDetails, openDetails, closeDetails
  };
};
