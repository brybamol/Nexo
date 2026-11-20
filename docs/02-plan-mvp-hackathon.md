# Nexo — Plan del MVP para el hackathon (v2)

*Fecha: 20-11-2026 · Estado: borrador para aprobar · Duración: 2 días y medio (5 bloques de medio día)*

Base: la exploración (`01-exploracion.md`) y el documento "Plan de arranque: startup de coordinación inteligente".
Cambio respecto a la v1: Nexo pasa de ser un agente en WhatsApp a ser **la plataforma central de coordinación de la empresa**. WhatsApp queda como canal secundario, fuera del MVP.

---

## 1. Qué construimos

**Nexo es la plataforma donde viven los trabajos y proyectos de la empresa, y que hace ella misma la coordinación.** Asigna, da seguimiento, detecta bloqueos, escala y prepara las decisiones. Las personas hacen el trabajo y deciden; nadie hace de mensajero.

### La prueba que separa a Nexo de un gestor de proyectos

> Si un jefe todavía tiene que abrir la herramienta, leer el estado y perseguir a alguien, es un gestor de proyectos.
> Si la plataforma persigue, avisa y escala, y el jefe solo decide, es lo que describe Sequoia.

Todo el alcance del MVP se decide con esta prueba. Una función que solo muestra información no entra.

| | Gestor de proyectos (Asana, Monday, ClickUp, Notion) | Nexo |
|---|---|---|
| Cómo entra el trabajo | Alguien rellena una tarjeta | Alguien escribe una frase y Nexo arma el trabajo |
| Quién da seguimiento | Un jefe mira el tablero y pregunta | Nexo pregunta al responsable cuando toca |
| Qué pasa con un atraso | Se ve en rojo si alguien mira | Nexo escala con el contexto completo |
| Dependencias entre áreas | Las descubre una reunión | Nexo las detecta y avisa a los afectados |
| Decisiones | Llegan al jefe sin preparar | Llegan con contexto, opciones y coste |

### Las cinco funciones del MVP

| # | Función | Qué ve el jurado |
|---|---|---|
| F1 | **Captura en una frase** | Alguien escribe "no puedo terminar la instalación, falta el repuesto" y Nexo crea el trabajo con proyecto, responsable, plazo y dependencias. Solo pregunta lo que falta |
| F2 | **Coordinación automática** | Nexo pide el estado al responsable cuando vence el plazo, detecta qué otros trabajos quedan bloqueados y escala si nadie responde |
| F3 | **Mi día** | Cada persona abre Nexo y ve lo que debe, lo que espera de otros y qué cambió desde ayer. Nadie se lo tuvo que contar |
| F4 | **Decisiones** | Lo que tiene costo llega al gerente como una decisión preparada: contexto, opciones y a quién afecta. Aprueba o rechaza con un clic, y cada acción de Nexo queda registrada |
| F5 | **Preguntar** | "¿Cómo vamos con los proyectos de la semana?", respondido con los trabajos de origen |

La **vista de proyectos** (lo abierto, atrasado y resuelto) existe, pero es una ventana al modelo, no el producto.

### Fuera del MVP
- WhatsApp, correo y otros canales de entrada o aviso (ver sección 8).
- Integración con ERP, hojas de cálculo o calendarios.
- Cuentas de usuario y permisos: la demo usa un selector "ver como" con las personas de la empresa ficticia.
- Varias empresas a la vez y app móvil.
- Diagramas de Gantt, informes y gráficos de gestión.
- Todo lo de negocio del Plan de arranque (precios, legal, ventas): va en la presentación.

### Las cifras de la demo
Visibles en la plataforma, calculadas con los datos de la demo:
- **Trabajos cerrados sin intervención del gerente**, sobre el total (meta del Plan de arranque: 50 %).
- **Seguimientos que hizo Nexo en lugar de una persona.**
- **Horas de coordinación ahorradas por semana**, con la línea base del Plan de arranque (10 supervisores que pierden 1 hora diaria).

---

## 2. Guion de la demo (4 minutos)

Se escribe antes que el código y manda sobre el alcance. La empresa es una distribuidora ficticia de Costa Rica con tres áreas: oficina, bodega y campo.

