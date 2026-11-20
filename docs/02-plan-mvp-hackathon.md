# Nexo — Plan del MVP para el hackathon (v1)

*Fecha: 20-11-2026 · Estado: borrador para aprobar · Duración: 2 días y medio (5 bloques de medio día)*

Base: el documento "Plan de arranque: startup de coordinación inteligente" y la exploración (`01-exploracion.md`).
Esta versión sustituye a la v0, que estaba pensada para equipos de software y GitHub.

---

## 1. Qué construimos

**Nexo es un coordinador con IA que vive en WhatsApp.** Lee los mensajes de trabajo de una empresa de distribución o servicios de campo, detecta tareas y bloqueos, les da seguimiento y le dice a cada persona lo que necesita saber, sin que un supervisor tenga que pasar el mensaje.

**Cliente de la demo:** una distribuidora ficticia de Costa Rica con 80 empleados, tres áreas (oficina, bodega y campo) y coordinación por WhatsApp y una hoja de cálculo de pedidos.

### Las cinco funciones del MVP

Salen de la lista "MVP" del Plan de arranque, recortadas a lo que cabe en 2 días y medio.

| # | Función | Qué ve el jurado |
|---|---|---|
| F1 | **Detección de tareas y bloqueos** | Un técnico escribe "falta repuesto" y Nexo crea la tarea, con responsable y plazo |
| F2 | **Seguimiento y escalamiento** | Nexo avisa a bodega, pregunta si se resolvió y, si se atrasa, escala al responsable con el contexto |
| F3 | **Brief por rol** | Cada supervisor recibe en WhatsApp sus pendientes, bloqueos y qué cambió desde ayer |
| F4 | **Preguntas del gerente** | "¿Cómo vamos con los pedidos de la semana?", respondido en segundos con los datos de origen |
| F5 | **Panel y aprobaciones** | Vista web de lo abierto, atrasado y resuelto; registro de cada acción; lo que tiene costo espera aprobación humana |

### Fuera del MVP
- Correo y calendario como fuentes (quedan WhatsApp y una hoja de cálculo).
- Integración con ERP o contabilidad.
- Lectura de grupos reales de WhatsApp de una empresa (ver sección 3).
- Cuentas de usuario, varias empresas a la vez y app móvil.
- Todo lo de negocio del Plan de arranque (precios, legal, ventas): va en la presentación, no en el código.

### La métrica de la demo
Dos cifras del Plan de arranque, visibles en el panel:
- **Horas de coordinación ahorradas por semana** (la línea base del documento: 10 supervisores que pierden 1 hora diaria).
- **Tareas cerradas sin intervención del gerente**, sobre el total detectado (meta del documento: 50 %).

---

## 2. Guion de la demo (4 minutos)

Es el "día con Nexo" del Plan de arranque, comprimido. Se escribe antes que el código y manda sobre el alcance.

| Minuto | Qué pasa | Función |
|---|---|---|
| 0:00 | El problema en una frase: en esta empresa todo pasa por el gerente y se entera tarde | — |
| 0:30 | 7:00 a. m.: la supervisora de bodega recibe su brief en WhatsApp, en un teléfono real | F3 |
| 1:00 | Un técnico escribe "no puedo terminar en el cliente, falta el repuesto". Nexo crea la tarea y avisa a bodega | F1 |
| 1:45 | Se adelanta el reloj: nadie respondió. Nexo escala a la supervisora con el contexto completo | F2 |
| 2:30 | Bodega propone comprar el repuesto de urgencia. Como tiene costo, Nexo pide aprobación al gerente | F5 |
| 3:00 | El gerente pregunta "¿cómo vamos con los pedidos de la semana?" y recibe la respuesta con cifras | F4 |
| 3:30 | Panel: abierto, atrasado, resuelto, registro de acciones y las dos cifras | F5 |

---

## 3. WhatsApp: qué se puede hacer en 2 días y medio

La vía oficial para leer grupos no sirve para el hackathon, así que la demo combina tres vías.

**Por qué no la vía oficial de grupos.** La API de grupos de WhatsApp exige una cuenta de empresa verificada por Meta y solo funciona con grupos creados desde la propia API. Foros de desarrolladores hablan además de un tope de 8 participantes y de que no se pueden adoptar grupos existentes; ese dato no está confirmado en la documentación de Meta. Los bots no oficiales que se meten en grupos arriesgan el bloqueo del número.

