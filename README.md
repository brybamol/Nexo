# Nexo

## Qué es Nexo

Nexo es una plataforma web donde viven los trabajos y proyectos de una empresa, y que hace ella misma la coordinación. Convierte una frase en un trabajo con responsable y plazo, pide el estado cuando vence el plazo, avisa a quien está afectado, escala si nadie responde y prepara las decisiones con costo para la gerencia. Las personas hacen el trabajo y deciden; nadie hace de mensajero.

La prueba que la distingue de un gestor de proyectos (Asana, Monday, Notion): si un jefe todavía tiene que abrir la herramienta, leer el estado y perseguir a alguien, es un gestor de proyectos. Si la plataforma persigue, avisa y escala, y el jefe solo decide, es lo que Nexo busca ser.

## Estado

Es un MVP de hackathon. Funciona en local con datos de ejemplo de una empresa ficticia: una distribuidora de Costa Rica con áreas de oficina, bodega y campo. Todavía no tiene autenticación (un selector «ver como» elige la persona) ni despliegue en internet.

## Cómo arrancarlo

### Requisitos

- Node.js 24 o superior (indicado en `engines` de `package.json`).
- pnpm 12.14.0 (fijado en el campo `packageManager` de `package.json`).

### Pasos

1. Clona el repositorio. Necesitas acceso al repositorio privado (ver la sección de trabajo en equipo):

   ```bash
   git clone https://github.com/brybamol/Nexo.git
   ```

2. Entra a la carpeta del proyecto:

   ```bash
   cd Nexo
   ```

3. Activa corepack, que descarga la versión de pnpm que exige el repositorio (12.14.0):

   ```bash
   corepack enable
   ```

4. Instala las dependencias:

   ```bash
   pnpm install
   ```

5. Arranca la aplicación en modo desarrollo:

   ```bash
   pnpm dev
   ```

6. Abre en el navegador la dirección `http://localhost:3000`. Nexo redirige a «Mi día».

No hay que instalar ni configurar ninguna base de datos. Nexo usa PGlite, una base PostgreSQL embebida que guarda sus datos en la carpeta `.data/` dentro del proyecto. Al arrancar, crea las tablas y carga sola los datos de ejemplo. Si el proyecto está dentro de OneDrive, conviene mover esa carpeta con la variable `NEXO_DATA_DIR` (ver `.env.example`).

## Cómo recorrer la demo

La demo es el guion de cuatro minutos del plan (`docs/02-plan-mvp-hackathon.md`). Sigue estos pasos en orden. La hora aparece en la barra superior, junto a los botones del reloj.

1. Pulsa **Reiniciar demo** y confirma. El reloj queda en mié 25 nov, 7:00.
2. Pulsa **+5 min**. El reloj queda en 7:05.
3. En el selector **ver como**, elige a **José Alfaro**. En la caja de captura escribe «No puedo terminar la instalación en La Colina, falta el compresor de 2 HP» y envíala.
4. Cambia a **Lucía Mora** y abre **Mi día**.
5. Pulsa **Siguiente evento**. El reloj queda en 7:35.
6. Pulsa **Siguiente evento**. El reloj queda en 8:05.
7. Cambia a **Mario Chaves** y abre **Mi día**.
8. Pulsa **+5 min**. El reloj queda en 8:10.
9. Cambia a **Lucía Mora** y escribe en la caja de captura «No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local».
10. Cambia a **Marcela Solís** (gerente general), abre **Decisiones** y aprueba la opción A.
11. Con Marcela Solís, escribe en **Preguntar** «¿Cómo vamos con los pedidos de la semana?».
12. Abre **Proyectos** y **Registro**.

> **Advertencia:** **Siguiente evento** primero procesa lo que ya venció a la hora actual, sin mover el reloj; si no hay nada vencido, salta al siguiente evento programado. No lo pulses antes de la primera frase (paso 3). Después de la segunda frase (paso 9) llevaría el reloj a las 10:00 y cambiaría las cifras.

Al final, las cifras esperadas son:

- **6 de 8** trabajos cerrados sin intervención de la gerente (**75 %**).
- **19** seguimientos hechos por Nexo en lugar de una persona.
- **3,4 h** de coordinación ahorradas, marcadas como **estimado**. Es una hipótesis de minutos, no una medición.

## La IA: con y sin clave

Nexo interpreta las frases de dos formas:

- **Sin clave (por defecto):** usa un intérprete local. Entiende bien las frases del guion y los casos de control de `docs/04-empresa-y-casos-de-control.md`. Con otras frases puede no entender o pedir una aclaración.
- **Con clave de la API de Claude:** copia `.env.example` como `.env.local` y escribe tu clave en `ANTHROPIC_API_KEY`. La captura usa `claude-haiku-5-5` y las preguntas usan `claude-opus-5-5`. Si Claude no responde a tiempo (15 segundos) o da un error, Nexo usa el intérprete local y lo indica.