| Minuto | Qué pasa | Función |
|---|---|---|
| 0:00 | El problema en una frase: en esta empresa todo pasa por el gerente y se entera tarde | — |
| 0:20 | Un técnico escribe una frase: no puede terminar una instalación porque falta un repuesto. Nexo crea el trabajo, lo cuelga del proyecto correcto y nombra responsable a la supervisora de bodega | F1 |
| 1:00 | La supervisora abre "Mi día": el trabajo ya está ahí, con el contexto. Nadie le reenvió nada | F3 |
| 1:30 | Se adelanta el reloj: sin respuesta. Nexo le pide el estado, detecta que el mismo repuesto bloquea dos trabajos de otro proyecto y avisa a sus responsables | F2 |
| 2:15 | La supervisora propone una compra urgente. Como tiene costo, Nexo la convierte en una decisión preparada para el gerente | F4 |
| 2:45 | El gerente aprueba con un clic. Nexo avisa a todos, crea el trabajo de compra y los trabajos afectados quedan con fecha de solución | F4 |
| 3:10 | El gerente pregunta cómo van los proyectos de la semana y recibe la respuesta con sus fuentes | F5 |
| 3:35 | Vista de proyectos, registro de acciones y las tres cifras. Cierre: el gerente tomó una decisión y no persiguió a nadie | — |

---

## 3. Cómo funciona

| Pieza (ensayo de Sequoia) | En Nexo | Etapa |
|---|---|---|
| Modelo de la empresa | Base de datos con personas y áreas, proyectos, trabajos, dependencias y el historial de todo lo que pasó | 1 y 2 |
| Capa de inteligencia | Claude convierte frases en trabajos, decide a quién avisar y cuándo escalar, prepara decisiones y responde preguntas | 2 y 3 |
| Interfaces | La plataforma web: Captura, Mi día, Decisiones, Proyectos y Preguntar | 4 |
| Roles del ensayo | Cada trabajo tiene **un único responsable** de su resultado; el gerente solo aparece en las decisiones | 2 |

**Cuatro reglas del producto**
1. **Nadie rellena formularios.** El trabajo entra con una frase; Nexo completa el resto y pregunta solo lo que no puede deducir.
2. **Un responsable por trabajo.** Sin responsable, Nexo no lo deja abierto: propone uno o lo pregunta.
3. **Nada con costo se ejecuta sin aprobación humana**, y cada acción de Nexo queda registrada con su motivo.
4. **Si no hay dato, Nexo dice "no lo sé"** en lugar de inventar.

---

## 4. Pila técnica (la que ya se usa en TREISS)

| Capa | Elección | Motivo |
|---|---|---|
| Plataforma web | Next.js + TypeScript + Tailwind + componentes Radix/shadcn + TanStack Query, con `pnpm` | Es la pila de `treiss_frontend` |
| Servidor | Rutas de API dentro del mismo proyecto Next.js | Un solo despliegue. FastAPI, la pila de `treiss_backend`, exigiría montar un servidor aparte |
| Base de datos | PostgreSQL gestionado, contratado desde el marketplace de Vercel | Mismo motor que TREISS |
| IA | API de Claude: `claude-opus-5-5` para preparar decisiones y responder preguntas, `claude-haiku-5-5` para convertir frases en trabajos | Calidad donde se ve, rapidez en la captura |
| Tareas programadas | Tareas programadas de Vercel, más un botón "adelantar el reloj" para la demo | Los seguimientos y escalamientos no pueden esperar horas en una demo |
| Despliegue y código | Vercel y GitHub `brybamol/Nexo` | El conector de Vercel y `gh` ya funcionan |

Ya no hace falta Twilio ni ninguna cuenta externa nueva, que era el mayor riesgo técnico de la v1.

**Decisión abierta:** si el equipo prefiere Python para el servidor, se usa FastAPI. Cuesta medio bloque de despliegue en la etapa 1.

---

## 5. Etapas

Cada etapa termina con algo que se puede enseñar. Si una se atrasa, se recorta su alcance, no la siguiente.

| Etapa | Cuándo | Entregable | Se da por cerrada cuando |
|---|---|---|---|
| **0. Definición** | Antes de empezar (2–3 h) | Guion aprobado, empresa ficticia y casos de control | El equipo aprueba el guion |
| **1. Esqueleto desplegado** | Día 1, mañana | Plataforma en producción con el modelo y los datos de ejemplo | En la URL pública se ven los proyectos y trabajos de la empresa ficticia |
| **2. Captura** | Día 1, tarde | F1 completo y vista de proyectos | 12 de las 15 frases de control crean el trabajo correcto |
| **3. Coordinación** | Día 2, mañana | F2 y la preparación de decisiones | Los 5 escenarios de control se resuelven solos al adelantar el reloj |
| **4. Vistas por persona** | Día 2, tarde | F3, F4 y F5 | Se recorre el guion entero sin tocar código |
| **5. Demo** | Día 3, mañana | Presentación, vídeo de respaldo y versión congelada | Dos ensayos seguidos sin fallos y dentro del tiempo |

