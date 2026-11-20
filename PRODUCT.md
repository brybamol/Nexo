# Producto

<!-- impeccable:product-schema 1 -->

> Escrito por el agente de la tarea 4.6 a partir del encargo y de `docs/02`, `docs/03` y `docs/05`, sin entrevista con el equipo (el agente trabajaba sin canal de preguntas). Todo lo de aquí sale de esos documentos; lo que se dedujo va marcado como *(inferido)*.

## Platform

web

## Usuarios

- **Quien hace el trabajo** (técnicos y bodegueros de campo): usan Nexo desde el teléfono, con prisa y a veces con una sola mano. Escriben una frase para avisar de un problema y miran «Mi día» para saber qué les toca.
- **Quien responde por un resultado** (supervisora de bodega, jefe de operaciones): necesitan ver de un vistazo qué les pide Nexo, qué deben y qué está en riesgo, sin que nadie se lo reenvíe.
- **Quien decide** (gerente general): necesita decisiones preparadas con dos o tres opciones comparables, cada una con costo y consecuencia en fechas. No persigue a nadie.

## Propósito del producto

Nexo es la plataforma central de coordinación de una empresa mediana. Convierte una frase en un trabajo con un responsable y un plazo, da seguimiento por su cuenta, propaga bloqueos entre proyectos, escala por la cadena de jefes y prepara decisiones con costo. Tesis: **la plataforma persigue; el jefe solo decide.** Fallamos si un jefe tiene que abrir la herramienta, leer el estado y perseguir a alguien.

## Posicionamiento

No es un gestor de proyectos ni un tablero: es quien hace la coordinación. El gesto principal es la **captura** (una frase libre); los trabajos, avisos, escalamientos y decisiones salen de ahí. Un gestor de proyectos pide llenar campos; Nexo pide una frase y persigue el resto.

## Contexto de uso

- Empresa ficticia de la demo: **Frío del Valle**, refrigeración comercial en Costa Rica (instalaciones de cámaras frías, mantenimiento, repuestos, pedidos). Horario laboral de 7:00 a 17:00, hora de Costa Rica.
- Se presenta en una **demo de 4 minutos proyectada en pantalla grande** (1280–1920 px), con un reloj de demo que se adelanta a mano y un selector «ver como» para cambiar de persona. También debe usarse bien en un **teléfono de 375 px**.
- Guion: un técnico reporta un compresor faltante → la supervisora lo ve en «Mi día» → recordatorio y escalamiento → un aviso agrupado a otro técnico → la supervisora propone una compra → la gerente aprueba una de tres opciones → pregunta cómo van los pedidos → revisa proyectos y registro.

## Capacidades y restricciones

- Pantallas: `/mi-dia` (inicio), `/proyectos`, `/proyectos/[id]`, `/trabajos/[id]`, `/decisiones`, `/preguntar`, `/registro`. En todas: navegación, «ver como», reloj de la demo y caja de captura siempre visible (arriba en escritorio, fija abajo en teléfono).
- Vocabulario fijo: Proyecto, Trabajo, Responsable, Dependencia, Decisión, Acción. Estados solo **Abierto, En curso, Bloqueado, Resuelto**. Marcas calculadas **Atrasado** y **En riesgo**.
- Pila: Next.js (App Router), React 19, Tailwind CSS v4, TypeScript estricto. Sin fuentes descargadas ni imágenes externas: pila de fuentes del sistema.

## Compromisos de marca

- Nombre: **Nexo**. Todo en español (de Costa Rica: colones con «₡», fechas como «mié 25 nov, 7:05»).
- Carácter: herramienta operativa **serena, precisa y directa**; se siente como un buen jefe de operaciones, no como un tablero genérico de SaaS ni como otro gestor de proyectos.
- Nexo no recomienda en las decisiones: una opción propuesta por una persona se muestra como «Propuesta por…», nunca como «recomendada».
- La insignia de IA dice qué implementación respondió (Local, Claude o Local como respaldo).

## Evidencia disponible

- Datos de la demo en la semilla (`docs/04-empresa-y-casos-de-control.md`): personas, proyectos P1–P4, trabajos, repuestos y las tres opciones de la decisión (₡1.380.000, ₡1.140.000, ₡1.220.000).
- Las tres cifras de la demo (`docs/05` §5). La cifra de horas ahorradas es una **hipótesis**: siempre lleva «estimado» y la nota «Hipótesis de minutos, no medición».
- No hay clientes reales, testimonios ni mediciones: no se inventan.

## Principios del producto

1. **La captura primero.** Decir qué pasó en una frase es el gesto central; todo lo demás es consecuencia.
2. **Nexo persigue, la persona decide.** La interfaz muestra lo que Nexo ya hizo y lo que necesita de ti, no una lista para revisar.
3. **Comparar sin empujar.** Las opciones de una decisión se presentan iguales; nadie elige por la gerente.
4. **Cada afirmación con su fuente.** Avisos, respuestas y marcas enlazan al trabajo que las causa.
5. **Honestidad con los números.** Lo estimado se dice estimado.

## Accesibilidad e inclusión

- El significado nunca depende solo del color: estados y marcas llevan texto o icono además del color.
- Contraste AA, foco visible, navegación por teclado, `prefers-reduced-motion`, objetivos táctiles de al menos 44 px en teléfono *(inferido del uso con una mano en campo)*.
- Legible a distancia en un proyector *(inferido de la demo)*.
