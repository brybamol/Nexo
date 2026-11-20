# Nexo — guía para agentes de código

Nexo es una plataforma web donde viven los trabajos y proyectos de una empresa, y que hace ella misma la coordinación: convierte frases en trabajos, pide estados, escala y prepara decisiones. Es un MVP de hackathon con datos ficticios, que corre en local.

`docs/05-arquitectura-y-planes.md` es el contrato técnico y manda sobre el código. `docs/03-etapa-0-definicion.md` (reglas y guion) y `docs/04-empresa-y-casos-de-control.md` (empresa y casos) definen el dominio. Si algo no está en el contrato, pregunta; no lo inventes.

## Vocabulario fijo

- Proyecto, trabajo, responsable, dependencia, decisión, acción.
- Estados de un trabajo: Abierto, En curso, Bloqueado, Resuelto. No hay más.
- Marcas calculadas (no son estados): Atrasado y En riesgo. Se calculan siempre; ninguna tabla las guarda.

## Reglas que no se rompen

- El motor (`src/motor`) es código puro y determinista: sin base de datos, sin red, sin hora real.
- La IA solo propone. `validarInterpretacion` comprueba cada propuesta antes de aplicarla.
- Nada con costo se ejecuta sin aprobación humana: las compras pasan por decisiones.
- Cada acción de Nexo queda registrada con su motivo y el hecho que la originó.
- Si no hay dato, la respuesta dice «no lo sé». No se inventan datos.
- Prohibido `Date.now()` y `new Date()` sin argumentos en la lógica (`src/motor`, `src/servicios`, `src/ia`, `src/dominio`, `src/db`). El tiempo viene del reloj de la demo (`obtenerAhora`) y la zona es Costa Rica (`src/dominio/tiempo.ts`).
- Las mutaciones son Server Actions en `src/app/acciones/`.
- Los archivos de contrato (§4.0 de `docs/05`) no cambian sin aprobación humana. Tampoco se cambian dependencias ni `package.json` sin aprobación.

## Comandos de verificación

- `pnpm verificar`: tipos, lint y pruebas. Es lo que comprueba GitHub.
- `pnpm test` o `pnpm vitest run <ruta>`: pruebas.
- `pnpm typecheck` y `pnpm lint`.
- `pnpm build`: obligatorio en tareas de interfaz.
- `pnpm db:reset`: solo con `pnpm dev` parado.

## Next.js

La versión instalada es Next.js 16.4.6, con cambios respecto a versiones anteriores. Antes de escribir código de Next, lee la guía correspondiente en `node_modules/next/dist/docs/`.

Las reglas de Next y el bloque que mantiene `next dev` están en `AGENTS.md`. Esas reglas están ahí y no se repiten aquí.
