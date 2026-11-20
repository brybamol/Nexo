# Nexo — Plan del MVP para el hackathon (v0)

*Fecha: 20-11-2026 · Estado: borrador para aprobar · Duración: 2 días y medio (5 bloques de medio día)*

> **Aviso.** El documento de contexto del hackathon no se pudo leer: no está compartido con esta conversación.
> Este plan parte de la exploración (`01-exploracion.md`) y de los supuestos de la sección 1.
> Cuando llegue el contexto real, se ajustan primero el alcance y los criterios de la demo.

---

## 1. Supuestos (corregir antes de empezar)

| # | Supuesto | Si no se cumple |
|---|---|---|
| S1 | El reto admite un producto de software con IA; no hay tecnología obligatoria | Se cambia la pila de la sección 4 |
| S2 | Equipo de 2 a 4 personas, cada una con Claude Code | Con 1 persona se recorta la etapa 4 a una sola pantalla |
| S3 | Se evalúa con una demo en vivo de 3 a 5 minutos más preguntas | Si piden vídeo o deck, se adelanta la etapa 5 |
| S4 | Se puede usar código y herramientas propias (skills, agentes, plantillas) | Se arranca desde cero y se recorta la etapa 3 |
| S5 | No hay datos reales de una empresa disponibles para la demo | Si los hay, sustituyen al conjunto de datos de ejemplo |

---

## 2. Qué construimos

**Nexo es una capa de coordinación con IA.** Lee el trabajo donde ya ocurre (código, tareas, mensajes, documentos) y hace el trabajo que hoy hacen las capas intermedias: informar del estado, detectar bloqueos y decir quién decide cada cosa.

Corresponde a la opción C de la exploración: es la única que se puede demostrar en 2 días y medio sin cambiar el organigrama de nadie.

### Las tres funciones del MVP

| # | Función | Qué ve el jurado |
|---|---|---|
| F1 | **Reporte de estado automático** | El resumen semanal de un equipo, generado solo, con cada afirmación enlazada a su fuente |
| F2 | **Radar de bloqueos** | Lista de trabajos parados o en riesgo, con el motivo, desde cuándo y quién puede desbloquearlo |
| F3 | **Pregunta y respuesta** | "¿En qué está el proyecto X?" o "¿Quién decide Y?", con respuesta y citas |

### Fuera del MVP
- Rediseño de roles o del organigrama (opciones D y E de la exploración).
- Acciones automáticas: Nexo informa y propone, no ejecuta ni reasigna.
- Cuentas de usuario, permisos por rol y varias empresas a la vez.
- Más de dos fuentes de datos conectadas de verdad.

### La métrica de la demo
Una sola cifra, visible en pantalla: **horas de coordinación que Nexo sustituye por semana** en el equipo de ejemplo (reuniones de estado y reportes manuales), junto a los **saltos de información** que elimina entre quien hace el trabajo y quien decide.

---

## 3. Cómo funciona (las cuatro piezas del ensayo de Sequoia, en pequeño)

| Pieza | En Nexo | Etapa |
|---|---|---|
| Fuentes | GitHub (conexión real) + un conjunto de datos de ejemplo con tareas, mensajes y decisiones de una empresa ficticia | 2 |
| Modelo de la empresa | Base de datos con personas, iniciativas, trabajos, eventos y decisiones, todos con enlace a su origen | 2 |
| Capa de inteligencia | Claude genera el reporte, clasifica bloqueos y responde preguntas usando solo lo que hay en el modelo | 3 |
| Interfaz | Panel web con tres vistas: Reporte, Radar y Preguntar | 4 |

**Regla de honestidad del producto:** toda afirmación lleva cita a su fuente. Si no hay dato, Nexo dice "no lo sé". Es la respuesta directa a la crítica principal de la exploración (calidad y responsabilidad).

---

## 4. Pila técnica (la que ya se usa en TREISS)

| Capa | Elección | Motivo |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind + componentes Radix/shadcn + TanStack Query + Recharts, con `pnpm` | Es la pila de `treiss_frontend`; no hay curva de aprendizaje |
| Backend | Rutas de API dentro del mismo proyecto Next.js | Un solo despliegue. FastAPI (la pila de `treiss_backend`) exigiría montar un servidor aparte |
| Base de datos | PostgreSQL gestionado, contratado desde el marketplace de Vercel | Mismo motor que TREISS, sin administrar servidores |
| IA | API de Claude: `claude-opus-5-5` para reporte y preguntas, `claude-haiku-5-5` para clasificar eventos en volumen | Calidad donde se ve, coste bajo donde hay volumen |
| Despliegue | Vercel, con vista previa por cada rama | El conector de Vercel ya está activo en Claude |
| Código | GitHub `brybamol/Nexo`, una rama por etapa y `main` siempre desplegable | Flujo actual |

