# Datos que el frontend v4 ya sabe leer (pendientes en el backend)

El frontend muestra estos datos **solo si el servidor los envía**. Mientras no lleguen, las pantallas lo dicen («El servidor todavía no envía...») y no inventan cifras. Todo es opcional y compatible con lo que hay hoy.

## 1. Nuevos eventos en `email_logs` (`GET /tracking/dashboard`)

Cada registro sigue teniendo `campaign_name`, `email`, `created_at`. Nuevos valores de `event_type`:

| event_type | Campos extra | Para qué se usa |
|---|---|---|
| `bounce` | `bounce_type`: `hard` o `soft` (también vale `duro`/`suave`). Opcional `bounce_reason` | Rebotes duros y suaves. Si no se envía `bounce_type`, se muestra «Rebotes» en general |
| `unsubscribe` | — | Desuscritos (bajas) |
| `spam` | — | Quejas por spam |

En los registros `sent` se puede añadir `subject` (asunto del correo) para mostrarlo en Campañas y en el reporte.

Cómo se calculan:
- Entregados = enviados − correos únicos que rebotaron. Las tasas de apertura y clics se calculan sobre los entregados.
- Un correo con rebote duro no se cuenta además como suave.
- «Tasa de respuesta» cuenta prospectos con estado «Respondió» en el CRM; no hace falta ningún evento `reply`.

## 2. Nuevos campos en cada prospecto (`GET /leads` y `leads` de `/tracking/dashboard`)

| Campo | Tipo |
|---|---|
| `nombre` | texto |
| `empresa` | texto |
| `telefono` | texto |
| `responsable` | texto (persona del equipo a cargo) |
| `proxima_accion` | texto (ej. «Llamar para agendar cita») |
| `proxima_fecha` | fecha `AAAA-MM-DD` |
| `notas` | texto largo |

## 3. Nuevo endpoint para guardar esos campos

`POST /leads/update` con JSON `{ email, nombre, empresa, telefono, responsable, proxima_accion, proxima_fecha, notas }`.
Debe actualizar solo el prospecto de ese `email` y responder 200. Si el endpoint no existe (404/405), el frontend avisa «El servidor todavía no permite guardar estos datos».

## 4. Recomendado en el servidor
- No enviar a correos con rebote duro, desuscritos o que marcaron spam (el frontend avisa en Difusión manual, pero quien debe excluirlos es el servidor).
- Reintentar los rebotes suaves más tarde.
