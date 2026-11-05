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

## Difusión manual con dos formatos y separación IA / manual (5 de noviembre)

Hecho en el backend (`jair-chaguay/Mhorizon`, carpeta `backend`):
| Qué | Dónde |
|---|---|
| `POST /campaign/manual` acepta `formato` (`personal` o `campana`) y lo guarda en `tareas_envio.formato` | `CampaignController@encolarEnvioManual` + migración `2026_11_05_100000_add_formato_to_tareas_envio_table` |
| Las imágenes del correo con diseño llegan como `data:image` (Gmail no las muestra). Al encolar se guardan en `storage/app/public/campanas/img/<sha1>.<ext>` y se cambian por su enlace público | `CampaignController@publicarImagenes` |
| `GET /tracking/dashboard` devuelve `campaign_types`: `{ asunto: 'personal' \| 'campana' }` con las campañas de Difusión manual; el resto son de la secuencia de la IA | `TrackingController@tiposDeCampana` |
| Al darse de baja (`POST /track/unsubscribe`), además de `NO CONTACTAR` y fase 99, sus etiquetas se cambian por `Desuscrito` (así sale también de las difusiones por etiqueta). No se borra: con fase 99 ya no entra en la secuencia de la IA ni en las difusiones manuales (solo van a las fases 0 a 5), y se sigue viendo quién se dio de baja | `TrackingController@unsubscribe` |

Para que funcione en el servidor:
- `php artisan migrate` y `php artisan storage:link`; `APP_URL` con el dominio público (https), porque los enlaces de las imágenes se arman con `asset()`.
- Subir el límite del POST: las imágenes en base64 pesan un 33% más. Por ejemplo `post_max_size = 25M` y `upload_max_filesize = 25M` en PHP, y `client_max_body_size 25m;` si hay nginx.

El frontend usa `campaign_types` en Campañas (filtro "Secuencia IA" / "Difusiones" y una etiqueta en cada fila). Si el servidor no lo envía, la página se ve como antes.

## Pendiente en el worker de Python (`MhorizonIA`, no está en estos repositorios)
Regla acordada: un prospecto recibe un correo por fase de la IA y, aparte, todos los envíos manuales que se hagan. Los manuales no cuentan para la secuencia.
1. **Los envíos manuales (`tareas_envio.tipo = 'manual'`) no deben cambiar `leadss.fase`, `leadss.status` ni `envios_fase_actual`.** Solo registran el envío (`/track/register`). Si hoy escriben "Contactado (Fase N)", alguien que estaba "Conversando con IA" pierde ese estado.
2. **Respuestas a un envío manual.** Cuando alguien responde un informativo o un calendario, el agente IMAP no debería contestarle como si fuera parte de la secuencia de su fase. Propuesta: buscar a qué campaña responde (el asunto sin "Re:") y, si está en `tareas_envio` con `tipo = 'manual'`, derivarla al equipo ("Derivado a Equipo") en lugar de que responda la IA.
3. **Clics en los botones.** Los botones e imágenes con enlace del correo con diseño son `<a href="https://...">` normales. El worker debe cambiarlos por `/track/click?email=...&campaign=...&url=...` igual que los enlaces del correo personal. Los `href="#"` (botón sin enlace) se dejan como están.
4. **No envolver el cuerpo.** En `formato = 'campana'` el cuerpo ya trae su diseño completo (fondo, columna de 600 px y pie). Solo se agrega el píxel de apertura.
5. **Enlace de baja del pie.** El pie del correo con diseño termina con un enlace discreto "darte de baja aquí" con `href="{{enlace_baja}}"`. Por cada destinatario, el worker cambia `{{enlace_baja}}` por su enlace de baja (`/track/unsubscribe?email=...&campaign=...`, el mismo que ya arma para "date de baja aquí"), antes de cambiar los demás enlaces por `/track/click`. Si el cuerpo trae `{{enlace_baja}}`, no se agrega el enlace de baja propio al final, para que no salga dos veces. Las cabeceras `List-Unsubscribe` se mantienen.
