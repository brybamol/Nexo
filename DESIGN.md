---
name: Nexo
description: Rotulación de bodega para la coordinación de Frío del Valle
colors:
  suelo: "oklch(0.955 0.006 250)"
  suelo-2: "oklch(0.925 0.009 250)"
  papel: "oklch(1 0 0)"
  tinta: "oklch(0.23 0.025 258)"
  tinta-2: "oklch(0.43 0.025 258)"
  regla: "oklch(0.87 0.012 250)"
  regla-fuerte: "oklch(0.74 0.018 250)"
  paral: "oklch(0.37 0.125 260)"
  paral-hondo: "oklch(0.29 0.1 262)"
  paral-tenue: "oklch(0.94 0.025 258)"
  sobre-paral-2: "oklch(0.87 0.035 258)"
  viga: "oklch(0.72 0.175 50)"
  sobre-viga: "oklch(0.2 0.03 45)"
  en-curso: "oklch(0.5 0.14 245)"
  bloqueado: "oklch(0.5 0.19 27)"
  resuelto: "oklch(0.5 0.12 155)"
  atrasado: "oklch(0.47 0.18 27)"
  atrasado-fondo: "oklch(0.955 0.03 25)"
  riesgo: "oklch(0.38 0.08 70)"
  riesgo-fondo: "oklch(0.91 0.12 90)"
  riesgo-borde: "oklch(0.72 0.14 80)"
typography:
  rotulo:
    fontFamily: "Bahnschrift, 'DIN Alternate', 'DIN Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.02em"
  cifra:
    fontFamily: "Bahnschrift, 'DIN Alternate', 'Roboto Condensed', sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
  titulo-pagina:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif"
    fontSize: "clamp(1.625rem, 1.2rem + 1.4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  cuerpo:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  cabecera-columna:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  etiqueta: "3px"
  chico: "4px"
  tarjeta: "6px"
  pastilla: "999px"
spacing:
  canal-telefono: "16px"
  canal-escritorio: "24px"
  seccion: "40px"
components:
  boton-captura:
    backgroundColor: "{colors.viga}"
    textColor: "{colors.sobre-viga}"
    rounded: "{rounded.tarjeta}"
    height: "56px"
    padding: "0 20px"
  boton-solido:
    backgroundColor: "{colors.paral}"
    textColor: "{colors.papel}"
    rounded: "{rounded.chico}"
    height: "44px"
    padding: "8px 16px"
  boton-solido-hover:
    backgroundColor: "{colors.paral-hondo}"
  boton-contorno:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.paral}"
    rounded: "{rounded.chico}"
    height: "44px"
    padding: "8px 16px"
  rotulo-abierto:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.etiqueta}"
  rotulo-bloqueado:
    backgroundColor: "{colors.bloqueado}"
    textColor: "{colors.papel}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.etiqueta}"
  insignia-riesgo:
    backgroundColor: "{colors.riesgo-fondo}"
    textColor: "{colors.riesgo}"
    rounded: "{rounded.pastilla}"
  tarjeta:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.tarjeta}"
    padding: "14px 16px"
---

# Sistema de diseño: Nexo

## Overview

Nexo se ve como la bodega bien rotulada de Frío del Valle. Cada trabajo lleva su rótulo de ubicación (T04, T15) en DIN condensada y gruesa, relleno con el color de su estado, como las etiquetas de las estanterías de carga. El marco usa el azul de los parales de estantería; el naranja de las vigas se reserva para el gesto central, «Enviar» en la caja de captura. El suelo es gris galvanizado frío y las tarjetas son blancas como papel de etiqueta. Las listas siguen el ritmo de una tarjeta kárdex: columnas fijas, encabezados de columna en mayúscula pequeña y números tabulares.

Es una herramienta operativa: serena, precisa, directa. El mundo de la bodega aporta solo cuatro cosas (paleta, tipografía de rótulo, densidad de kárdex y el rótulo como firma); la navegación, los controles y la estructura son los estándar de la web.

Tema claro únicamente. No hay tema oscuro.

## Colors

### Primary
- **Paral** (`paral`): barra superior, banda de captura, botones sólidos, enlaces. **Paral hondo** (`paral-hondo`) para la consola de la demo y el hover.

### Secondary
- **Viga** (`viga`) con texto **sobre-viga**: solo el botón «Enviar» de la captura y el subrayado de la pestaña activa. Nada más en la interfaz es naranja.

### Neutral
- **Suelo** (`suelo`) para el fondo de página, **papel** (`papel`) para tarjetas, **tinta** y **tinta-2** para texto, **regla** y **regla-fuerte** para bordes.