| Vía | Para qué | Límites conocidos |
|---|---|---|
| **A. Historial exportado** | Cargar un grupo de trabajo completo con la función "Exportar chat" de WhatsApp (archivo de texto) | No es en vivo |
| **B. Conversación en vivo 1 a 1** con el entorno de pruebas de Twilio | Mensajes reales en teléfonos reales durante la demo | Solo para pruebas. Cada teléfono se une con un código y la sesión caduca a los 3 días. Cuenta de prueba: 50 mensajes al día. Nexo solo puede escribir libremente en las 24 horas siguientes al último mensaje de la persona |
| **C. Simulador de chat en el panel** | Respaldo si falla la red o Twilio, y para mostrar el "grupo" en pantalla | No es WhatsApp real |

**Consecuencia para el producto real:** el camino a grupos pasa por la verificación de Meta. Se anota como primera tarea después del hackathon y como riesgo en la presentación (el Plan de arranque ya lo recoge como "dependencia de WhatsApp/Meta").

**Lo que debe hacer una persona del equipo:** crear la cuenta de Twilio y unir los teléfonos de la demo al entorno de pruebas. Claude no crea cuentas ni maneja sus credenciales.

---

## 4. Cómo funciona

| Pieza (ensayo de Sequoia) | En Nexo | Etapa |
|---|---|---|
| Fuentes | Mensajes de WhatsApp (vías A, B y C) y una hoja de cálculo de pedidos | 2 |
| Modelo vivo de la empresa | Base de datos con personas y roles, mensajes, tareas, bloqueos, pedidos, acciones y aprobaciones | 2 |
| Capa de coordinación | Claude lee cada mensaje, decide si hay tarea o bloqueo, a quién avisar y cuándo escalar | 3 |
| Interfaces | WhatsApp para el equipo y panel web para gerencia | 3 y 4 |

**Tres reglas del producto** (responden a los riesgos del Plan de arranque y de la exploración):
1. **Nada con costo se ejecuta sin aprobación humana.**
2. **Cada acción queda registrada** con el mensaje que la originó.
3. **Si no hay dato, Nexo dice "no lo sé"** en lugar de inventar.

---

## 5. Pila técnica (la que ya se usa en TREISS)

| Capa | Elección | Motivo |
|---|---|---|
| Panel web | Next.js + TypeScript + Tailwind + componentes Radix/shadcn + TanStack Query + Recharts, con `pnpm` | Es la pila de `treiss_frontend` |
| Servidor | Rutas de API dentro del mismo proyecto Next.js, incluida la que recibe los mensajes de Twilio | Un solo despliegue. FastAPI, la pila de `treiss_backend`, exigiría montar un servidor aparte |
| Base de datos | PostgreSQL gestionado, contratado desde el marketplace de Vercel | Mismo motor que TREISS |
| IA | API de Claude: `claude-opus-5-5` para brief y preguntas, `claude-haiku-5-5` para clasificar cada mensaje | Calidad donde se ve, rapidez y bajo coste por mensaje |
| WhatsApp | Entorno de pruebas de Twilio | No requiere aprobación de Meta |
| Tareas programadas | Tareas programadas de Vercel, más un botón "adelantar el reloj" para la demo | El brief de las 7:00 y los escalamientos no pueden esperar horas en una demo |
| Despliegue y código | Vercel y GitHub `brybamol/Nexo` | El conector de Vercel y `gh` ya funcionan |

**Decisión abierta:** si el equipo prefiere Python para el servidor, se usa FastAPI. Cuesta medio bloque de despliegue en la etapa 1.

---

## 6. Etapas

Cada etapa termina con algo que se puede enseñar. Si una se atrasa, se recorta su alcance, no la siguiente.

