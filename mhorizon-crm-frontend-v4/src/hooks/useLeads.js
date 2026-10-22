import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/api';
import { uniqueTags } from '../utils/tags';

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const response = await api.get('/leads');
      setLeads(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (error) {
      console.error('Error al cargar leads', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads();
  }, [fetchLeads]);

  const tags = useMemo(() => uniqueTags(leads), [leads]);

  return { leads, loading, fetchLeads, tags };
}