**Decisión abierta:** si el equipo prefiere Python para la ingesta, se añade un servicio FastAPI en la etapa 2. Cuesta medio bloque de despliegue.

---

## 5. Etapas

Cada etapa termina con algo que se puede enseñar. Si una etapa se atrasa, se recorta su alcance, no la siguiente.

| Etapa | Cuándo | Entregable | Se da por cerrada cuando |
|---|---|---|---|
| **0. Definición** | Antes de empezar (2 h) | Especificación de una página, guion de demo y conjunto de datos de ejemplo diseñado | El equipo aprueba la especificación |
| **1. Esqueleto desplegado** | Día 1, mañana | App vacía en producción, base de datos conectada, pruebas corriendo en cada subida | La URL pública carga y muestra un dato leído de la base |
| **2. Ingesta y modelo** | Día 1, tarde | Datos de GitHub y del conjunto de ejemplo cargados en el modelo | Una consulta devuelve los trabajos de una iniciativa con sus fuentes |
| **3. Capa de inteligencia** | Día 2, mañana | F1, F2 y F3 funcionando por API | Las 10 preguntas de control se responden bien y con cita |
| **4. Interfaz** | Día 2, tarde | Las tres vistas navegables con datos reales | Se recorre el guion de demo completo sin tocar código |
| **5. Demo** | Día 3, mañana | Presentación, vídeo de respaldo y versión congelada | Dos ensayos seguidos sin fallos dentro del tiempo |

### Etapa 0 — Definición (2 h, antes del hackathon)
- Acordar el problema en una frase y el usuario objetivo (jefe de área que pierde horas en reuniones de estado).
- Escribir el guion de demo **antes** del código: qué se enseña en cada minuto.
- Diseñar la empresa ficticia: 3 equipos, 12 personas, 4 iniciativas, 2 bloqueos plantados y 1 decisión sin dueño.
- Escribir las 10 preguntas de control con su respuesta correcta (sirven de examen en la etapa 3).
- Herramientas: skills `brainstorming` y `ask-questions-if-underspecified`; `engineering:architecture` para dejar la decisión de pila por escrito.

### Etapa 1 — Esqueleto desplegado (día 1, mañana)
- Crear el proyecto Next.js con `pnpm`, Tailwind y los componentes base.
- Conectar el repositorio a Vercel y crear la base de datos.
- Tablas iniciales: `personas`, `iniciativas`, `trabajos`, `eventos`, `decisiones`, `fuentes`.
- Prueba automática mínima y revisión en cada subida (GitHub Actions).
- Copiar a `Nexo/.claude/` los agentes y las reglas de TREISS, adaptados (sección 6).
- Herramientas: conector de Vercel, `gh`, skill `writing-plans` para el plan detallado de la etapa, agente `arquitecto`.

### Etapa 2 — Ingesta y modelo (día 1, tarde)
- Conector de GitHub: issues, pull requests, revisiones y comentarios de un repositorio.
- Cargador del conjunto de ejemplo (tareas, mensajes, actas de decisión) en formato JSON.
- Normalizar todo a `eventos` con autor, fecha, trabajo relacionado y enlace de origen.
- Reglas simples, sin IA, para lo que se puede calcular: días sin actividad, revisión pendiente, dependencia abierta.
- Pruebas primero en esta etapa: es la lógica donde un error invalida la demo.
- Herramientas: agente `backend-dev`, skill `test-driven-development`, agente `verificador` al cierre.

### Etapa 3 — Capa de inteligencia (día 2, mañana)
- F1: generar el reporte por iniciativa (hecho, en curso, en riesgo, decisiones pendientes) con citas.
- F2: clasificar cada señal de bloqueo (tipo, gravedad, quién desbloquea) y explicar el motivo.
- F3: responder preguntas recuperando solo los eventos relevantes del modelo.
- Examen: las 10 preguntas de control, corregidas a mano. Se anota el resultado real.
- Guardar respuestas en caché para que la demo no dependa de la red.
- Herramientas: skill `claude-api`, agente `backend-dev` con Opus, agente `revisor`.