| Etapa | Cuándo | Entregable | Se da por cerrada cuando |
|---|---|---|---|
| **0. Definición** | Antes de empezar (2–3 h) | Guion aprobado, empresa ficticia y casos de control | El equipo aprueba el guion y Twilio responde en un teléfono |
| **1. Esqueleto desplegado** | Día 1, mañana | App en producción que recibe un WhatsApp y lo guarda | Un mensaje enviado desde un teléfono aparece en el panel |
| **2. Modelo vivo e ingesta** | Día 1, tarde | Historial exportado, hoja de pedidos y mensajes en vivo dentro del modelo | Una consulta devuelve los mensajes y pedidos de un área |
| **3. Capa de coordinación** | Día 2, mañana | F1, F2, F3 y F4 funcionando por WhatsApp | Los 15 casos de control dan el resultado esperado |
| **4. Panel y aprobaciones** | Día 2, tarde | F5 completo y simulador de chat | Se recorre el guion entero sin tocar código |
| **5. Demo** | Día 3, mañana | Presentación, vídeo de respaldo y versión congelada | Dos ensayos seguidos sin fallos y dentro del tiempo |

### Etapa 0 — Definición (antes del hackathon)
- Aprobar el guion de la sección 2.
- Diseñar la distribuidora ficticia: 12 personas con rol y área, 3 grupos de trabajo, 20 pedidos de la semana.
- Escribir el historial de chat de ejemplo en el formato de "Exportar chat", con 3 bloqueos plantados y 1 decisión con costo.
- Escribir 15 casos de control: mensaje de entrada y resultado esperado (tarea o no, responsable, urgencia).
- Crear la cuenta de Twilio y probar que un teléfono recibe respuesta.
- Herramientas: skills `brainstorming` y `ask-questions-if-underspecified`; `engineering:architecture` para dejar por escrito la decisión de pila.

### Etapa 1 — Esqueleto desplegado (día 1, mañana)
- Crear el proyecto Next.js con `pnpm`, Tailwind y componentes base; conectarlo a Vercel.
- Crear la base de datos y las tablas: `personas`, `mensajes`, `tareas`, `pedidos`, `acciones`, `aprobaciones`.
- Ruta que recibe los mensajes de Twilio, comprueba su firma y los guarda.
- Prueba automática mínima en cada subida (GitHub Actions).
- Copiar a `Nexo/.claude/` los agentes y las reglas de TREISS, adaptados (sección 7).
- Herramientas: conector de Vercel, `gh`, skill `writing-plans`, agente `arquitecto`.

### Etapa 2 — Modelo vivo e ingesta (día 1, tarde)
- Lector del archivo de "Exportar chat": autor, fecha, texto y grupo.
- Cargador de la hoja de pedidos (CSV o Google Sheets).
- Unificar las tres vías de WhatsApp en la misma tabla de mensajes.
- Reglas sin IA para lo calculable: tarea sin respuesta en X horas, pedido pasado de fecha.
- Pruebas primero en esta etapa: un error aquí invalida la demo.
- Herramientas: agente `backend-dev`, skill `test-driven-development`, agente `verificador` al cierre.

### Etapa 3 — Capa de coordinación (día 2, mañana)
- F1: clasificar cada mensaje (¿tarea?, ¿bloqueo?, ¿para quién?, ¿urgencia?, ¿tiene costo?).
- F2: avisar al responsable, preguntar por el estado y escalar al vencer el plazo.
- F3: generar el brief por rol y enviarlo por WhatsApp.
- F4: responder preguntas del gerente con los datos del modelo y sus fuentes.
- Pasar los 15 casos de control y anotar el resultado real.
- Guardar las respuestas del guion para que la demo no dependa de la red.
- Herramientas: skill `claude-api`, agente `backend-dev` con Opus, agente `revisor`.

### Etapa 4 — Panel y aprobaciones (día 2, tarde)
- Panel con tres columnas (abierto, atrasado, resuelto) y las dos cifras arriba.
- Registro de acciones: qué hizo Nexo, cuándo y por qué mensaje.
- Bandeja de aprobaciones con aprobar y rechazar.
- Simulador de chat y botón "adelantar el reloj".
- Recorrido automático del guion en el navegador.
- Herramientas: agente `frontend-dev`, skills `frontend-design` e `impeccable`, `design:design-critique`, `webapp-testing`.

### Etapa 5 — Demo (día 3, mañana)
- Congelar el código a primera hora; desde aquí solo se corrigen fallos del guion.
- Presentación de 6 diapositivas con el Plan de arranque: problema, solución, demo, cliente y mercado, modelo de negocio, plan de 90 días.
- Grabar el vídeo de respaldo y volver a unir los teléfonos a Twilio esa mañana.
- Dos ensayos cronometrados y respuestas preparadas a las preguntas difíciles: privacidad de los chats, miedo a despidos, dependencia de Meta.
- Herramientas: `verification-before-completion`, `code-review`, skill de presentaciones, `design:ux-copy`.

