# Brief · Versión 2 de Nexo: coordinación desde el correo

> **Sustituido en parte por `docs/08-reformas-v2.md`.** Lo que este brief describe del modelo de correo aparte (compromisos propios y tabla de correcciones) ya no existe: el correo alimenta al motor y sus pedidos son trabajos. Se conserva como historia del giro. Donde choquen, manda `docs/08`.

*Rama: `giro-correo` · Fecha: 21-11-2026 · `main` no se tocó*

## En una frase

En la versión 2, Nexo ya no espera a que alguien escriba tareas: **lee el correo de cada persona y arma solo qué se pidió, quién lo debe hacer, para cuándo y quién espera a quién entre departamentos.**

## Por qué

La idea de fondo es que Nexo sea **la conexión entre departamentos** de una empresa corporativa: que Finanzas no tenga que perseguir a Legal ni Legal a Finanzas. La versión de `main` (frases capturadas a mano, distribuidora con bodega) no encajaba con esa premisa. En esta versión:

- **Nadie crea tareas.** Todo sale de los correos que la gente ya manda.
- **Cada persona conecta su propio buzón.** Nexo no expone datos personales ni el contenido de los correos: guarda solo el hecho de trabajo, una cita corta y el enlace al correo.
- **La persona puede confirmar, corregir o descartar** lo que Nexo entendió.
- **Primera fuente real: Gmail** con cuentas de Google Workspace de la empresa. Outlook va después, con el mismo modelo.

## Cómo verla sin perder `main`

Las dos versiones conviven en ramas distintas: cambiar de rama no borra nada.

```bash
git fetch origin
git switch giro-correo
pnpm install
pnpm dev
```

Abre `http://localhost:3000/correo`, o el puerto que indique `pnpm dev`. La tabla nueva se crea sola al arrancar; no hace falta reiniciar la base.

Para volver a la versión original:

```bash
git switch main
```

Si ves datos raros al volver, para `pnpm dev` y corre `pnpm db:reset`.

## Qué mirar en la demo (5 minutos)

1. **Quién espera a quién.** A las 8:20 llega el correo de Andrés a Ricardo (la factura proforma) y Nexo lo une con la cotización que Andrés le pidió a Paola: **Andrés (Operaciones) → Ricardo (Contabilidad) → Paola (Ventas)**, en el proyecto Hotel Mirador. Con estos correos solo hay una cadena, así que todavía no hay cuello de botella.
2. **«Ver como».** Cambia de persona arriba y verás *Te piden*, *Pediste y esperas* y *Resuelto*, cada uno con la cita del correo de donde salió.
3. **Corregir.** Como Paola, abre la cotización al Hotel Mirador, corrige el plazo al 27 de noviembre y guarda: deja de estar atrasada y la cadena se actualiza.
4. **Buzones conectados.** Cuenta lo personal y los boletines que se descartaron, sin mostrar nunca su asunto ni su remitente.

Los datos son de la única empresa de la demo, **Frío del Valle**: sus 12 personas (8 con el buzón conectado) y 7 hilos de correo en formato de la API de Gmail, más correos de ruido (personales, boletines, un cumpleaños y un borrador) que no deben producir nada.

## Qué cambió en el código

**Nuevo:**

| Dónde | Qué es |
|---|---|
| `docs/06-giro-correo.md` | La especificación completa: premisa, flujo, privacidad, empresa ficticia, 14 casos de control, Gmail (§13) y preguntas abiertas. **Empezar por aquí.** |
| `src/correo/fuentes/` | Adaptadores Gmail y Outlook, que llevan cada proveedor a un mismo mensaje interno. |
| `src/correo/` | El flujo, todo código puro: privacidad → unión de buzones → extracción → enlaces entre hilos → proyectos → marcas y cadenas. |
| `src/correo/ejemplo/` | Frío del Valle y sus buzones ficticios, en formato Gmail y Outlook. |
| `src/servicios/correo.ts`, `src/app/acciones/correo.ts` | Lectura del modelo y guardado de correcciones (Server Action). |
| `src/app/correo/`, `src/componentes/correo/` | La pantalla `/correo` y la tarjeta de compromiso con su formulario de revisión. |
| `tests/correo/` | 45 pruebas: casos de control, adaptador de Gmail y equivalencia Gmail = Outlook. |

**Modificado:**
- `src/db/esquema.ts` y `src/db/ddl.ts`: una tabla nueva, `correcciones_correo`. **Son archivos de contrato y necesitan aprobación del equipo.**
- `tests/db/conexion.test.ts`: ahora espera 17 tablas.
- `src/app/layout.tsx`, la barra y la navegación: la entrada «Correo». En esa pantalla se oculta la caja de captura.
- `src/app/globals.css`: estilos de la pantalla, solo con los tokens de marca existentes.

**Sin cambios:** dependencias, `package.json`, el motor y el guion de la demo original (todas sus pruebas siguen pasando).

## Estado

- `pnpm verificar`: 365 pruebas en verde, tipos y lint limpios.
- `pnpm build`: compila.
- Revisado en el navegador en escritorio y en teléfono.

## Lo que todavía no hace

- **No se conecta a un buzón real.** Los correos son ficticios.
- **El intérprete es local** (reglas), ajustado a los correos de ejemplo. Para correo real falta la extracción con Claude.
- **No está integrado con el seguimiento y el escalamiento** del motor actual.
- **La barra lateral todavía dice «Frío del Valle».**

## Decisiones que necesitamos del equipo

1. **¿Aprobamos el giro?** Si sí, `docs/06` pasa a ser contrato y aprobamos la tabla nueva.
2. **Gmail:** ¿el piloto conecta persona por persona o a toda la empresa con su administrador de Google Workspace?
3. ¿Presupuestamos la evaluación de seguridad que pide Google (CASA) para salir del modo de prueba, que permite hasta 100 usuarios?
4. Las preguntas abiertas de `docs/06` §12 y §13.
