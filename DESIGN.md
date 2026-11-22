---
name: Nexo
description: Identidad Nexo 3.0 «Enterprise Tech» aplicada a la aplicación de coordinación
colors:
  core-navy: "#0B172B"
  nexo-mint: "#69E1C7"
  signal-blue: "#4B8FF7"
  canvas-white: "#F5F8FC"
  steel-gray: "#71849B"
  surface-navy: "#17283F"
  blanco: "#FFFFFF"
  tinta-2: "#4A5B70"
  canvas-2: "#EAF0F7"
  borde: "#DCE3EC"
  borde-opcion: "#C9D3DF"
  niebla: "#A9B8CA"
  linea-navy: "#2F4461"
  azul-tinta: "#1F5FCC"
  azul-tenue: "#E8F0FE"
  azul-borde: "#B9D0FB"
  azul-claro: "#6AA2F8"
  mint-tenue: "#E6F9F4"
  mint-borde: "#9FE9D7"
  mint-claro: "#84E7D1"
  mint-medio: "#5CC3D8"
  azul-medio: "#56A9EE"
  critico: "#B42330"
  critico-hondo: "#9C1D29"
  critico-tenue: "#FDECEE"
  critico-borde: "#F1B6BC"
  critico-sobre-navy: "#FFB4BC"
  aviso: "#8A5300"
  aviso-tenue: "#FFF4DB"
  aviso-borde: "#E0A526"
  exito: "#137A55"
  exito-tenue: "#E6F6EF"
  exito-borde: "#A7DBC4"
  exito-fondo: "#F4FBF8"
  fila-hover: "#FAFCFE"
typography:
  titulo-pagina:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.35rem + 1.1vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  titulo-seccion:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  cifra:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  codigo:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  cuerpo:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  dato:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  etiqueta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
  mini:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
  titulo-tarjeta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
  campo-captura:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.4
  costo:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
  codigo-grande:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
  conteo:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
  reloj:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
  nota:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  s: "8px"
  m: "12px"
  l: "16px"
  pastilla: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
components:
  boton-captura:
    backgroundColor: "{colors.nexo-mint}"
    textColor: "{colors.core-navy}"
    rounded: "{rounded.m}"
    height: "56px"
    padding: "0 20px"
  boton-captura-hover:
    backgroundColor: "{colors.mint-claro}"
  boton-solido:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.core-navy}"
    rounded: "{rounded.s}"
    height: "44px"
    padding: "8px 16px"
  boton-solido-hover:
    backgroundColor: "{colors.azul-claro}"
  boton:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.core-navy}"
    rounded: "{rounded.s}"
    height: "44px"
    padding: "8px 16px"
  boton-peligro-solido:
    backgroundColor: "{colors.critico}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.s}"
    height: "44px"
  codigo-bloqueado:
    backgroundColor: "{colors.critico}"
    textColor: "{colors.blanco}"
    typography: "{typography.codigo}"
    rounded: "{rounded.s}"
  codigo-en-curso:
    backgroundColor: "{colors.azul-tenue}"
    textColor: "{colors.azul-tinta}"
    typography: "{typography.codigo}"
    rounded: "{rounded.s}"
  insignia-riesgo:
    backgroundColor: "{colors.aviso-tenue}"
    textColor: "{colors.aviso}"
    rounded: "{rounded.pastilla}"
  pedido-nexo:
    backgroundColor: "{colors.mint-tenue}"
    rounded: "{rounded.l}"
    padding: "12px"
  tarjeta:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.m}"
    padding: "16px 20px"
  barra-lateral:
    backgroundColor: "{colors.core-navy}"
    textColor: "{colors.niebla}"
    width: "264px"
  banda-captura:
    backgroundColor: "{colors.surface-navy}"
    textColor: "{colors.blanco}"
---

# Sistema de diseño: Nexo

## Overview

