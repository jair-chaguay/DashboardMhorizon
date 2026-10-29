import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/api';
import { parseDate, isWithinFilter, toDayKey, formatDayLabel, formatDateTime } from '../utils/dates';
import { summarizeDeliverability } from '../utils/deliverability';
import { isReplied } from '../utils/status';

const EMPTY_MODAL = { isOpen: false, title: '', leads: [] };
const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

const UNNAMED_CAMPAIGN = 'Campaña General (Sin Nombre)';
const campaignName = (log) => log.campaign_name || UNNAMED_CAMPAIGN;

const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

export function extractAlias(url) {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (!path) return 'Página de inicio';
    const text = decodeURIComponent(path).replace(/[-_]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
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

export const useDashboardMetrics = (initialCampaign = '', initialPeriod = 'Todos') => {
  const [data, setData] = useState({ leads: [], linkClicks: [], emailLogs: [], campaignAliases: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaignSearch, setCampaignSearch] = useState(initialCampaign);
  const [dateFilter, setDateFilter] = useState(initialPeriod);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [modalDetails, setModalDetails] = useState(EMPTY_MODAL);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/tracking/dashboard');
      setLastUpdated(new Date());
      setData({
        leads: res?.leads || [],
        linkClicks: res?.link_clicks || [],
        emailLogs: res?.email_logs || [],
        campaignAliases: res?.campaign_aliases || {}
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
    data.emailLogs.forEach(log => campaigns.add(campaignName(log)));
    return Array.from(campaigns);
  }, [data.emailLogs]);

  const checkDate = useCallback((dateStr) => isWithinFilter(parseDate(dateStr), dateFilter), [dateFilter]);

  const isGlobalView = campaignSearch.trim() === '';

  const filteredLogs = useMemo(() => {
    let logs = data.emailLogs;
    if (!isGlobalView) {
      const selected = campaignSearch.trim();
      logs = logs.filter(log => campaignName(log) === selected);
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

  // Rebotes, bajas y spam del periodo (y campaña) elegidos
  const deliverability = useMemo(() => summarizeDeliverability(filteredLogs), [filteredLogs]);

  const metrics = useMemo(() => {
    let sent, delivered, uniqueOpens, uniqueClicks, totalOpens, totalClicks;

    if (isGlobalView) {
      sent = filteredLeads.reduce((acc, l) => acc + (l.sent || 1), 0);
      delivered = Math.max(filteredLeads.reduce((acc, l) => acc + (l.delivered || 1), 0) - deliverability.bounces, 0);
      uniqueOpens = filteredLeads.filter(l => l.opens > 0).length;
      uniqueClicks = filteredLeads.filter(l => l.clicks > 0).length;
      totalOpens = filteredLeads.reduce((acc, l) => acc + (l.opens || 0), 0);
      totalClicks = filteredClicks.length;
    } else {
      const openEvents = filteredLogs.filter(l => l.event_type === 'open');
      const clickEvents = filteredLogs.filter(l => l.event_type === 'click');
      sent = filteredLogs.filter(l => l.event_type === 'sent').length;
      delivered = Math.max(sent - deliverability.bounces, 0);
      uniqueOpens = new Set(openEvents.map(e => e.email)).size;
      uniqueClicks = new Set(clickEvents.map(e => e.email)).size;
      totalOpens = openEvents.length;
      totalClicks = clickEvents.length;
    }

    // Respondieron: prospectos de la vista cuyo estado en el CRM es "Respondió"
    const audience = isGlobalView ? filteredLeads : (() => {
      const emails = new Set(filteredLogs.filter(l => l.event_type === 'sent').map(l => l.email));
      return data.leads.filter(l => emails.has(l.email));
    })();
    const replied = audience.filter(l => isReplied(l.status)).length;

    return {
      replied, replyBase: audience.length, replyRate: `${percent(replied, audience.length)}%`,
      sent, delivered, blocked: 0, failed: 0, uniqueOpens, uniqueClicks, spam: 0, unsubscribed: 0, totalOpens, totalClicks,
      deliveryRate: `${percent(delivered, sent)}%`,
      openRate: `${percent(uniqueOpens, delivered)}%`,
      clickRate: `${percent(uniqueClicks, delivered)}%`,
      ctor: `${percent(uniqueClicks, uniqueOpens)}%`,
    };
  }, [data.leads, filteredLeads, filteredClicks, filteredLogs, isGlobalView, deliverability]);

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

  const deviceBreakdown = useMemo(() => {
    const groups = { 'Móvil': { aperturas: 0, clics: 0 }, 'Escritorio': { aperturas: 0, clics: 0 }, 'Desconocido': { aperturas: 0, clics: 0 } };
    filteredLogs.forEach(log => {
      if (log.event_type !== 'open' && log.event_type !== 'click') return;
      const group = !log.user_agent ? 'Desconocido' : MOBILE_UA.test(log.user_agent) ? 'Móvil' : 'Escritorio';
      groups[group][log.event_type === 'open' ? 'aperturas' : 'clics']++;
    });
    return Object.entries(groups).map(([name, v]) => ({ name, ...v }));
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
    // Rellena los días sin actividad para que la línea no una puntos lejanos
    const keys = Object.keys(days).sort();
    const cursor = new Date(`${keys[0]}T00:00:00`);
    const end = new Date(`${keys[keys.length - 1]}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today > end) end.setTime(today.getTime());
    const filled = [];
    while (cursor <= end) {
      const key = toDayKey(cursor);
      filled.push(days[key] || { key, date: formatDayLabel(cursor), sent: 0, opens: 0, clicks: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return filled.slice(-90);
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
    const leadByEmail = new Map(data.leads.map(l => [l.email, l]));
    data.emailLogs.forEach(log => {
      const campName = campaignName(log);
      if (!summary[campName]) {
        summary[campName] = { name: campName, subject: '', sent: 0, opens: 0, clicks: 0, lastDate: null, uniqueOpens: new Set(), uniqueClicks: new Set(), recipients: new Set(), logs: [] };
      }
      const camp = summary[campName];
      const logDate = parseDate(log.created_at);
      if (logDate && (!camp.lastDate || logDate > camp.lastDate)) camp.lastDate = logDate;
      camp.logs.push(log);
      if (log.event_type === 'sent') { camp.sent++; camp.recipients.add(log.email); if (!camp.subject && log.subject) camp.subject = log.subject; }
      if (log.event_type === 'open') { camp.opens++; camp.uniqueOpens.add(log.email); }
      if (log.event_type === 'click') { camp.clicks++; camp.uniqueClicks.add(log.email); }
    });

    return Object.values(summary).map(({ logs, ...camp }) => {
      const d = summarizeDeliverability(logs);
      const delivered = Math.max(camp.sent - d.bounces, 0);
      const openRate = delivered > 0 ? ((camp.uniqueOpens.size / delivered) * 100).toFixed(1) : 0;
      const clickRate = delivered > 0 ? ((camp.uniqueClicks.size / delivered) * 100).toFixed(1) : 0;
      const ctor = camp.uniqueOpens.size > 0 ? ((camp.uniqueClicks.size / camp.uniqueOpens.size) * 100).toFixed(1) : 0;
      return {
        ...camp, alias: data.campaignAliases[camp.name] || '', openRate, clickRate, ctor, dateStr: formatDateTime(camp.lastDate),
        delivered, bounces: d.bounces, hardBounces: d.hard.size + d.unknown.size, softBounces: d.soft.size, hasBounceTypes: d.hasBounceTypes,
        unsubscribed: d.unsub.size, spam: d.spam.size,
        openCount: camp.uniqueOpens.size, clickCount: camp.uniqueClicks.size,
        replies: [...camp.recipients].filter(e => isReplied(leadByEmail.get(e)?.status)).length,
      };
    }).sort((a, b) => (b.lastDate?.getTime() || 0) - (a.lastDate?.getTime() || 0));
  }, [data.emailLogs, data.leads, data.campaignAliases]);

  // Nombre provisional de una campaña (vacío lo quita). campaign_name no cambia
  const saveCampaignAlias = useCallback(async (name, alias) => {
    const { data: res } = await api.post('/campaign/alias', { campaign_name: name, alias });
    setData(prev => {
      const campaignAliases = { ...prev.campaignAliases };
      if (res?.alias) campaignAliases[name] = res.alias;
      else delete campaignAliases[name];
      return { ...prev, campaignAliases };
    });
  }, []);

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
      } else if (type === 'clicks') {
        leads.forEach(l => { if (l.clicks > 0) affectedEmails.add(l.email); });
        title = "Contactos que Hicieron Clic (Todos los tiempos)";
      } else if (type === 'replied') {
        leads.forEach(l => { if (isReplied(l.status)) affectedEmails.add(l.email); });
        title = "Contactos que Respondieron (Todos los tiempos)";
      }
    } else {
      const eventType = { sent: 'sent', opens: 'open', clicks: 'click', replied: 'sent' }[type];
      const label = { sent: 'Destinatarios', opens: 'Contactos que Abrieron', clicks: 'Contactos que Hicieron Clic', replied: 'Contactos que Respondieron' }[type];
      const byStatus = type === 'replied';
      const statusByEmail = new Map(data.leads.map(l => [l.email, l.status]));
      filteredLogs.filter(l => l.event_type === eventType).forEach(l => {
        if (!byStatus || isReplied(statusByEmail.get(l.email))) affectedEmails.add(l.email);
      });
      title = `${label} - ${campaignSearch}`;
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

  // Prospectos con más clics (y, a igual clics, más aperturas) dentro de la vista actual
  const hotLeads = useMemo(() => {
    const counts = isGlobalView ? null : countEventsByEmail(filteredLogs);
    return (isGlobalView ? filteredLeads : data.leads)
      .map(lead => {
        const c = isGlobalView ? { opens: lead.opens || 0, clicks: lead.clicks || 0 } : (counts.get(lead.email) || { opens: 0, clicks: 0 });
        return { ...lead, displayOpens: c.opens, displayClicks: c.clicks };
      })
      .filter(lead => lead.displayClicks > 0)
      .sort((a, b) => b.displayClicks - a.displayClicks || b.displayOpens - a.displayOpens)
      .slice(0, 8);
  }, [data.leads, filteredLeads, filteredLogs, isGlobalView]);

  // Últimos movimientos: los envíos de una misma campaña y día se juntan en una sola línea
  const recentEvents = useMemo(() => {
    const sentGroups = new Map();
    const events = [];
    filteredLogs.forEach(log => {
      const date = parseDate(log.created_at);
      if (!date) return;
      if (log.event_type === 'sent') {
        const key = `${campaignName(log)}|${toDayKey(date)}`;
        const group = sentGroups.get(key) || { type: 'sent', campaign: campaignName(log), count: 0, date };
        group.count++;
        if (date > group.date) group.date = date;
        sentGroups.set(key, group);
      } else if (log.event_type === 'open' || log.event_type === 'click') {
        events.push({ type: log.event_type, email: log.email, campaign: campaignName(log), date });
      }
    });
    return [...events, ...sentGroups.values()].sort((a, b) => b.date - a.date).slice(0, 8);
  }, [filteredLogs]);

  const closeDetails = useCallback(() => setModalDetails(EMPTY_MODAL), []);

  return {
    leads: data.leads, loading, error, lastUpdated, fetchData, campaignSearch, setCampaignSearch, dateFilter, setDateFilter,
    uniqueCampaigns, filteredLogs, deliverability, isGlobalView, metrics, funnelData, crmFunnelData, linkInsights, deviceBreakdown,
    timeSeriesData, hourlyActivityData, campaignsSummary, saveCampaignAlias, hotLeads, recentEvents,
    modalDetails, openDetails, closeDetails
  };
};
