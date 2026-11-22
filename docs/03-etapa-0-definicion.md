# Nexo — Etapa 0: definición

*Fecha: 20-11-2026 · Estado: borrador para aprobar · Pertenece a: `02-plan-mvp-hackathon.md` (v2)*

La etapa 0 se cierra cuando el equipo aprueba este documento y `04-empresa-y-casos-de-control.md`. No se escribe código antes.

---

## 1. Especificación en una página

**Problema.** En una empresa mediana, la información viaja de persona en persona. Los supervisores dedican buena parte del día a pasar mensajes y el gerente se entera tarde.

**Usuario.** Tres perfiles, los tres dentro de la demo:
- **Quien hace el trabajo** (técnico, bodeguero): necesita avisar de un problema sin llenar nada.
- **Quien responde por un resultado** (supervisora, jefe de operaciones): necesita saber qué le toca sin que nadie se lo reenvíe.
- **Quien decide** (gerente): necesita decisiones preparadas, no una lista de pendientes ajenos.

**Solución.** Una plataforma web donde viven los trabajos y proyectos, y que hace ella misma la coordinación: convierte frases en trabajos, da seguimiento, detecta bloqueos, escala y prepara las decisiones.

**La prueba.** Si un jefe tiene que abrir la herramienta, leer el estado y perseguir a alguien, fallamos. Si la plataforma persigue y el jefe solo decide, acertamos.

**Qué se demuestra en el hackathon.** Un bloqueo real de la operación recorre toda la empresa, desde el técnico hasta la decisión del gerente, sin que nadie reenvíe un mensaje.

---

## 2. Vocabulario del producto

Estas palabras se usan igual en la interfaz, en el código y en la presentación.

| Término | Significado |
|---|---|
| **Proyecto** | Un resultado que la empresa quiere lograr, con un responsable y una fecha |
| **Trabajo** | Una pieza concreta de un proyecto, con un único responsable y un plazo |
| **Responsable** | La persona que responde por el resultado de un trabajo o proyecto. Siempre es una sola |
| **Dependencia** | Un trabajo que no puede avanzar hasta que otro se resuelva, o hasta que haya un repuesto |
| **Decisión** | Algo con costo que Nexo no ejecuta por su cuenta: lo prepara y espera aprobación |
| **Acción** | Cualquier cosa que hizo Nexo (crear, avisar, preguntar, escalar), con su motivo |

**Estados de un trabajo:** Abierto, En curso, Bloqueado y Resuelto. No hay más.

**Marcas calculadas** (no son estados, Nexo las pone y las quita solo):
- **Atrasado:** el plazo venció y el trabajo no está resuelto.
- **En riesgo:** depende, directa o indirectamente, de un trabajo bloqueado o atrasado, o necesita un repuesto sin existencia o reportado como faltante.

---

## 3. Reglas de coordinación

Son la lógica de la etapa 3. Los tiempos son los de la demo; en un cliente real se configuran.