### Etapa 0 — Definición (antes del hackathon)
- Aprobar el guion de la sección 2 y la prueba de la sección 1.
- Diseñar la empresa ficticia: 12 personas con rol y área, 4 proyectos y unos 30 trabajos con sus dependencias.
- Escribir 15 frases de control: texto de entrada y resultado esperado (proyecto, responsable, plazo, si tiene costo).
- Escribir 5 escenarios de control de coordinación: qué pasa, cuándo debe preguntar Nexo, cuándo escalar y a quién.
- Herramientas: skills `brainstorming` y `ask-questions-if-underspecified`; `engineering:architecture` para dejar por escrito la decisión de pila.
- **Detalle:** `03-etapa-0-definicion.md` y `04-empresa-y-casos-de-control.md`.

### Etapa 1 — Esqueleto desplegado (día 1, mañana)
- Crear el proyecto Next.js con `pnpm`, Tailwind y componentes base; conectarlo a Vercel.
- Crear la base de datos y las tablas: `personas`, `proyectos`, `trabajos`, `dependencias`, `repuestos`, `eventos`, `acciones`, `decisiones`.
- Cargar la empresa ficticia y añadir el selector "ver como".
- Lista sencilla de proyectos y trabajos, de solo lectura.
- Prueba automática mínima en cada subida (GitHub Actions).
- Copiar a `Nexo/.claude/` los agentes y las reglas de TREISS, adaptados (sección 6).
- Herramientas: conector de Vercel, `gh`, skill `writing-plans`, agente `arquitecto`.

### Etapa 2 — Captura (día 1, tarde)
- Caja de captura siempre visible: una frase libre.
- Claude propone proyecto, responsable, plazo, dependencias y si tiene costo, usando el modelo de la empresa.
- Si falta un dato, Nexo hace una sola pregunta concreta; la persona confirma con un clic.
- Vista de proyectos: abierto, atrasado y resuelto.
- Pasar las 15 frases de control y anotar el resultado real.
- Herramientas: skill `claude-api`, agentes `backend-dev` y `frontend-dev`, skill `test-driven-development` para las reglas de asignación.

### Etapa 3 — Coordinación (día 2, mañana)
- Motor de reloj: al vencer un plazo, Nexo pide el estado al responsable.
- Escalamiento: sin respuesta en el tiempo acordado, sube al siguiente responsable con el contexto.
- Dependencias: al bloquearse un trabajo, Nexo marca los que dependen de él y avisa a sus responsables.
- Decisiones: si una propuesta tiene costo, Nexo redacta la decisión con contexto, opciones y afectados.
- Botón "adelantar el reloj" y registro de cada acción con su motivo.
- Pruebas primero en esta etapa: es la lógica que demuestra la tesis.
- Herramientas: agente `backend-dev` con Opus, skill `test-driven-development`, agentes `revisor` y `verificador`.

### Etapa 4 — Vistas por persona (día 2, tarde)
- **Mi día:** lo que debo, lo que espero de otros y qué cambió.
- **Decisiones:** bandeja del gerente con aprobar y rechazar; al aprobar se desbloquean los trabajos.
- **Preguntar:** respuesta con enlaces a los trabajos de origen.
- Las tres cifras de la demo en la vista de proyectos.
- Recorrido automático del guion en el navegador.
- Herramientas: agente `frontend-dev`, skills `frontend-design` e `impeccable`, `design:design-critique`, `webapp-testing`.

### Etapa 5 — Demo (día 3, mañana)
- Congelar el código a primera hora; desde aquí solo se corrigen fallos del guion.
- Presentación de 6 diapositivas: problema (Sequoia), por qué un gestor de proyectos no lo resuelve, demo, cliente y mercado, modelo de negocio, plan de 90 días.
- Grabar el vídeo de respaldo y guardar las respuestas del guion para no depender de la red.
- Dos ensayos cronometrados y respuestas preparadas a las preguntas difíciles: en qué se diferencia de Asana con IA, quién carga los datos, miedo a despidos.
- Herramientas: `verification-before-completion`, `code-review`, skill de presentaciones, `design:ux-copy`.

---

## 6. Cómo trabajamos (flujo de TREISS, adaptado)

