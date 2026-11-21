---
version: 1
slug: "src-app-layout-tsx"
primary_target: "src/app/layout.tsx"
related_targets: ["src/app","src/componentes"]
---

# Superficie: aplicación Nexo (todas las pantallas del marco común)

Modo: Operate. Construcción en código (code-led). Sin generación de imágenes.

Audiencia y tarea: técnicos y bodegueros en teléfono (capturar una frase, ver Mi día), supervisores (qué les pide Nexo, qué está en riesgo), gerente (comparar tres opciones y decidir). Se proyecta en una demo de 4 minutos y se usa a 375 px.

Restricciones: solo marcado, clases y CSS; fuentes Space Grotesk e Inter autoalojadas con next/font; sin imágenes externas; estados y marcas con texto e icono además del color; «estimado» en las horas; «Propuesta por…», nunca «recomendada»; controles de la demo separados y etiquetados DEMO.

Dirección: fijada por el fundador (identidad Nexo 3.0 «Enterprise Tech», `docs/marca/`). Sustituye por completo la dirección anterior («rotulación de bodega»). No hubo tirada: la marca nombra mundo, paleta, tipografías, logo y estructura.

## Direction contract

THESIS: Nexo es la sala de coordinación de la empresa en su propia marca: un marco Navy que guarda la navegación y la frase, y una mesa clara donde se lee el trabajo. Rechaza el tablero SaaS gris de tarjetas iguales y la estética de chatbot.

OWN-WORLD: barra lateral Core Navy con el lockup de la N de cintas; banda de captura Surface Navy con campo blanco y botón Mint de texto Navy; mesa Canvas White con tarjetas blancas, bordes finos y sombras suaves; Signal Blue en acciones, foco y datos activos; Space Grotesk en títulos, códigos y cifras; Inter en todo lo demás; tres registros visuales: lo que Nexo propone (tinte Mint con el isotipo), lo que una persona aprueba (azul) y lo ejecutado o registrado (verde con marca de verificación).

STORY: quien entra ve primero qué le pide Nexo y qué está en riesgo, entiende que Nexo ya persiguió por él y actúa: escribe una frase, responde un seguimiento o aprueba una opción.

FIRST VIEWPORT: escritorio (≥1024 px): barra lateral Navy de 264 px con lockup arriba, navegación con iconos y, abajo, el panel DEMO (ver como, reloj, +5/+30/Siguiente evento, Reiniciar demo) con contorno discontinuo; a la derecha, la banda de captura Surface Navy a todo el ancho con el campo grande y «Enviar» en Mint; debajo el título de la pantalla y «Nexo te pide». Teléfono: cabecera Navy con lockup, pestañas, franja DEMO desplazable; la captura fija abajo.

FORM: identidad de marca aprobada aplicada a la aplicación existente; seed: none (pinned) — «estilo tecnológico + corporativo equilibrado, paleta de seis colores, estética minimalista, logo en N entrelazada» (docs/marca/BRAND_BRIEF.md) y «barra lateral Navy en escritorio con el lockup arriba; navegación simplificada en teléfono» (encargo del fundador).

Movimiento firma: la tarjeta de resultado de la captura entra en 220 ms (opacidad y 6 px) y el código del trabajo creado recibe un anillo Mint que se apaga en 600 ms; sin movimiento con prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