Nexo aplica la identidad aprobada Nexo 3.0, «Enterprise Tech»: moderna, sobria, precisa y confiable. La fuente de verdad de la marca es `docs/marca/` (`BRAND_BRIEF.md`, `VISUAL_SYSTEM.md`, `design-tokens.json` y la imagen de dirección aprobada). Este documento describe cómo se aplicó a la aplicación y qué se añadió.

El marco es de marca: una barra lateral Core Navy con el lockup de la N de cintas, la navegación y, aparte, la consola de la demo; y una banda Surface Navy con la captura, el gesto principal. El trabajo se lee sobre una mesa clara: Canvas White de fondo, tarjetas blancas con borde fino y sombra suave, Space Grotesk en títulos, códigos y cifras, Inter en todo lo demás.

Es una herramienta operativa: la marca aporta paleta, tipografía, el isotipo y una gramática de tres registros (propone, aprueba, ejecutado). La navegación, los controles y la estructura son los estándar de la web.

Tema claro únicamente. No hay tema oscuro.

Sustituye por completo la dirección anterior («rotulación de bodega»: Bahnschrift, azul de paral y naranja de viga). No queda ningún color, fuente ni elemento de aquella.

## Colors

### Marca (cerrados, valores exactos)

| Token | HEX | Uso en la aplicación |
|---|---|---|
| Core Navy | `#0B172B` | Barra lateral y cabecera; texto principal; texto de los botones Mint y Blue; insignia Urgente |
| Nexo Mint | `#69E1C7` | Botón «Enviar» de la captura; insignia Nuevo; icono de la pantalla actual; anillo del código recién creado; inicio del degradado del isotipo |
| Signal Blue | `#4B8FF7` | Botón sólido (acciones primarias, con texto Navy); subrayado de enlaces; foco sobre zonas Navy; bordes de lo activo (confirmar, En curso); final del degradado |
| Canvas White | `#F5F8FC` | Fondo de la aplicación |
| Steel Gray | `#71849B` | Bordes de controles (campos, botones de contorno); barra de desplazamiento. Nunca texto pequeño sobre claro |
| Surface Navy | `#17283F` | Banda de captura; elemento activo de la barra lateral; selector «ver como» |

### Tokens derivados (pendientes de validar con el fundador)

Los seis colores de marca no cubren texto secundario legible sobre claro, ni estados semánticos. Estos derivados se usan solo donde los seis no cumplen su función.

| Nombre | Valor | Para qué |
|---|---|---|
| `blanco` | `#FFFFFF` | Superficie de tarjetas sobre Canvas |
| `tinta-2` | `#4A5B70` | Texto secundario sobre claro (Steel Gray solo da 3,60:1) |
| `canvas-2` | `#EAF0F7` | Superficie hundida: cabeceras de tabla, cuentas, hover, letra de opción |
| `borde` | `#DCE3EC` | Bordes decorativos de tarjetas y separadores |
| `borde-opcion` | `#C9D3DF` | Borde de las opciones de una decisión |
| `niebla` | `#A9B8CA` | Texto secundario sobre Core Navy y Surface Navy |
| `linea-navy` | `#2F4461` | Bordes sobre Navy (consola DEMO, botones del reloj) |
| `azul-tinta` | `#1F5FCC` | Texto azul pequeño (En curso, Pendiente, Claude) y anillo de foco sobre claro (Signal Blue sobre Canvas da 3,00:1) |
| `azul-tenue` / `azul-borde` | `#E8F0FE` / `#B9D0FB` | Fondo y borde de lo que espera a una persona: confirmar una opción, decisiones pendientes, En curso |
| `azul-claro` | `#6AA2F8` | Hover del botón sólido (sube el contraste del texto Navy) |
| `mint-tenue` / `mint-borde` | `#E6F9F4` / `#9FE9D7` | Superficie de lo que Nexo pide o propone («Nexo te pide», «Crear decisión» en el registro) |
| `mint-claro` | `#84E7D1` | Hover del botón de captura |
| `mint-medio`, `azul-medio` | `#5CC3D8`, `#56A9EE` | Paradas intermedias del degradado del isotipo (interpolación Mint→Blue) |
| `critico` | `#B42330` | Bloqueado, Atrasado, Escalamiento, Rechazar, errores |
| `critico-hondo` | `#9C1D29` | Hover de «Confirmar rechazo» |
| `critico-tenue` / `critico-borde` | `#FDECEE` / `#F1B6BC` | Fondo y borde de insignias y alertas críticas |
| `critico-sobre-navy` | `#FFB4BC` | Error del reloj dentro de la consola DEMO |
| `aviso` | `#8A5300` | En riesgo, «estimado», causas de las marcas, etiqueta DEMO |
| `aviso-tenue` / `aviso-borde` | `#FFF4DB` / `#E0A526` | Fondo y borde de lo anterior |
| `exito` | `#137A55` | Resuelto, Aprobada, Elegida, «Trabajo creado», Aplicar decisión |
| `exito-tenue` / `exito-borde` / `exito-fondo` | `#E6F6EF` / `#A7DBC4` / `#F4FBF8` | Fondos y bordes de lo ejecutado o registrado |
| `fila-hover` | `#FAFCFE` | Hover de las filas del registro |

