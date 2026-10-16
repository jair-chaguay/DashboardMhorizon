# mhorizon-crm-frontend-v2: cambios respecto al original

Copia de `mhorizon-crm-frontend` con el mismo estilo visual. La carpeta original no se tocó.
Se usa igual: `npm install`, `npm run dev`. Para apuntar a un backend local, crear `.env.local` con
`VITE_API_URL=http://127.0.0.1:8000/api`.

## Errores corregidos
- **Sesión expirada:** antes el Dashboard recargaba la página con el token vencido aún guardado (no volvía al login) y las demás páginas ignoraban el 401. Ahora `api.js` detecta cualquier 401, borra la sesión y regresa al Login.
- **Reporte global se rompía** si algún lead, clic o log venía con `created_at` vacío (`null.replace`). Ahora todas las fechas pasan por `parseDate`, que tolera valores vacíos o inválidos.
- **Tendencia de entrega desordenada:** se ordenaba por textos tipo "Oct 16" (sin año). Ahora se ordena por día real.
- **Total de aperturas** daba `NaN` si un lead no traía `opens`.
- **Alias de links:** con una URL inválida se guardaba un objeto de error.
- **Modal de etiquetas:** `bg-black bg-opacity-50` no existe en Tailwind 4 y dejaba el fondo totalmente negro. Ahora usa el mismo fondo que el modal de detalles.
- **Editor de Difusión Manual:** la configuración de Quill se recreaba en cada render (reinicia la barra y puede perder el foco). Ahora es constante.
- **Paginación:** si al actualizar había menos campañas, la página actual podía quedar vacía.
- **Búsqueda de correos** distinguía mayúsculas y fallaba con emails vacíos.
- **Login:** `admin_user` corrupto en localStorage rompía la app al abrir.
- Clases mal escritas (`focus:rig-2`, `py-1 5`, `p-0 5-transition-colors`) y textos con errores ("eitquetas", "permanetenmente", "elimino").
- `alert("...", error)` mezclado con `window.confirm` y SweetAlert: ahora todo usa SweetAlert.
- Los 3 avisos de lint del original quedaron resueltos.

## Más funcional
- Confirmación antes de enviar una Difusión Manual (indica fase y etiquetas) y antes de ejecutar la Campaña IA.
- Difusión Manual no deja enviar con el cuerpo vacío, y muestra los adjuntos elegidos.
- Los modales se cierran con Escape o haciendo clic fuera.
- Base de Datos CRM: contador "N de M", mensajes de "Cargando..." y "Ningún prospecto coincide".
- Dashboard: aviso si falla la carga de métricas y botón Actualizar con estado de carga.
- Agente IMAP: muestra "VERIFICANDO..." mientras consulta y avisa si falla en lugar de mostrar "APAGADO".
- Errores del backend (`message`) se muestran al subir CSV o encolar campañas.
- Las páginas se cargan bajo demanda: el bundle inicial bajó de 1.040 kB a 324 kB.
- URL del API configurable con `VITE_API_URL`.

## Código unificado
- `src/utils/session.js`: token, usuario y "recordar usuario" en un solo lugar.
- `src/utils/dates.js`: parseo, filtros de fecha y formatos (antes repetidos 10+ veces).
- `src/utils/tags.js`: lectura de etiquetas (antes 4 copias del `JSON.parse` con try/catch).
- `src/utils/notify.js`: alertas y confirmaciones SweetAlert.
- `src/hooks/useLeads.js`: carga de prospectos compartida por Base de Datos y Difusión Manual.
- `src/components/Modal.jsx`, `PageHeader.jsx`, `StatusMessage.jsx`, y `Card` dentro del Dashboard.

## Sin cambiar (para revisar)
- En la vista global, un lead con `sent` o `delivered` en 0 cuenta como 1 (`l.sent || 1`). Se dejó igual porque cambia los números del reporte.
- Bloqueado, Falló, Spam y Desuscrito siguen fijos en 0: el backend no envía esos datos.