| # | Regla | Detalle |
|---|---|---|
| R1 | **Seguimiento por plazo** | Al vencer el plazo de un trabajo sin resolver, Nexo pide el estado a su responsable |
| R2 | **Recordatorio** | Un trabajo urgente sin respuesta en 30 minutos recibe un recordatorio. Uno normal, en 4 horas laborales |
| R3 | **Escalamiento** | El camino sigue al trabajo, no a los cargos. Pasado otro intervalo igual sin respuesta, Nexo escala al **responsable del proyecto** del trabajo (el dueño del resultado), con quién lo pidió, qué bloquea, desde cuándo y lo que puede hacer: reasignarlo, mover el plazo o declararlo bloqueado. Si tampoco actúa (o es el mismo responsable del trabajo), el segundo y último nivel va a quienes salen perjudicados: los responsables de los **otros proyectos** con trabajos en riesgo o bloqueados por ese trabajo, uno por persona; si no hay ninguno, al **responsable de la operación**. Nunca al propio responsable ni dos veces a la misma persona. El jefe directo no interviene |
| R4 | **Propagación** | Cuando un trabajo queda bloqueado, Nexo marca "en riesgo" los que dependen de él, en cadena, y los que necesitan el mismo repuesto sin existencia o reportado como faltante |
| R5 | **Un aviso por persona** | Si un mismo hecho afecta a varios trabajos de una persona, recibe un solo aviso agrupado |
| R6 | **Costo** | Toda compra, gasto o cambio de fecha comprometida con un cliente es una decisión. Si el costo máximo de sus opciones no supera ₡100.000, decide el **responsable del proyecto** de la decisión; por encima, la gerente general. Nadie aprueba su propia propuesta: si quien propone es quien debería decidir, sube un nivel (dentro del tope, al responsable de la operación; si también es quien propone, a la gerente general) |
| R7 | **Decisión preparada** | Una decisión llega con: qué pasó, a quién afecta, de dos a tres opciones con costo y consecuencia en fechas, y quién la propuso |
| R8 | **Después de decidir** | Al aprobar, Nexo crea el trabajo de ejecución con responsable y plazo, actualiza las fechas afectadas, quita las marcas de riesgo y avisa a los afectados. Al rechazar, avisa a quien la propuso con el motivo |
| R9 | **Sin responsable no hay trabajo** | Si Nexo no puede deducir el responsable, propone uno y lo pregunta. Hace una sola pregunta por captura |
| R10 | **Registro** | Cada acción de Nexo queda guardada con su motivo y el hecho que la originó |

**Horario laboral de la demo:** lunes a viernes, de 7:00 a 17:00, hora de Costa Rica.

---

## 4. Guion detallado de la demo

"Hoy" en la demo es el **miércoles 25 de noviembre de 2026, 7:00**. Los nombres y los trabajos están en `04-empresa-y-casos-de-control.md`.

| # | Minuto | Reloj de la demo | Ver como | Qué se hace | Qué debe mostrar Nexo |
|---|---|---|---|---|---|
| 1 | 0:00 | — | — | Diapositiva del problema | — |
| 2 | 0:20 | 7:05 | José Alfaro, técnico | Escribe: "No puedo terminar la instalación en La Colina, falta el compresor de 2 HP" | Trabajo nuevo en el proyecto La Colina, responsable Lucía Mora, plazo hoy 12:00, urgente. El trabajo T04 pasa a Bloqueado |
| 3 | 1:00 | 7:06 | Lucía Mora, supervisora de bodega | Abre "Mi día" | El trabajo nuevo arriba, con quién lo pidió y qué bloquea. También su trabajo atrasado T15 |
| 4 | 1:30 | 7:35 → 8:05 | (botón del reloj) | Se adelanta el reloj dos veces | Recordatorio a Lucía; después, escalamiento a Esteban Castro, responsable de La Colina, con quién lo pidió, qué bloquea y desde cuándo, y las tres acciones que puede hacer: reasignar, mover el plazo o declarar bloqueo. El jefe directo de Lucía no recibe nada |
| 5 | 1:50 | 8:06 | Mario Chaves, técnico | Abre "Mi día" | Un solo aviso para dos proyectos: T05 (La Colina) y T11 (Trigal) están en riesgo por el mismo compresor. Nexo cita la causa: el conteo sin conciliar (T15) |
| 6 | 2:15 | 8:10 | Lucía Mora | Escribe: "No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local" | Nexo reconoce que tiene costo y crea una decisión para la gerente general |
| 7 | 2:45 | 8:12 | Marcela Solís, gerente general | Abre "Decisiones" y aprueba la opción A | Tres opciones con costo y fechas. Al aprobar: trabajo de compra para Karla Jiménez, avisos a los afectados, marcas de riesgo retiradas y T04 con fecha de solución hoy 15:00 |
| 8 | 3:10 | 8:13 | Marcela Solís | Pregunta: "¿Cómo vamos con los pedidos de la semana?" | Respuesta con las cifras de los 7 pedidos y enlaces a cada uno |
| 9 | 3:35 | 8:14 | Marcela Solís | Abre la vista de proyectos y el registro | Las tres cifras y la lista de acciones de Nexo |
| 10 | 3:50 | 8:20 | Ricardo Brenes, contabilidad y facturación | Pulsa «Siguiente evento» (llega un correo de Andrés) y abre Correo | Nexo leyó el correo de Andrés y creó solo el trabajo «Emitir la factura proforma de la cámara fría del Hotel Mirador» (PEDIDOS-14), confirmado porque lo vieron los dos buzones y dependiente de la cotización de Paola (PEDIDOS-10). Nadie escribió nada y nadie recibió un aviso |
| 11 | 4:05 | 8:21 | Ricardo Brenes | Abre "Mi día": confirma la propuesta de las guías y pulsa «Sí, lo recibí» | La propuesta que Nexo sacó de su buzón (PEDIDOS-13, una fuente, ya entregada por Diego Rojas) queda confirmada y, al dar por recibida la entrega, Resuelta. Diego recibe el aviso de que Ricardo la recibió |
| 12 | 4:20 | 8:22 | Esteban Castro, supervisor de campo | Abre "Mi día" y corrige el plazo de la propuesta de las fotos al jueves 26, 17:00 | La propuesta (TRIGAL-7) queda confirmada con el plazo corregido; Daniela Quesada recibe la asignación |
| 13 | 4:35 | 8:23 | Marcela Solís | Abre Registro y Correo | Las tres cifras (7 de 9 cerrados sin la gerente, 21 seguimientos, 3,8 h estimadas), la tasa de corrección de Nexo (de 2 propuestas revisadas, 1 confirmada y 1 corregida: 50 %) y el cuello de botella: Lucía Mora |
| 14 | 4:50 | — | — | Cierre: "La gerente tomó una decisión. No persiguió a nadie, y nadie le escribió una tarea a Nexo" | — |

