# UX — Flujos y pantallas propuestas

## Roles
1. **Gerente / Administrador:** panorama general, prioridades, aprobaciones, registro de acciones.
2. **Supervisor:** tareas del área, bloqueos, asignación y seguimiento.
3. **Trabajador de campo:** actualizaciones simples, reportes y confirmaciones por canal autorizado.
4. **Administrador de implementación:** permisos, fuentes de datos, mapeo de roles y reglas.

## Arquitectura de información propuesta (no lista de features construidas)
- `/overview` — resumen ejecutivo: actividad, tareas abiertas/atrasadas/resueltas, bloqueos urgentes.
- `/tasks` — lista filtrable: título, área, responsable, prioridad, fecha, estado, fuente.
- `/blockers` — bloqueos detectados, origen y escalamiento.
- `/approvals` — propuestas de IA que requieren revisión/confirmación.
- `/activity` — historial trazable, autor, acción, hora y fuente.
- `/integrations` — estado de conexiones autorizadas (solo cuando existan).
- `/settings` — empresas, áreas, roles, permisos y preferencias.

## Flujo crítico: bloqueo de repuesto
1. Entrada autorizada en fuente conectada.
2. Detección por sistema con fragmento fuente y nivel de confianza.
3. Presentación como propuesta verificable de bloqueo/tarea.
4. Usuario autorizado confirma, edita o descarta.
5. Tarea asignada o notificación según permisos.
6. Seguimiento de estado y alerta de retraso.
7. Resolución documentada y cierre con rastro de auditoría.

## Flujo: aprobación humana
IA propone acción → muestra impacto, responsable y fuente → humano autoriza/rechaza → se registra evento → ejecución real solo si hay integración autorizada → estado final y evidencia. **Nunca** llamar a una simulación “acción ejecutada”.

## Brief diario por rol
Lista priorizada de lo que cambió, pendientes, bloqueos y decisiones que esperan atención. En mensajes: corto y escaneable, con opción de consultar detalle. El gerente puede pedir “¿cómo van los pedidos?” y recibir respuesta que cite la fuente.

## Estados obligatorios de interfaz
- Sin datos / aún no hay fuente conectada.
- Fuente desactualizada / sincronización pendiente.
- Cargando / conexión fallida.
- Sugerencia de IA, no confirmada.
- Pendiente de aprobación.
- Aprobado, rechazado, ejecutado, fallido.
- Error de permiso / fuente no autorizada.
- Datos de demostración, visiblemente etiquetados.

## Ejemplo de datos MOCK para diseño
- 32 tareas en progreso; 5 bloqueadas; 86% completadas.
- “Repuesto sin confirmar”, área mantenimiento.
- “Entrega pendiente de validación”, área distribución.
**Estas cifras y entidades son ficticias. No deben aparecer como métricas reales de Nexo.**

## Orientación de interfaz
Mobile-first para comunicaciones operativas; dashboard responsivo para gerencia. Barra lateral en desktop; navegación simplificada en móvil. Componentes desacoplados y datos de ejemplo en archivos separados.