### Contrastes medidos (WCAG 2.x, relación de luminancia)

Texto normal exige 4,5:1; texto grande y componentes de interfaz, 3:1.

| Texto / elemento | Fondo | Relación | Uso |
|---|---|---|---|
| Core Navy | Canvas White | 16,83 | Texto principal |
| Core Navy | Blanco | 17,92 | Texto en tarjetas |
| `tinta-2` | Canvas White | 6,52 | Subtítulos, etiquetas |
| `tinta-2` | Blanco | 6,95 | Datos secundarios en tarjetas |
| `tinta-2` | `canvas-2` | 6,06 | Cabeceras de tabla, cuentas |
| Core Navy | Signal Blue | 5,61 | Botón sólido |
| Core Navy | `azul-claro` | 6,94 | Botón sólido en hover |
| Core Navy | Nexo Mint | 11,26 | Botón «Enviar», insignia Nuevo |
| Core Navy | `mint-tenue` | 16,40 | «Nexo te pide» |
| Blanco | Core Navy | 17,92 | Barra lateral |
| Blanco | Surface Navy | 14,88 | Banda de captura |
| `niebla` | Core Navy | 8,87 | Navegación inactiva, textos de la consola |
| `niebla` | Surface Navy | 7,36 | Ayuda de la captura |
| Nexo Mint | Core Navy | 11,26 | Icono de la pantalla actual |
| Signal Blue | Core Navy | 5,61 | Anillo de foco en la barra |
| Signal Blue | Surface Navy | 4,65 | Anillo de foco en la captura |
| `azul-tinta` | Canvas White | 5,53 | Anillo de foco sobre claro |
| `azul-tinta` | `azul-tenue` | 5,14 | En curso, Pendiente |
| `critico` | `critico-tenue` | 5,71 | Bloqueado, Atrasado, alertas |
| Blanco | `critico` | 6,51 | Código de trabajo bloqueado, Confirmar rechazo |
| `aviso` | `aviso-tenue` | 5,79 | En riesgo, estimado, DEMO |
| `exito` | `exito-tenue` | 4,77 | Resuelto, Aprobada, Elegida |
| `exito` | `exito-fondo` | 5,07 | Texto en la opción elegida |
| Blanco | `exito` | 5,33 | Letra de la opción elegida |
| Steel Gray (borde) | Blanco | 3,83 | Borde de campos y botones (≥ 3:1) |

Combinaciones que **no** se usan como texto porque no llegan a 4,5:1: blanco sobre Signal Blue (3,20), Signal Blue sobre Canvas White (3,00) o blanco (3,20), Mint sobre Canvas White (1,49), Steel Gray sobre Canvas White (3,60) o blanco (3,83), Steel Gray sobre Surface Navy (3,88).

### Named Rules

