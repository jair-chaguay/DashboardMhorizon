# Backend del CRM (Laravel en `WEB/backend`) y worker de Python (`MhorizonIA`)

Estado al 23 de octubre de 2026.

## Ya hecho en el backend

| Qué | Dónde |
|---|---|
| `GET /leads` devuelve también `sent`, `opens` y `clicks` (unidos desde la tabla `leads` de tracking) y los datos de contacto | `LeadController@index` |
| `POST /leads/update` guarda `nombre, empresa, telefono, responsable, proxima_accion, proxima_fecha, notas` | `LeadController@actualizarContacto` |
| La carga de CSV lee columnas `email`/`correo`, `nombre`, `empresa`, `telefono` si el encabezado las trae (si no, el correo sigue siendo la primera columna) | `LeadController@uploadCsv` |
| `GET /tracking/dashboard` devuelve en cada prospecto el estado del CRM (`leadss.status`) y sus datos de contacto; el estado de envío queda en `tracking_status` | `TrackingController@getDashboardData` |
| Un rebote detectado por IMAP (sin `campaign`) se asigna a la última campaña enviada a ese correo; antes siempre caía en "Campaña General" | `TrackingController@registerLead` |
| `/track/register` acepta `reason` (motivo del rebote) y lo guarda en `email_logs.bounce_reason` | `TrackingController@registerLead` |
| Página pública de baja `/track/unsubscribe?email=...&campaign=...` (muestra un botón de confirmar; al confirmar registra `unsubscribe` y deja al prospecto en `NO CONTACTAR`, fase 99) | `TrackingController@unsubscribe` |
| Difusión manual: el filtro por etiquetas se guarda en `tareas_envio.etiqueta_filtro` (el worker ya lo leía, pero nunca llegaba y se enviaba a toda la fase) | `CampaignController@encolarEnvioManual` |
| `/leads`, `/leads/upload`, `/imap/*` y `/campaign/*` ahora piden sesión (`auth:sanctum`) | `routes/api.php` |

Migraciones nuevas (correr `php artisan migrate`):
- `2026_10_23_100000_add_contacto_fields_to_leadss_table`
- `2026_10_23_100100_add_bounce_fields_to_email_logs_table` (también crea un evento `unsubscribe` para quienes ya están en `NO CONTACTAR`)
- `2026_10_23_100200_add_etiqueta_filtro_to_tareas_envio_table`

## Cómo lee el frontend los datos que ya existen
- `email_logs.event_type = 'blocked'` → rebote duro; `'failed'` → rebote suave (`src/utils/deliverability.js`).
- "Respondió" = estado que empieza con `Conversando con IA` o `Derivado a Equipo` (`src/utils/status.js`).
- El nombre de la campaña es el asunto del correo (así lo envía el worker), por eso no hace falta el campo `subject`.

Rebote suave (`status=failed`): ya no retira al prospecto; solo el rebote duro (`blocked`) lo pasa a fase 99.

## Hecho en el worker de Python (`MhorizonIA`)
- `modules/email_manager.py`
  - Enlace "date de baja aquí" en el pie de los correos de campaña y cabeceras `List-Unsubscribe` / `List-Unsubscribe-Post` (botón de Gmail/Yahoo).
  - `/track/register` recibe `reason` con el código y texto SMTP del rechazo.
  - `check_bounced_emails(correos)` lee los avisos de mailer-daemon sin marcar como leídos los demás correos, solo reporta correos que están en la base, distingue 5.x.x (duro) de 4.x.x (suave) y envía el motivo.
  - `registrar_baja(email)` registra la baja en Laravel.
  - `send_email(..., interno=True)` para avisos al equipo: sin tracking, sin enlace de baja y sin registro en Laravel.
  - Las respuestas del agente ya no se registran como envíos de campaña (antes creaban campañas "Re: ..."); sus aperturas y clics cuentan en la campaña original.
  - El correo va codificado en las URL de tracking (antes un `+` en el correo se perdía).
- `worker_inbound.py`: revisa rebotes antes de leer respuestas y llama a `registrar_baja` en la acción `UNSUBSCRIBE`.
- `worker_campanas.py`: la alerta "PROSPECTO ELIMINADO" se envía con `interno=True`.

## No disponible todavía
- **Spam**: el envío es por SMTP propio, no hay aviso de quejas. Se necesitaría un proveedor con feedback loop (SES, Mailgun, etc.).