---

## 7. Cómo trabajamos (flujo de TREISS, adaptado)

**Se mantiene**
- **Plan aprobado antes del código.** Cada etapa tiene su plan detallado (skill `writing-plans`), que se aprueba antes de escribir.
- **Agentes por rol:** `arquitecto` (diseña), `backend-dev` y `frontend-dev` (construyen), `revisor` (revisa antes de unir), `verificador` (corre las pruebas con memoria limpia) y `documentador` (actualiza los documentos).
- **Trabajo en paralelo y aislado:** cada agente que escribe usa su propia copia del repositorio (skills `using-git-worktrees` y `subagent-driven-development`).
- **Punto de control al cierre de cada etapa:** el `verificador` informa del resultado real, sin arreglar nada.
- **Índice del código con CodeGraph** desde el final de la etapa 1.

**Se relaja para el hackathon**
- La cobertura del 90 % no aplica. Pruebas obligatorias solo en el lector de chats, las reglas de plazo y los 15 casos de control.
- El panel se verifica con el recorrido del guion, no con pruebas por componente.
- La documentación se limita a `docs/` y a un `CLAUDE.md` corto.

### Reparto sugerido con 3 personas

| Persona | Etapas 1–2 | Etapas 3–4 | Etapa 5 |
|---|---|---|---|
| A (datos y WhatsApp) | Twilio, lector de chats y modelo | Seguimiento, escalamiento y reloj | Teléfonos y respaldo |
| B (IA) | Empresa ficticia y casos de control | Clasificación, brief y preguntas | Preguntas difíciles |
| C (producto) | Esqueleto, despliegue y diseño base | Panel, aprobaciones y simulador | Presentación y vídeo |

---

## 8. Conectores y permisos

| Herramienta | Estado | Uso en el plan |
|---|---|---|
| Vercel | Conectado | Despliegue, base de datos, tareas programadas y registros de errores |
| GitHub (`gh`) | Sesión iniciada | Repositorio y ramas |
| Google Drive | Conectado | Hoja de pedidos y presentación |
| Notion | Conectado | Opcional: notas del equipo |
| Twilio | Sin cuenta | Lo crea una persona del equipo en la etapa 0 |
| Slack, Linear, Asana, Atlassian, Figma | Sin autorizar | No hacen falta para este MVP |

---

## 9. Riesgos y recortes

| Riesgo | Señal | Respuesta |
|---|---|---|
| Twilio falla o caduca la sesión | El teléfono no recibe respuesta | Simulador de chat (vía C) y vídeo de respaldo |
| Nexo clasifica mal un mensaje en vivo | Menos de 13 de 15 casos de control bien | Limitar la demo a los mensajes del guion, con respuestas guardadas |
| Nexo no puede iniciar la conversación del brief | Pasaron más de 24 horas desde el último mensaje del teléfono | La persona escribe "brief" y Nexo responde |
| La red del lugar falla | — | Vídeo de respaldo |
| El alcance crece | Aparece una sexta función | Va a la lista "después del hackathon" |

**Orden de recorte si falta tiempo:** hoja de pedidos en Google Sheets (se usa CSV) → F4 con preguntas libres → vía B en vivo → gráficos. F1, F2 y el panel no se recortan.

---

## 10. Qué falta para cerrar este plan
- [ ] Fechas y horario del hackathon.
- [ ] Tamaño del equipo y quién hace qué.
- [ ] Criterios de evaluación y formato de la presentación.
- [ ] Industria definitiva de la empresa ficticia (el Plan de arranque la deja como pregunta abierta).
- [ ] Confirmar la pila de la sección 5 y la decisión abierta sobre Python.

## Fuentes
- Plan de arranque: startup de coordinación inteligente (documento del equipo, 20-11-2026).
- API de grupos de WhatsApp, documentación de Meta: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/
- Hilo de desarrolladores sobre el tope de 8 participantes (no confirmado por Meta): https://developers.facebook.com/community/threads/1084199161066371/
- Entorno de pruebas de Twilio para WhatsApp: https://www.twilio.com/docs/whatsapp/sandbox