- **Tres registros:** Mint tenue con el isotipo es lo que Nexo pide o propone; azul es lo que espera la acción de una persona (aprobar, responder, confirmar); verde con marca de verificación es lo ejecutado o registrado. Rojo y ámbar quedan para lo crítico y lo que está en riesgo.
- **Nunca solo color:** cada estado, marca y tipo de acción lleva su nombre escrito y un icono.
- **El degradado es del isotipo:** Mint→Blue solo vive en el isotipo. No hay degradados en fondos, botones ni texto.
- **Mint es de la captura:** el único botón Mint es «Enviar». Las acciones primarias del resto de pantallas son Signal Blue con texto Navy.

## Typography

- **Space Grotesk** (500/600/700) para títulos de página y sección, el wordmark, códigos de trabajo y decisión (T04, D01), letras de opción, costos, cifras, conteos y la hora del reloj. Números tabulares.
- **Inter** (400/500/600) para todo lo demás: controles, datos, párrafos, tablas.
- Se cargan con `next/font/google` en `src/app/layout.tsx` (variables `--fuente-inter` y `--fuente-space-grotesk`, `display: swap`, pila de respaldo `system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`). El build las descarga y las autoaloja: el navegador no llama a Google.

### Hierarchy
Título de página (Space Grotesk 600, clamp 1,75–2,25 rem) → título de sección (Space Grotesk 600, 1,25 rem, con su cuenta en una pastilla) → título de tarjeta (Inter 600, 1,0625 rem) → cuerpo (Inter 400, 1 rem) → datos (0,9375 rem) → etiquetas de datos (Inter 500, 0,8125 rem, `tinta-2`, sin mayúsculas).

## Layout

- Espaciado base 8 px (4/8/12/16/24/32/48/64). Ancho máximo del contenido 76 rem; canal lateral 16 px en teléfono, 24 px desde 640 px y 32 px desde 1280 px; desde 1600 px la raíz sube a 18 px para el proyector.
- **Escritorio (≥ 1024 px):** barra lateral fija de 264 px (lockup, navegación con iconos y, al pie, el panel DEMO con borde discontinuo). A la derecha, la banda de captura a todo el ancho y debajo el contenido.
- **Teléfono y tableta (< 1024 px):** cabecera Navy con lockup y empresa, pestañas desplazables con la actual subrayada en Mint, y una franja DEMO desplazable (Surface Navy, borde superior discontinuo). Bajo 640 px la captura queda fija abajo (máx. 62 vh).
- «Mi día» en dos columnas desde 1100 px: «Nexo te pide», «Lo que debes» y «Lo que esperas de otros» a la izquierda; «Decisiones pendientes» y «Qué cambió» a la derecha.
- Decisiones: las tres opciones en columnas iguales (auto-fit, mín. 17 rem); la cabecera de la opción tiene alto fijo desde 640 px para que los costos queden alineados.

## Elevation & Depth

Tres sombras suaves con desplazamiento y desenfoque, tintadas con Navy: `sombra-1` (tarjetas), `sombra-2` (reserva) y `sombra-3` (tarjeta de resultado sobre la banda de captura). Sin brillos, sin glassmorphism, sin sombras duras.

## Shapes

Radios 8 px (controles, códigos), 12 px (tarjetas, campo de captura) y 16 px (decisiones, cifras, resultado de la captura, «Nexo te pide»); pastilla 999 px para insignias.

## Components

