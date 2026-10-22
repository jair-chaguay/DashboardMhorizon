# mhorizon-crm-frontend-v4

Pulido visual sobre v3: misma lógica, mismas pantallas y mismas acciones, pero con menos ruido y lectura más fácil.
Colores de marca MHORIZON (azul oscuro #171E27 / #0A2C5E y naranja #D4681C), esquinas moderadas (tarjetas 10 px, botones y campos 6-8 px).

## Criterios
- Un solo color para cada cosa en todo el sistema: enviados = gris azulado, aperturas = azul de marca, clics = naranja de marca (se quitó el verde azulado).
- Texto más legible: nada de 10-11 px en gris claro; mínimo 12-13 px en gris medio. Sin títulos en MAYÚSCULAS con espaciado.
- Pesos de letra más ligeros (de extra negrita a negrita/seminegrita) y tamaños de título coherentes.
- Tarjetas sin sombras, solo borde fino. Botones sin sombra de color. Sin línea degradada bajo la barra superior.
- Estilos base compartidos en `src/utils/theme.js` (`ui.card`, `ui.btn`, `ui.btnPrimary`, `ui.input`, `ui.th`...) para que todo se vea igual.
- `PageHeader` ahora recibe las acciones (filtros y botones) a la derecha del título.

## Por pantalla
- Menú lateral: más compacto, secciones en minúsculas, punto de estado IMAP sin parpadeo.
- Panel analítico: los 4 indicadores en una sola tarjeta dividida, sin íconos ni barras. Se quitó "Embudo de entrega" porque repetía las mismas cifras de los indicadores; el CTOR pasó a la línea de "Tasa de clics". "Actividad diaria" a todo el ancho. "Prospectos con más interés" como tabla (6 filas). "Actividad reciente" en filas de una línea con un punto de color y la hora a la derecha. Barras de fase en un solo color.
- Campañas: indicadores en una tarjeta; toda la fila abre el reporte de la campaña; la columna CTOR pasa al reporte, la comparación y el CSV; sin el botón "Reporte global" (ya está en el menú).
- Base de datos: las 6 tarjetas de fase pasan a pestañas sobre la tabla; la carga de CSV se abre con el botón "Cargar CSV" (visible siempre si la base está vacía); aperturas y clics en columnas propias; etiquetas en gris; los botones de etiquetar/eliminar aparecen al pasar el mouse por la fila (en móvil siempre visibles).
- Ficha del prospecto, detalle de contactos, Difusión manual, Campaña IA y Agente IMAP: mismos ajustes de tipografía, colores y botones. Títulos cortos iguales al menú.
- Login: sin cambios.

## Añadido (con los datos que ya llegan)
- **Reporte propio por campaña** (`/campanas/<nombre>`, al pulsar una campaña): destinatarios, apertura y clics comparados con el promedio de las demás, respondieron, resultados por fase, tiempo hasta la primera apertura, enlaces de la campaña y lista de destinatarios con pestañas Todos / Abrieron / Hicieron clic / Respondieron / No abrieron / Rebotes y bajas, cada una con sus propias columnas (primera apertura, CTOR, fecha de envío, motivo del rebote…). Cada lista se exporta a CSV ("No abrieron" sirve para reenviar con otro asunto; deja fuera a quien rebotó o se dio de baja). Desde el panel, con una campaña elegida, aparece "Ver reporte completo".
- **Tendencia entre campañas** en Campañas: apertura y clics de cada envío en orden.
- **Tasa de respuesta** en el panel (reemplaza a "Tasa de entrega", que siempre daba ~100% porque no había datos de rebotes) y en el reporte.
- Base de datos: filtro rápido "Para seguimiento" con los prospectos que hicieron clic y aún no respondieron.

## Añadido (se activa cuando el backend envíe los datos, ver BACKEND.md)
- **Rebotes duros y suaves** (o "Rebotes" en general si el servidor no los distingue), **desuscritos** y **spam**: franja en el panel, bloque "Entrega" en el reporte, columna Rebotes en Campañas (un solo número; duros y suaves al pasar el mouse), etiqueta en cada prospecto (Rebote duro, Rebote suave, Desuscrito, Marcó spam), filtros en Base de datos y aviso en la ficha.
- **Asunto** de cada campaña en la tabla y en el reporte.
- **Datos del prospecto**: nombre, empresa, teléfono (se puede pulsar para llamar), responsable, próxima acción con fecha y notas. Se ven y se editan en la ficha; el nombre y la empresa salen bajo el correo en las tablas; la búsqueda también encuentra por nombre, empresa y teléfono; el CSV los incluye. Guardar usa `POST /leads/update`.
- Filtro "Acciones para hoy": prospectos con próxima acción para hoy o atrasada.
- Difusión manual: en "Antes de enviar" avisa cuántos del público rebotaron o se dieron de baja.
- Mientras el servidor no envíe estos datos, las secciones lo indican o no aparecen; no se muestran cifras inventadas. La demo sí trae datos de ejemplo para verlos.

## Pendiente de verificar con el backend real
- Lo mismo que en v3 (ver CAMBIOS.md de v3-propuesta). Probado solo contra la demo con datos inventados.

## Segunda revisión (análisis de cómo se muestra cada dato)
- **Celular:** las tablas de Base de datos y del reporte ya no se cortan. En pantallas pequeñas cada fila pasa a dos líneas (correo, nombre y empresa, y debajo fase, estado, aperturas, clics y avisos de rebote). Las barras de porcentaje se ocultan y queda solo el número.
- **Base de datos:** los atajos (Para seguimiento, Acciones para hoy, Rebote duro, Desuscritos o spam) pasan a una línea "Atención" arriba de la tabla con su cantidad; la barra de búsqueda y filtros cabe en una sola fila en escritorio. Los filtros dicen "Estado: todos" / "Etiqueta: todas".
- **Panel:** nuevo bloque "Para hoy" con los seguimientos pendientes o atrasados (próxima acción de cada prospecto). Reemplaza a "Actividad reciente" cuando existen; si no hay acciones, se sigue viendo la actividad. Los enlaces más clicados muestran nombres legibles ("Historias exito", "Página de inicio") en vez de "historiasexito".
- **Campañas:** la etiqueta "Mejor apertura" pasa junto al porcentaje (ya no parte el nombre en dos líneas).
- **Reporte:** columnas más cortas para que quepan en celular.

## Ajustes del 22 de octubre
- **Rebotes en un solo dato.** Al pulsarlo se abre una ventana con quiénes fueron, separados en duros y suaves, con fecha y motivo. Lo mismo con Desuscritos y Spam.
- **Números al pasar el mouse.** Todo porcentaje (apertura, clics, respuesta, entregados) muestra "X de Y" al pasar el mouse.
- **Quién está detrás de cada cifra.** Destinatarios, tasa de apertura, tasa de clics y tasa de respuesta abren la lista de personas (con nombre y empresa) y se pueden exportar. Se quitó la sección de respuestas clasificadas por el agente IMAP.
- **Gráficas siempre visibles.** Dispositivos y horas ya no están ocultas: están en el panel (justo bajo la actividad diaria) y en el reporte de cada campaña.
- **Pestañas del reporte** con columnas distintas según la lista; el botón de exportar sale de la barra de pestañas (que ya no tiene barra de desplazamiento).
- **Base de datos:** columna Nombre (con la empresa debajo, ordenable) y columna Entrega aparte, junto a Estado, para ver de un vistazo si rebotó o se dio de baja y si respondió.
- **Campañas:** se quitó la columna Bajas; en la comparación, menos rebotes cuenta como mejor.

## Segundo ajuste del 22 de octubre
- **Ventana de rebotes con dos pestañas** arriba: Rebotes duros a la izquierda y Rebotes suaves a la derecha. Cada una muestra solo su lista.
- **Porcentajes que cambian a número:** al pasar el mouse, "64%" pasa a "18 de 28" en el mismo lugar (ya no hay globo flotante). Entregados queda solo como porcentaje.
- **Se quitaron las barritas de progreso** de las tablas de Campañas y de Resultados por fase; queda solo el porcentaje.
- **Entrega en Base de datos y en el reporte:** "Entregado" cuando no hubo rebote, baja ni spam. En Base de datos, quien aún no ha recibido nada (estado Pendiente y sin envíos) queda con "—".

## Tercer ajuste del 22 de octubre
- **Al pasar el mouse solo sale el número exacto** (ya no "25 de 35"). El texto de hover más largo solo queda en Rebotes de Campañas (cuántos duros y cuántos suaves).
- **Campañas:** se quitó la etiqueta "Mejor apertura".
- **Eliminar desde Rebotes:** cada correo de la ventana de rebotes (duros y suaves) tiene un botón "Eliminar" que lo borra de la base de datos (mismo endpoint que Base de datos, con confirmación). Después recarga las cifras y la fila queda como "Ya eliminado".
- **Sin parpadeo:** el porcentaje y el número comparten la misma celda y solo se alterna cuál se ve (antes se remontaba el componente y el contador se reiniciaba). Se quitó el cursor de interrogación; el cursor queda normal.

## Cuarto ajuste del 22 de octubre
- **Logo de MHORIZON** (archivo adjunto por Richard, en `src/assets/mhorizon-logo.svg`) reemplaza el icono con la M y el texto "MHORIZON / CRM interno" en el menú lateral.
- Abajo del menú queda solo el nombre de quien ingresó, sin la letra en círculo ni "Personal autorizado".