**Se mantiene**
- **Plan aprobado antes del código.** Cada etapa tiene su plan detallado (skill `writing-plans`), que se aprueba antes de escribir.
- **Agentes por rol:** `arquitecto` (diseña), `backend-dev` y `frontend-dev` (construyen), `revisor` (revisa antes de unir), `verificador` (corre las pruebas con memoria limpia) y `documentador` (actualiza los documentos).
- **Trabajo en paralelo y aislado:** cada agente que escribe usa su propia copia del repositorio (skills `using-git-worktrees` y `subagent-driven-development`).
- **Punto de control al cierre de cada etapa:** el `verificador` informa del resultado real, sin arreglar nada.
- **Índice del código con CodeGraph** desde el final de la etapa 1.

**Se relaja para el hackathon**
- La cobertura del 90 % no aplica. Pruebas obligatorias solo en las reglas de asignación, el motor de reloj, las dependencias y los casos de control.
- Las vistas se verifican con el recorrido del guion, no con pruebas por componente.
- La documentación se limita a `docs/` y a un `CLAUDE.md` corto.

### Reparto sugerido con 3 personas

| Persona | Etapas 1–2 | Etapas 3–4 | Etapa 5 |
|---|---|---|---|
| A (modelo y motor) | Tablas, datos de ejemplo y reglas de asignación | Reloj, escalamiento y dependencias | Datos de demo estables |
| B (IA) | Empresa ficticia, casos de control y captura | Decisiones preparadas y Preguntar | Preguntas difíciles |
| C (producto) | Esqueleto, despliegue y vista de proyectos | Mi día, Decisiones y cifras | Presentación y vídeo |

---

## 7. Conectores y permisos

| Herramienta | Estado | Uso en el plan |
|---|---|---|
| Vercel | Conectado | Despliegue, base de datos, tareas programadas y registros de errores |
| GitHub (`gh`) | Sesión iniciada | Repositorio y ramas |
| Google Drive | Conectado | Presentación y material del hackathon |
| Notion | Conectado | Opcional: notas del equipo |
| Slack, Linear, Asana, Atlassian, Figma | Sin autorizar | No hacen falta para este MVP |

---

## 8. Canales secundarios (después del hackathon)

La plataforma es el centro; los canales llevan el trabajo hacia ella y los avisos hacia las personas.

- **WhatsApp como entrada y aviso.** Es probable que vuelva para el producto real: el Plan de arranque señala la adopción como el mayor riesgo, y los técnicos y bodegueros ya viven en WhatsApp.
- **Lo aprendido en la v1.** La API oficial de grupos exige una cuenta verificada por Meta y solo funciona con grupos creados desde la API. La conversación 1 a 1 sí es viable desde el primer día.
- **Si sobra tiempo en el hackathon:** un aviso por correo cuando Nexo escala. No se empieza antes de cerrar la etapa 4.

---

## 9. Riesgos y recortes

| Riesgo | Señal | Respuesta |
|---|---|---|
| El jurado lo ve como "otro gestor de proyectos" | En los ensayos preguntan en qué se diferencia de Asana | La demo abre con la captura y cierra con "el gerente no persiguió a nadie"; la vista de proyectos sale al final |
| La captura asigna mal un trabajo en vivo | Menos de 12 de 15 frases de control bien | Limitar la demo a las frases del guion, con respuestas guardadas |
| El motor de coordinación se alarga | Etapa 3 sin cerrar al mediodía del día 2 | Dejar seguimiento y escalamiento; las dependencias entre proyectos se muestran con datos preparados |
| La red del lugar falla | — | Vídeo de respaldo y respuestas guardadas |
| El alcance crece | Aparece una sexta función o un canal | Va a la sección 8 |

**Orden de recorte si falta tiempo:** F5 con preguntas libres → cifras calculadas en vivo → detección automática de dependencias → Mi día (se sustituye por la vista de proyectos filtrada por persona). F1, el seguimiento con escalamiento y las decisiones no se recortan: son la tesis.

---

## 10. Qué falta para cerrar este plan
- [ ] Fechas y horario del hackathon.
- [ ] Tamaño del equipo y quién hace qué.
- [ ] Criterios de evaluación y formato de la presentación.
- [ ] Industria definitiva de la empresa ficticia (el Plan de arranque la deja como pregunta abierta).
- [ ] Confirmar la pila de la sección 4 y la decisión abierta sobre Python.
- [ ] Actualizar las secciones "Producto" y "Competencia y diferenciación" del Plan de arranque, que siguen describiendo a Nexo como nativo de WhatsApp.

## Fuentes
- Jack Dorsey y Roelof Botha, *From Hierarchy to Intelligence*, Sequoia Capital: https://sequoiacap.com/article/from-hierarchy-to-intelligence
- Plan de arranque: startup de coordinación inteligente (documento del equipo, 20-11-2026).
- API de grupos de WhatsApp, documentación de Meta: https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/