### Logo (`src/componentes/marca/logo-nexo.tsx`)
- `IsotipoNexo` (props `tamano`, `mono`, `className`, `titulo`): N de dos cintas con extremos redondeados. La primera sube por la izquierda, gira arriba y baja por la diagonal; la segunda entra por encima en la diagonal, gira abajo y sube por la derecha. Un hueco recortado con máscara marca el cruce y funciona sobre cualquier fondo. Degradado Mint → Blue (con dos paradas intermedias) o una tinta (`currentColor`).
- `LogoNexo` (props `variante` `horizontal|isotipo`, `fondo` `claro|oscuro`, `mono`, `tamano`, `titulo`): lockup con el wordmark `nexo` en Space Grotesk 700 y espaciado −0,035 em; blanco sobre oscuro, Core Navy sobre claro, `currentColor` en monocromo.
- Icono de la aplicación: `src/app/icon.svg` (isotipo sobre cuadrado Core Navy redondeado).
- **El arte final del logo es exploratorio.** Es una geometría propia inspirada en la referencia, no un vector de producción: falta la construcción final, el área libre y la comprobación de similitud con marcas existentes.

### Buttons
- **Captura** (Mint, texto Navy): 56 px de alto, icono de enviar; en teléfono solo el icono.
- **Sólido** (Signal Blue, texto Navy): la acción primaria de cada pantalla (Preguntar, Sí, aprobar, Enviar respuesta, Ir a decisiones, Responder).
- **Contorno** (blanco, borde Steel Gray): acciones iguales entre sí, como «Aprobar opción A/B/C», para no empujar ninguna.
- **Quieto** (borde `borde`, fondo transparente): Cancelar, ejemplos, marcar avisos.
- **Peligro** (`critico`): Rechazar y Confirmar rechazo.
- Todos con 44 px de alto mínimo, transición de 150 ms y foco visible.

### Chips
Pastillas con icono: estado (Abierto, En curso, Bloqueado, Resuelto), Urgente (Navy con rayo Mint), Atrasado, En riesgo, Nuevo (Mint), implementación de IA, estado de la decisión (Pendiente con reloj de arena, Aprobada, Rechazada) y tipo de acción del registro.

### Código de trabajo
El código (T04, D01) en Space Grotesk 600, teñido con el color del estado: Abierto blanco con borde Steel, En curso azul tenue, Bloqueado rojo lleno, Resuelto verde tenue. Cuando la captura crea un trabajo, su código recibe un anillo Mint que se apaga en 600 ms.

### Cards / Containers
Tarjeta de trabajo: código a la izquierda, título e insignias, y debajo una fila de datos (Proyecto, Responsable, Plazo, Bloqueado por, Depende de) separada por un borde.

### Inputs / Fields
Borde de 1 px Steel Gray, radio 8 px, foco con anillo de 2 px `azul-tinta`. El campo de captura es blanco, 18 px, radio 12 px, sobre la banda Surface Navy.

### Navigation
Barra lateral: enlaces de 44 px con icono Lucide; el actual con fondo Surface Navy, texto blanco, icono Mint y `aria-current="page"`. En teléfono, pestañas con subrayado Mint.

### Consola DEMO
Ver como, reloj (+5 min, +30 min, Siguiente evento) y Reiniciar demo, siempre separados del producto: panel con borde discontinuo al pie de la barra lateral o franja aparte en teléfono, con la pastilla ámbar «DEMO» y la nota «datos de demostración».

### Recorrido de proyecto (patrón de secuencia)
Los proyectos se leen como un recorrido, no como una lista de tarjetas. La lógica es pura y probada (`src/motor/secuencia.ts`); la vista vive en `src/componentes/proyectos/` y sus estilos en `src/app/proyectos/proyectos.css` (solo variables de marca).