Los pasos 10–13 salen de las reformas v2 (`08-reformas-v2.md` §7.2): la demo arranca con los 8 buzones de la demo conectados, y al pasar a las 7:05 («+5 min») Nexo ya leyó el correo; las propuestas que sacó de él solo las ven sus dueños y no cambian nada de lo que muestran los pasos 2–9.

**Las tres opciones de la decisión** (paso 7), tal como deben aparecer:

| Opción | Compra | Costo | Consecuencia |
|---|---|---|---|
| A | 3 compresores al proveedor local, entrega hoy 15:00 | ₡1.380.000 | La Colina se entrega el viernes 27 y Trigal se atiende el jueves 26, como estaba previsto |
| B | 3 compresores al proveedor habitual, llegan el martes 1 de diciembre | ₡1.140.000 | La Colina se entrega el jueves 3 de diciembre; los dos locales de Trigal pasan al martes 1 de diciembre |
| C | 1 al proveedor local y 2 al habitual | ₡1.220.000 | La Colina se entrega a tiempo; los dos locales de Trigal pasan al martes 1 de diciembre |

Nexo presenta las opciones y sus consecuencias. No elige por la gerente.

---

## 5. Cómo se calculan las cifras de la demo

| Cifra | Cálculo | Naturaleza |
|---|---|---|
| Trabajos cerrados sin intervención del gerente | Trabajos resueltos sin ninguna acción de la gerente general, sobre el total de resueltos | Dato real de la plataforma |
| Seguimientos hechos por Nexo | Número de acciones de tipo pregunta, recordatorio, escalamiento y aviso | Dato real de la plataforma |
| Horas de coordinación ahorradas por semana | Seguimientos de Nexo × 10 minutos, más preguntas respondidas × 15 minutos | **Estimación.** Los minutos son una hipótesis nuestra, no una medición |

La tercera cifra se muestra con la palabra "estimado" en pantalla. Si el jurado pregunta, la respuesta es que el piloto de 6 semanas del Plan de arranque existe para medirla.

---

## 6. Ajustes al plan v2 que salen de esta definición