### Etapa 4 — Interfaz (día 2, tarde)
- Vista **Reporte**: resumen por iniciativa, con citas que abren la fuente.
- Vista **Radar**: bloqueos ordenados por gravedad, con la cifra de horas ahorradas arriba.
- Vista **Preguntar**: caja de pregunta con tres ejemplos ya escritos.
- Prueba de recorrido completo del guion con el navegador automatizado.
- Herramientas: agente `frontend-dev`, skills `frontend-design` e `impeccable`, `design:design-critique`, `webapp-testing`.

### Etapa 5 — Demo (día 3, mañana)
- Congelar el código a primera hora: desde aquí solo se corrigen fallos del guion.
- Presentación de 5 diapositivas: problema (Sequoia), solución, demo, evidencia, siguiente paso.
- Grabar un vídeo de respaldo del recorrido completo.
- Dos ensayos cronometrados y lista de preguntas difíciles con respuesta preparada.
- Herramientas: `verification-before-completion`, `code-review`, skill de presentaciones, `design:ux-copy`.

---

## 6. Cómo trabajamos (flujo de TREISS, adaptado a 2 días y medio)

**Se mantiene**
- **Plan aprobado antes del código.** Cada etapa tiene su plan detallado (skill `writing-plans`) y se aprueba antes de escribir.
- **Agentes por rol:** `arquitecto` (diseña), `backend-dev` y `frontend-dev` (construyen), `revisor` (revisa antes de unir), `verificador` (corre las pruebas con memoria limpia), `documentador` (actualiza los documentos).
- **Trabajo en paralelo y aislado:** cada agente que escribe usa su propia copia del repositorio (skills `using-git-worktrees` y `subagent-driven-development`).
- **Punto de control al cierre de cada etapa:** el `verificador` informa del resultado real, sin arreglar nada.
- **Índice del código con CodeGraph** en cuanto exista código (fin de la etapa 1).

**Se relaja para el hackathon**
- La cobertura del 90 % no aplica. Pruebas obligatorias solo en ingesta, reglas de bloqueo y las 10 preguntas de control.
- La interfaz se verifica con el recorrido del guion, no con pruebas por componente.
- La documentación se limita a `docs/` y a un `CLAUDE.md` corto.

### Reparto sugerido con 3 personas

| Persona | Etapas 1–2 | Etapas 3–4 | Etapa 5 |
|---|---|---|---|
| A (datos) | Modelo e ingesta | Reglas de bloqueo y caché | Datos de demo estables |
| B (IA) | Conjunto de ejemplo y preguntas de control | F1, F2 y F3 | Preguntas difíciles |
| C (producto) | Esqueleto, despliegue y diseño base | Las tres vistas | Presentación y vídeo |

---

## 7. Conectores y permisos

| Herramienta | Estado | Uso en el plan |
|---|---|---|
| Vercel | Conectado | Despliegue, base de datos y registros de errores |
| GitHub (`gh`) | Sesión iniciada | Repositorio, ramas y fuente de datos real de la demo |
| Notion | Conectado | Opcional: segunda fuente real (documentos y actas) |
| Google Drive | Conectado | Opcional: material del hackathon y presentación |
| Slack, Linear, Asana, Atlassian, Figma | Sin autorizar | Solo si se quiere una fuente real más; se autorizan desde `/mcp` |

---

## 8. Riesgos y recortes

| Riesgo | Señal | Respuesta |
|---|---|---|
| La ingesta de GitHub se alarga | Etapa 2 sin cerrar al final del día 1 | Usar solo el conjunto de ejemplo y enseñar GitHub como "siguiente fuente" |
| Respuestas de IA incorrectas en la demo | Menos de 8 de 10 preguntas de control bien | Limitar F3 a preguntas sugeridas y servir desde caché |
| La red falla en la demo | — | Vídeo de respaldo y respuestas en caché |
| El alcance crece | Aparece una cuarta función | Va a la lista "después del hackathon" |
| El contexto real cambia el reto | Al leer las bases | Rehacer las secciones 1 y 2 antes de la etapa 0 |

**Orden de recorte si falta tiempo:** F3 libre → conexión real a GitHub → vista Preguntar → gráficos. F1 y F2 con datos de ejemplo no se recortan.

---

## 9. Qué falta para cerrar este plan
- [ ] El contenido del documento de contexto del hackathon (pegar el texto o compartirlo de nuevo).
- [ ] Fechas y horario exactos.
- [ ] Tamaño del equipo y quién hace qué.
- [ ] Criterios de evaluación del jurado.
- [ ] Confirmar la pila de la sección 4 y la decisión abierta sobre Python.