- **Mapa del recorrido** (`MapaRecorrido`): una columna por etapa y un punto por trabajo; lo que va a la vez se apila en la misma columna sobre una rama vertical. Tramos entre etapas: continuos `exito-borde` en lo hecho, discontinuos `borde-opcion` en lo que falta. Puntos: hecho (verde lleno con ✓), ahora (azul tenue, borde Signal Blue y punto `azul-tinta`), bloqueado (rojo lleno con prohibido), atrasado o rezagado (rojo tenue con reloj), en riesgo (ámbar tenue con triángulo), después (blanco, borde Steel). Es un resumen: el texto de al lado dice lo mismo en palabras, por eso es `aria-hidden`. Tamaño normal (1,25 rem) en la lista; grande (1,75 rem, columnas que llenan el ancho y rótulo «Etapa n» u «Hoy» arriba) en el detalle, con leyenda.
- **Fila de proyecto** (lista): tres columnas. A la izquierda, la fecha como etiqueta teñida según cercanía («Vence en 2 días» en Space Grotesk; rojo tenue si venció, ámbar tenue si vence hoy o mañana, verde tenue si terminó). En medio, nombre, responsable y resultado, y el mapa con «3 de 8 hechos · después 4 trabajos más». A la derecha, «Ahora» (pastilla azul) con la etapa y quién tiene cada paso, y debajo, separado por un borde, el primer freno escrito con icono y las cuentas de bloqueados, atrasados y en riesgo. Toda la fila lleva al detalle. Los grupos «Por entregar», «Sin fecha de entrega» y «Terminados» van en ese orden; las tres cifras quedan al pie, bajo «Lo que Nexo coordinó esta semana».
- **Panorama** (detalle): panel blanco radio 16 px con Avance, Ahora y Después en cifras Space Grotesk, y el mapa grande debajo. Le sigue «Qué lo frena»: bloqueos con su motivo y a quién detienen, atrasos, riesgos por repuesto o por otro proyecto; los riesgos que solo heredan un bloqueo del mismo proyecto se resumen en una línea.
- **Línea del recorrido** (detalle): de arriba abajo, un riel con un nodo de 40 px por etapa (✓ verde hecho, anillo azul ahora, rojo bloqueado, reloj rojo quedó pendiente, blanco después) y el riel continuo en lo hecho y discontinuo en lo que falta. Cada etapa lleva su nombre, la pastilla de estado escrita y «3 a la vez» cuando hay paralelos. Lo hecho se comprime en una línea con ✓; lo pendiente son tarjetas lado a lado (hasta 3 por fila a ≥1280 px) que muestran referencia teñida, título enlazado, estado, marcas, responsable, plazo con «vence hoy» y, bajo un borde, las relaciones: «Bloqueado por…» con motivo, «Espera a…» (mismo proyecto), «Espera a otro proyecto, …», repuesto que falta y riesgo heredado. En la etapa actual la tarjeta lleva borde `azul-borde`; la bloqueada, `critico-borde`.
- Proyectos casi sin dependencias (menos de la mitad de sus trabajos espera a otro) se muestran «Día por día»: una etapa por día del plazo, con «Ayer», «Hoy» y «Mañana».
- Proyecto vacío: caja `vacio` que explica que sus trabajos aparecerán en el orden en que deben ocurrir.

## Motion
Transiciones de 150 ms en hover y cambios de estado. Una sola entrada orquestada: la tarjeta de resultado de la captura (220 ms, opacidad y 6 px) y el anillo Mint del código recién creado. Con `prefers-reduced-motion` no hay movimiento.

## Do's and Don'ts

### Do:
- Usar los seis colores de marca con sus valores exactos y las dos tipografías.
- Escribir el estado y la marca además de colorearlos, con icono.
- Usar números tabulares en horas, costos, códigos y conteos.
- Mostrar «Propuesta por…» como pastilla neutra en la cabecera de la opción.
- Mantener «estimado» junto a la cifra de horas y la nota de hipótesis.
- Distinguir lo que Nexo propone (Mint tenue), lo que una persona aprueba (azul) y lo ejecutado (verde).

### Don't:
- No usar Steel Gray, Signal Blue ni Mint como texto pequeño sobre claro; usar `tinta-2` y `azul-tinta`.
- No poner texto blanco sobre Signal Blue.
- No usar degradados fuera del isotipo, ni brillos, biseles, 3D o glassmorphism.
- No marcar ninguna opción de una decisión como recomendada ni destacarla antes de elegirla.
- No poner etiquetas pequeñas en mayúscula encima de los títulos.
- No usar una X ni un símbolo de cuatro ramas como marca; no incrustar la imagen de referencia.
- No usar imágenes externas.