### Estados y marcas
- Estados: Abierto (papel con borde de tinta), En curso (`en-curso`), Bloqueado (`bloqueado`), Resuelto (`resuelto`).
- Marcas: Atrasado (`atrasado` sobre `atrasado-fondo`, icono de reloj) y En riesgo (`riesgo` sobre `riesgo-fondo`, icono de triángulo).

### Named Rules
- **La regla de la viga:** el naranja es de la captura. Si aparece en otro botón, la captura deja de ser lo más reconocible.
- **Nunca solo color:** cada estado y marca lleva su nombre escrito y un icono; el color acompaña.

## Typography

- **Rótulo** (Bahnschrift, condensada): códigos de trabajo y de decisión, letras de opción, hora del reloj, cifras y conteos. Es la voz de la bodega.
- **Cuerpo** (pila del sistema: Segoe UI Variable, system-ui, -apple-system, Roboto): todo lo demás. Sin fuentes descargadas.
- **Cabecera de columna:** 0,75 rem, mayúsculas, 0,05 em de espaciado, `tinta-2`. Solo para términos de un `dl` o encabezados de tabla, nunca encima de un título.

### Hierarchy
Título de página (clamp 1,625–2,25 rem, 700) → título de sección (1,1875 rem, 700, con su cuenta en un rótulo gris) → título de tarjeta (1,0625 rem, 650) → cuerpo (1 rem) → datos (0,9375 rem).

## Layout

- Ancho máximo 80 rem; canal lateral 16 px en teléfono y 24 px desde 640 px; a partir de 1600 px la raíz sube a 18 px para el proyector.
- Marco: consola de la demo (azul hondo) → marca y navegación (azul) → banda de captura (azul) → contenido. En teléfono (< 640 px) la banda de captura queda fija abajo (máx. 62 vh) y la consola y la navegación se desplazan en horizontal.
- «Mi día» en escritorio (≥ 1024 px): columna principal con «Nexo te pide», «Lo que debes» y «Lo que esperas de otros»; columna lateral de 19–25 rem con «Decisiones pendientes» y «Qué cambió».
- Decisiones: las tres opciones en columnas iguales (auto-fit, mín. 17 rem) con el costo en la misma altura; en teléfono se apilan.

## Elevation & Depth

Una sola sombra suave (`0 1px 2px` + `0 2px 8px`, azul tinta muy transparente) para tarjetas sobre el suelo. La tarjeta de resultado de la captura tiene una sombra más honda porque flota sobre el azul. No hay sombras duras.

## Shapes

Rótulos con esquina de 3 px (etiqueta impresa), controles 4 px, tarjetas 6 px, insignias en pastilla.

## Components

### Buttons
- **Captura** (viga): 56 px de alto, icono de enviar; en teléfono solo el icono (el texto queda para lectores de pantalla).
- **Sólido** (paral): la acción primaria de cada pantalla (Preguntar, Sí, aprobar, Enviar respuesta, Ir a decisiones).
- **Contorno** (paral): acciones iguales entre sí, como «Aprobar opción A/B/C», para no empujar ninguna.
- **Quieto** (borde gris): Cancelar, ejemplos, marcar avisos.
- **Peligro** (rojo): Rechazar y Confirmar rechazo.
- Todos con 44 px de alto mínimo.

### Chips
Insignias en pastilla con icono: estado, Urgente (tinta llena), Atrasado, En riesgo, Nuevo (paral lleno), implementación de IA.

### Cards / Containers
Tarjeta de trabajo: rótulo a la izquierda, título e insignias, y debajo una fila kárdex de datos (Proyecto, Responsable, Plazo, Bloqueado por, Depende de) separada por una regla.

### Inputs / Fields
Borde de 1,5 px `regla-fuerte`, foco con anillo de 3 px `paral` (en las zonas azules el anillo es ámbar claro).

### Navigation
Pestañas de texto sobre el azul; la actual en blanco con subrayado de viga y `aria-current="page"`.

### Rótulo (componente firma)
El código del trabajo en Bahnschrift condensada, relleno con el color del estado. Cuando la captura crea un trabajo, su rótulo «se imprime» una vez (revelado de arriba abajo, 700 ms, salida exponencial). Con `prefers-reduced-motion` no hay movimiento.

## Do's and Don'ts

### Do:
- Escribir el estado y la marca además de colorearlos.
- Usar números tabulares en horas, costos y conteos.
- Mostrar «Propuesta por…» como pastilla neutra en la cabecera de la opción.
- Mantener «estimado» junto a la cifra de horas.

### Don't:
- No usar el naranja fuera de la captura.
- No marcar ninguna opción de una decisión como recomendada ni destacarla antes de elegirla.
- No poner etiquetas pequeñas en mayúscula encima de los títulos.
- No descargar fuentes ni usar imágenes externas.
