---
version: 1
slug: "src-app-layout-tsx"
primary_target: "src/app/layout.tsx"
related_targets: ["src/app","src/componentes"]
---

# Superficie: aplicación Nexo (todas las pantallas del marco común)

Modo: Operate. Construcción en código (code-led). Sin generación de imágenes.

Audiencia y tarea: técnicos y bodegueros en teléfono (capturar una frase, ver Mi día), supervisores (qué les pide Nexo, qué está en riesgo), gerente (comparar tres opciones y decidir). Se proyecta en una demo de 4 minutos y se usa a 375 px.

Restricciones: solo marcado, clases y CSS; fuentes del sistema; sin imágenes externas; estados y marcas con texto o icono además del color; «estimado» en las horas; «Propuesta por…», nunca «recomendada».

Ronda de dirección: el agente trabajaba sin canal de preguntas; se asumió la dirección asignada por la tirada sin página de decisión. Candidatos propios, por resonancia: 1 talonario de órdenes de trabajo en papel autocopiante; 2 pizarra de despacho de la oficina de operaciones; 3 código de colores de los cilindros de refrigerante; 4 panel aislado de cámara fría; 5 código de colores de seguridad industrial y cinta de piso; 6 rotulación de bodega: estanterías de carga y etiquetas de ubicación, con su tarjeta kárdex; 7 señalización vial. Asignado: 6.

Retadores (todos declinados en identificación y claridad; disciplina que se tomó de cada uno):
- Tablero split-flap: las filas cambian de estado sin romper la cuadrícula → las listas de trabajos y el registro mantienen columnas fijas.
- Mapa de orientación: un color reservado para la ruta activa → el naranja de viga queda reservado a la captura y a la acción primaria visible.
- Marketing monocromo: cada afirmación con su prueba → cada aviso, marca y respuesta muestra el trabajo de origen.
- Diagrama de tránsito: declinado; nada que tomar sin inventar datos.
- Cartera de boletos: nada desaparece, se anula → en una decisión resuelta las opciones no elegidas siguen legibles y la elegida lleva sello.
- Catálogo Saville: declinado; su disciplina de código único por artículo ya la tiene la dirección.

## Direction contract

THESIS: Nexo se lee como la bodega bien rotulada de Frío del Valle: cada trabajo tiene su etiqueta de ubicación (T04, T15) y nada se pierde en la estantería. Rechaza el tablero SaaS gris de tarjetas iguales con un acento violeta.

OWN-WORLD: azul de los parales de estantería en la barra superior y la banda de captura; naranja de viga reservado a la acción de capturar y a la primaria visible; suelo gris galvanizado frío; tarjetas blancas como papel de etiqueta; etiquetas de código en DIN condensada (Bahnschrift) gruesa, rellenas con el color del estado y el nombre del estado escrito al lado; listas con renglones y columnas de kárdex y números tabulares.

STORY: quien entra entiende en un vistazo qué le pide Nexo y qué está en riesgo, cree que Nexo ya persiguió por él, y actúa: escribe una frase, responde un seguimiento o aprueba una opción.

FIRST VIEWPORT: barra azul con marca, navegación y la consola de demo (ver como, reloj y sus botones); debajo, la banda de captura en el mismo azul con el campo ancho y el botón naranja «Enviar»; después el título de la pantalla y la sección «Nexo te pide». En teléfono la banda de captura queda fija abajo.

FORM: rotulación de bodega con kárdex, candidato 6 de 7 de la lista propia; seed:6b6247c896ac198c.

Movimiento firma: la etiqueta del trabajo recién creado «se imprime» (se revela de arriba abajo una vez) en la tarjeta de resultado de la captura; sin movimiento con prefers-reduced-motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