- **Nueva tabla `repuestos`** (nombre, existencia, y precio y plazo de entrega por proveedor) y un campo "necesita" en cada trabajo. Hacen que la detección de dependencias por repuesto y el costo de las opciones sean exactos y no dependan de la IA.
- **Proyecto "Operación diaria"** para los trabajos sueltos que no pertenecen a ningún proyecto.
- **En el guion, la compra aprobada no desbloquea T04 al instante:** le pone fecha de solución. T04 vuelve a En curso cuando llega el compresor.
- **Estados y marcas** quedan fijados como en la sección 2.
- **Umbral de costo** fijado en ₡100.000 (regla R6).
- **Reforma de escalamiento** (aprobada por el dueño del producto después de la versión 2): el escalamiento (R3) y el decisor del gasto (R6) siguen al trabajo y a su proyecto, no al organigrama. Quien recibe un escalamiento, y siempre el responsable del proyecto y el responsable de la operación, puede reasignar el trabajo, mover su plazo o declararlo bloqueado desde la interfaz. La gerente solo aparece en decisiones por encima del tope. Las cifras del guion no cambian.

---

## 7. ADR-001: el servidor vive dentro de Next.js

**Estado:** Propuesto
**Fecha:** 20-11-2026
**Deciden:** Bryan y el equipo del hackathon

### Contexto
Hay 2 días y medio para llegar a una demo en vivo. El equipo conoce dos pilas por TREISS: Next.js en el frontend y FastAPI con SQLAlchemy en el backend. El conector de Vercel está activo en Claude; el despliegue de TREISS en AWS con Docker no está pensado para montarse en horas.

### Decisión
Un solo proyecto Next.js con TypeScript, desplegado en Vercel. Las rutas de API, el motor de reloj y las llamadas a Claude viven en el mismo proyecto. La base de datos es PostgreSQL gestionado.

### Opciones consideradas

**Opción A: todo en Next.js sobre Vercel**

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja: un repositorio, un despliegue, un lenguaje |
| Coste | Planes gratuitos o de bajo coste durante el hackathon |
| Escalabilidad | Suficiente para la demo y para los primeros pilotos |
| Familiaridad del equipo | Alta en el frontend; media en rutas de API con TypeScript |

- A favor: vista previa por cada rama, tareas programadas incluidas, sin servidores que administrar.
- En contra: no se reutilizan los patrones de `treiss_backend`; las tareas largas tienen límite de tiempo de ejecución.

**Opción B: Next.js más un servicio FastAPI aparte**

| Dimensión | Valoración |
|---|---|
| Complejidad | Media: dos despliegues, CORS y dos juegos de variables de entorno |
| Coste | Un servicio de alojamiento adicional |
| Escalabilidad | Mejor para procesos largos y trabajo en segundo plano |
| Familiaridad del equipo | Alta en ambos lados |

- A favor: se reutilizan patrones de TREISS (SQLAlchemy, Pydantic, pruebas con pytest).
- En contra: medio bloque de la etapa 1 se va en montar y conectar el segundo servicio; dos sitios donde puede fallar la demo.

### Análisis
En un hackathon el recurso escaso es el tiempo, y la opción B gasta cerca del 10 % del total en infraestructura que el jurado no ve. La lógica de Nexo (reglas de plazo, dependencias, llamadas a Claude) no necesita nada que solo ofrezca Python. La ventaja real de B, los procesos largos, no aplica: el motor de reloj trabaja en pasos cortos.

### Consecuencias
- Más fácil: desplegar, enseñar avances por rama y recuperar una versión anterior.
- Más difícil: reutilizar código del backend de TREISS.
- A revisar después del hackathon: si Nexo incorpora ingesta pesada (WhatsApp, ERP), un servicio aparte en Python vuelve a tener sentido.

### Acciones
1. [ ] Bryan confirma o cambia la decisión.
2. [ ] Si se confirma, la etapa 1 arranca con `pnpm create next-app` y la conexión a Vercel.

---

## 8. Lista de aprobación de la etapa 0

- [ ] La especificación y la prueba (sección 1).
- [ ] El vocabulario, los estados y las marcas (sección 2).
- [ ] Las reglas de coordinación y sus tiempos (sección 3).
- [ ] El guion y las tres opciones de la decisión (sección 4).
- [ ] La forma de calcular las cifras (sección 5).
- [ ] ADR-001 (sección 7).
- [ ] La empresa ficticia y los casos de control (`04-empresa-y-casos-de-control.md`).
- [ ] Datos que solo tiene el equipo: fechas del hackathon, número de personas y criterios del jurado.