La tarjeta de resultado de cada captura muestra quién respondió: «Respondió: Local», «Respondió: Claude · claude-haiku-5-5» o «Local (respaldo)».

**Aviso honesto:** la integración con Claude está probada solo con un cliente simulado. **No se ha verificado contra la API real.**

El archivo `.env.local` contiene una clave privada. **Nunca lo subas al repositorio.**

## Comandos útiles

Estos son los scripts de `package.json`:

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Arranca la aplicación en `http://localhost:3000`. |
| `pnpm build` | Compila la aplicación para producción. |
| `pnpm test` | Ejecuta todas las pruebas una vez (Vitest). |
| `pnpm test:watch` | Ejecuta las pruebas y las vuelve a correr al cambiar archivos. |
| `pnpm typecheck` | Comprueba los tipos de TypeScript sin generar archivos. |
| `pnpm lint` | Revisa el código con ESLint. |
| `pnpm verificar` | Ejecuta tipos, lint y pruebas en ese orden. Es lo que comprueba GitHub. |
| `pnpm db:reset` | Borra y recrea la base de datos con los datos de ejemplo desde la consola. Detén `pnpm dev` antes. Si la base está abierta, el comando lo avisa. |

## Cómo trabajar en equipo con GitHub

El repositorio `brybamol/Nexo` es privado. El dueño invita a cada colega en GitHub con **Settings → Collaborators → Add people**, y el colega acepta la invitación que le llega por correo.

Flujo para cada cambio:

1. Crea una rama propia: `git switch -c nombre-de-la-rama`.
2. Haz tus cambios y guárdalos con commits.
3. Sube la rama: `git push -u origin nombre-de-la-rama`.
4. Abre un pull request hacia `main`.
5. Espera a que la comprobación automática (tipos, lint y pruebas, definida en `.github/workflows/verificar.yml`) salga en verde.
6. Fusiona el pull request.

Nadie sube cambios directamente a `main`.

## Mapa del repositorio

| Carpeta | Contenido |
|---|---|
| `docs/` | Plan, definición, empresa ficticia y contrato técnico (ver la lista abajo). |
| `src/app` | Páginas de la interfaz (Next.js, App Router) y acciones del servidor en `src/app/acciones/`. |
| `src/componentes` | Piezas de interfaz reutilizables. |
| `src/servicios` | Casos de uso que llama la interfaz: captura, decisiones, Mi día, reloj, cifras. |
| `src/motor` | Reglas de coordinación: marcas, seguimiento, propagación, opciones y decisiones. Es código puro, sin base de datos ni red. |
| `src/ia` | Intérpretes Local y Claude, y la validación de sus respuestas. |
| `src/db` | Esquema de la base (Drizzle), conexión (PGlite o PostgreSQL) y datos de ejemplo en `semilla/`. |
| `src/dominio` | Tipos, constantes, tiempo (hora de Costa Rica), formato y texto. |
| `src/servidor` | Contexto de la aplicación y persona actual. |
| `tests/` | Pruebas: captura, escenarios de coordinación, motor, base de datos e integración del guion. |
| `scripts/` | `reiniciar-db.ts`, que usa el comando `pnpm db:reset`. |
| `.claude/agents/` | Agentes para trabajar el código con Claude Code. |
| `.github/workflows/` | Comprobación automática de cada cambio en GitHub. |

Documentos de `docs/`:

- `01-exploracion.md`: problema, evidencia, opciones con sus pros y contras, y cómo empezar.
- `02-plan-mvp-hackathon.md`: alcance del MVP, guion de la demo, pila técnica, etapas y riesgos.
- `03-etapa-0-definicion.md`: especificación, vocabulario, reglas de coordinación y guion detallado.
- `04-empresa-y-casos-de-control.md`: empresa ficticia, personas, trabajos y casos de control.
- `05-arquitectura-y-planes.md`: contrato técnico, con pila, esquema de datos, firmas, interfaz y planes por etapa.

## Limitaciones conocidas

- No hace WhatsApp ni otros canales de entrada o aviso, como el correo.
- No se integra con ERP, hojas de cálculo ni calendarios.
- No tiene cuentas ni permisos: el selector «ver como» simula a las personas.
- No tiene despliegue: corre solo en local.
- Solo maneja una empresa y no tiene app móvil.
- No incluye diagramas de Gantt, informes ni gráficos de gestión.
- Los datos (personas, clientes, proveedores, precios y cifras) son inventados.
- La integración con la API de Claude no está verificada contra la API real.
- Las preguntas respondidas no aparecen en el registro de acciones.
- Con Claude, una reprogramación de una entrega a un cliente se aplica sin pasar por una decisión (la regla está pendiente de definir).
- El diseño usa fuentes de Windows (Segoe UI y Bahnschrift); en macOS y Linux recurre a equivalentes del sistema.
- Las horas ahorradas son una estimación basada en minutos supuestos (10 por seguimiento y 15 por pregunta), no una medición.
