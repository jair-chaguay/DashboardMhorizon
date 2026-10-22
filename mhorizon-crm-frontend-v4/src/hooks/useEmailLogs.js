import { useEffect, useState } from 'react';
import api from '../api/api';

// Registros de envío, aperturas y clics. Solo se piden cuando enabled es true y se guardan hasta salir de la página
export function useEmailLogs(enabled) {
  const [logs, setLogs] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || logs !== null) return undefined;
    let alive = true;
    api.get('/tracking/dashboard')
      .then(({ data }) => { if (alive) setLogs(data?.email_logs || []); })
      .catch((error) => { console.error('Error al cargar el historial', error); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [enabled, logs]);

  return { logs: logs || [], loading: enabled && logs === null && !failed, failed };
}
