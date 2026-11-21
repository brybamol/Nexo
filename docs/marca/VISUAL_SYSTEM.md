# Sistema visual — Nexo Enterprise Tech

## Objetivo estético
Equilibrio entre la modernidad tecnológica de un producto de IA y la confianza de un SaaS corporativo. Lujo sobrio, estructura clara, precisión, profundidad medida. Identidad **minimalista, no básica**: el valor distintivo está en el símbolo de cinta N y en una composición tipográfica/espacial consistente.

## Paleta cerrada — NO alterar sin autorización
| Token | HEX | Uso |
|---|---|---|
| Core Navy | `#0B172B` | Logotipo sobre oscuro, navegación, fondos hero |
| Nexo Mint | `#69E1C7` | Logo gradiente, conexiones, destacados |
| Signal Blue | `#4B8FF7` | Enlaces, focos y datos activos |
| Canvas White | `#F5F8FC` | Fondo de la app y superficies claras |
| Steel Gray | `#71849B` | Texto auxiliar, iconos secundarios, con contraste revisado |
| Surface Navy | `#17283F` | Tarjetas/modales oscuros |

Proporción orientativa en materiales de marca: Navy 50%, White 30%, Mint 12%, Blue 8%. **No** imponer estas proporciones en cada pantalla UI. Para aplicación, priorizar modo claro y accesibilidad. Introducir colores semánticos para estado crítico, warning y success con validación de contraste; no reemplazar los seis colores de marca.

## Tipografía
- **Space Grotesk** para marketing, grandes títulos, números destacados y base del lettering (el wordmark final puede ser personalizado).
- **Inter** para controles, tablas, textos, mensajes y documentos.
- Escala orientativa desktop: hero 48–64px, páginas 28–36px, cuerpo 16px, etiquetas 12–14px; ajustar responsivamente.
- Pesos: Space Grotesk 500/600/700, Inter 400/500/600.

## Logo
- Imagen prioritaria: `../assets/reference/nexo_brand_direction_approved.png`.
- **NO** reutilizar el isotipo X anterior.
- Construir una N fluida de cintas entrelazadas con un cruce claro y extremos redondeados; gradiente Mint→Blue.
- Wordmark minúscula `nexo` geométrica y de alto contraste.
- Versión oscura y clara; versiones monocromáticas y microicono.
- Evitar exceso de brillo, biseles, efectos 3D; dar sofisticación mediante silueta y técnica vectorial.
- Entregables futuros: SVG limpio, PNG transparentes, componente React, variantes icon-only/lockup y lineamientos de área libre. Estos **no** se presumen existentes.

## Componentes UI
- Espaciado base 8px; valores 4/8/12/16/24/32/48/64.
- Radios 8/12/16px; pastillas 999px cuando aplique.
- Iconos Lucide, grosor 1.75–2px, estilística lineal.
- Botones con estados default/hover/focus/disabled/loading.
- Priorizar jerarquía tipográfica, separación visual por superficie; sombras suaves; evitar glassmorphism generalizado.
- Dashboard: resumen superior, KPIs operativos relevantes, lista de bloqueos, tareas, actividad y aprobaciones.
- Indicar explícitamente el origen y estado de confianza de datos generados por IA.
- Contraste: comprobar WCAG AA de textos y estados; Mint sobre blanco no es ideal para texto pequeño.

## Motion
Transiciones de 150–250 ms para cambios de estado, hover y expandir; preferir reduced motion. Los microefectos pueden representar un flujo que conecta fuentes a una acción. Evitar animaciones innecesarias en el dashboard.

## Fotografía/visualización
Mostrar operación real: supervisores, técnicos, almacén, distribución, logística. Evitar fotos cliché de robots y símbolos abstractos sin significado. Visuales de flujos/conexiones deben comunicar dependencias o progresos concretos.

## Accesibilidad y contenido
Estados no solo por color, etiqueta textual; tipografía legible; foco visible; área táctil ideal ≥44×44px. Mensajes sin tecnicismos; ejemplo: “Se detectó un posible bloqueo. Revisa la fuente antes de continuar”.
