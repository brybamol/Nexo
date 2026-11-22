# Nexo — Arquitectura y planes por etapa (contrato para los agentes de código)

*Fecha: 20-11-2026 · Estado: contrato vigente · Fuentes: `02` (plan v2), `03` (definición), `04` (empresa y casos)*

Este documento manda sobre el código. Si algo no está aquí, el agente pregunta al orquestador; no inventa. Los **archivos de contrato** (§4.0) quedan congelados al cerrar la tarea 1.1: cambiarlos exige permiso del orquestador.

---

## 1. Pila, dependencias y scripts

Un proyecto Next.js (App Router, `next@latest` estable al crear: 16.x o superior), React 19, TypeScript estricto, Tailwind CSS v4, pnpm 12, Node 24, Windows. **Mutaciones: Server Actions** (`'use server'` en `src/app/acciones/`). No hay route handlers salvo que el orquestador lo pida.

| Paquete | Tipo | Nota |
|---|---|---|
| `next`, `react`, `react-dom` | dep | versión que instale 1.1, fijada en el lockfile |
| `drizzle-orm` | dep | sin `drizzle-kit`: el esquema se crea con SQL idempotente (§3.4) |
| `@electric-sql/pglite` | dep | local y pruebas |
| `pg` | dep | solo si existe `DATABASE_URL` |
| `@anthropic-ai/sdk` | dep | solo si existe `ANTHROPIC_API_KEY` |
| `zod` | dep | v4; valida la interpretación de la IA (`z.toJSONSchema` para la herramienta de Claude) |
| `clsx`, `tailwind-merge`, `lucide-react` | dep | para el agente de diseño; **no** se usa shadcn ni Radix (no se toca `package.json` después de 1.1) |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/pg` | dev | `typescript` 6.0.x: typescript-eslint aún no admite la 7 |
| `tailwindcss`, `@tailwindcss/postcss` | dev | v4: `@import "tailwindcss";` en `globals.css` |
| `eslint`, `eslint-config-next` | dev | configuración plana; `next lint` ya no existe |
| `vitest` | dev | entorno `node`, `pool: 'forks'` |
| `tsx` | dev | para `scripts/reiniciar-db.ts` |

`package.json`: `"type": "module"`, `"packageManager": "pnpm@12.x.y"` (la instalada), `"engines": {"node": ">=24"}`. Scripts:

| Script | Comando |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `db:reset` | `tsx scripts/reiniciar-db.ts` |
| `verificar` | `pnpm typecheck && pnpm lint && pnpm test` |

Configuración fija: `tsconfig` con `strict`, `noUncheckedIndexedAccess`, alias `@/*` → `src/*`. `next.config.ts`: `serverExternalPackages: ['@electric-sql/pglite']`. `vitest.config.ts`: alias `@` → `src` (con `path.resolve`, sin plugins), `testTimeout: 30000`, `env: { TZ: 'UTC' }` (fuerza a no depender de la zona del equipo), `passWithNoTests: true`. ESLint añade a `src/{motor,servicios,ia,dominio,db}/**`: `no-restricted-properties` sobre `Date.now` y `no-restricted-syntax` sobre `NewExpression[callee.name='Date'][arguments.length=0]` (nada usa la hora real). `pnpm-workspace.yaml`: permite los scripts de compilación de `esbuild` y `sharp`. `.gitignore`: `node_modules`, `.next`, `.data`, `.env*` salvo `.env.example`.

Variables de entorno (`.env.example`): `ANTHROPIC_API_KEY` (opcional), `DATABASE_URL` (opcional), `NEXO_DATA_DIR` (opcional; por defecto `<cwd>/.data/pglite`).

---

## 2. Árbol de archivos

Cada archivo hace una cosa. Entre paréntesis, la tarea dueña (§7).

```
package.json · pnpm-workspace.yaml · pnpm-lock.yaml · tsconfig.json · next.config.ts · postcss.config.mjs
eslint.config.mjs · vitest.config.ts · .gitignore · .env.example · next-env.d.ts                (1.1)
scripts/reiniciar-db.ts            Reinicia la base de .data desde consola (falla claro si dev la tiene abierta)  (1.5)
src/dominio/tipos.ts               Tipos de dominio: Persona, Trabajo, Estado, Marcas, Repuesto…  (1.1)
src/dominio/constantes.ts          Ids de personas/proyectos, roles, umbral ₡100.000, intervalos, horario  (1.1)
src/dominio/tiempo.ts              Hora de Costa Rica (UTC−6 fija), horario laboral, días hábiles, resolverPlazo  (1.3)
src/dominio/formato.ts             formatearColones, formatearFecha, formatearHoras  (1.3)
src/dominio/texto.ts               normalizar y similitud (Dice de bigramas)  (1.3)
src/db/esquema.ts                  Tablas Drizzle (§3)  (1.1)
src/db/ddl.ts                      SQL idempotente CREATE … IF NOT EXISTS y SQL de borrado para reiniciar  (1.2)
src/db/conexion.ts                 crearConexion(modo) y singleton en globalThis; PGlite o pg  (1.2)
src/db/semilla/datos.ts            Datos de 04 como constantes tipadas  (1.4)
src/db/semilla/cargar.ts           cargarSemilla(db): inserta todo y fija el reloj  (1.4)
src/db/instantanea.ts              cargarInstantanea(db) y persistirEfectos(db, efectos) en transacción  (1.5)
src/motor/instantanea.ts           Tipo Instantanea e índices puros (porId, dependientes, cadena)  (1.1)
src/motor/efectos.ts               Tipo Efecto (1.1) y aplicarEnMemoria(inst, efectos) puro (1.5)
src/motor/marcas.ts                calcularMarcas: atrasado, en riesgo y causas  (2.4)
src/motor/actualizacion.ts         Efectos de actualizar: notas con problema, liberación, reprogramación  (2.3)
src/motor/seguimiento.ts           tick (R1–R3), registrarRespuesta, siguienteEvento  (3.1)
src/motor/propagacion.ts           efectosBloqueo (R4, R5), causaCitada, avisos por riesgo nuevo  (3.2)
src/motor/plazos.ts                desplazarCadena por días hábiles  (3.3)
src/motor/opciones.ts              calcularOpciones y decisorPara (R6, R7)  (3.3)
src/motor/decision.ts              efectosDecisionNueva, aplicarDecision, rechazarDecision (R8)  (3.3)
src/motor/cifras.ts                calcularCifras (03 §5)  (4.4)
src/ia/interprete.ts               Interfaz InterpreteIA y tipos de entrada/salida  (1.1)
src/ia/esquema-interpretacion.ts   Esquemas zod de Interpretacion (fuente de verdad de la forma)  (1.1)
src/ia/contexto.ts                 construirContextoCaptura(inst, autorId)  (2.3)
src/ia/elegir.ts                   crearInterprete(): Claude si hay clave, si no Local  (2.2)
src/ia/local/interprete-local.ts   Implementación Local: guardadas → heurísticas  (2.1)
src/ia/local/respuestas-guardadas.ts  C01–C15, E1 y E5 como funciones del contexto  (2.1)
src/ia/local/heuristicas.ts        Reglas simples cuando no hay frase guardada  (2.1)
src/ia/local/preguntas-local.ts    clasificarPregunta y redactarRespuesta por plantilla  (4.3)
src/ia/claude/interprete-claude.ts Implementación Claude con respaldo Local  (2.2)
src/ia/claude/prompts.ts           Prompts de sistema y definición de la herramienta  (2.2)
src/servicios/contexto.ts          Tipo ContextoServicio {db, ia}  (1.1)
src/servicios/vistas.ts            Tipos de lo que devuelven los servicios a la interfaz (§4.4)  (1.1)
src/servicios/reloj.ts             obtenerAhora, avanzarReloj, irAlSiguienteEvento, fijarReloj  (1.5)
src/servicios/demo.ts              reiniciarDemo  (1.5)
src/servicios/personas.ts          listarPersonas  (1.5)
src/servicios/consultas-trabajos.ts obtenerTrabajo, listarTrabajos (con marcas)  (1.6)
src/servicios/proyectos.ts         listarProyectos, obtenerProyecto  (1.6)
src/servicios/captura.ts           capturar, responderCaptura  (2.3)
src/servicios/validacion.ts        validarInterpretacion (puro): plan, pregunta o error  (2.3)
src/servicios/aplicar.ts           Convierte un plan validado en efectos y los persiste  (2.3)
src/servicios/estado-trabajos.ts   responderSeguimiento, cambiarEstado  (3.4)
src/servicios/decisiones.ts        listarDecisiones, obtenerDecision, aprobarDecision, rechazarDecision  (3.3)
src/servicios/mi-dia.ts            obtenerMiDia, marcarAvisosLeidos  (4.1)
src/servicios/preguntar.ts         preguntar  (4.3)
src/servicios/registro.ts          listarAcciones  (4.4)
src/servicios/cifras.ts            obtenerCifras  (4.4)
src/servidor/contexto-app.ts       obtenerContextoApp() (singleton) y personaActual() (cookie)  (1.5)
src/app/layout.tsx · page.tsx · globals.css  Marco: barra, captura siempre visible; / → /mi-dia  (1.7)
src/app/proyectos/page.tsx · proyectos/[id]/page.tsx · trabajos/[id]/page.tsx  (1.7)
src/app/mi-dia/page.tsx (4.1) · decisiones/page.tsx (4.2) · preguntar/page.tsx (4.3) · registro/page.tsx (4.4)
src/app/acciones/persona.ts · reloj.ts · demo.ts (1.7) · captura.ts (2.5) · trabajos.ts (4.1) · decisiones.ts (4.2) · preguntar.ts (4.3)
src/componentes/barra-superior.tsx · selector-persona.tsx · control-reloj.tsx · tarjeta-trabajo.tsx · insignia-marcas.tsx  (1.7)
src/componentes/caja-captura.tsx · tarjeta-resultado-captura.tsx · insignia-implementacion.tsx  (2.5)
src/componentes/lista-avisos.tsx · boton-responder.tsx (4.1) · tarjeta-decision.tsx (4.2) · cifras-demo.tsx (4.4)
tests/ayudantes/preparar.ts        prepararDemo(), instantaneaDesdeSemilla()  (1.5)
tests/…                            ver §6
```

---

## 3. Esquema de datos

Ids de texto legibles donde el motor los crea o los cita; `serial` en tablas que nadie referencia desde el motor. Fechas: `timestamptz`. Dinero: `integer` en colones. Listas: `jsonb`.

### 3.1 Tablas

| Tabla | Columnas (tipo; clave) |
|---|---|
| `personas` | `id` text PK (`marcela-solis`…), `nombre` text, `rol` text, `area` text (`Gerencia`/`Oficina`/`Bodega`/`Campo`), `jefe_id` text null FK personas |
| `proyectos` | `id` text PK (`P1`…`P4`, `OD` = Operación diaria), `clave` text único (`COLINA`, `TRIGAL`, `REPUESTOS`, `PEDIDOS`, `DIARIA`), `nombre`, `resultado` text, `responsable_id` FK, `fecha` timestamptz null, `cliente` text null |
| `trabajos` | `id` text PK (`T01`…; nuevos `T31`, `T32`…), `proyecto_id` FK, `numero` int (número dentro del proyecto; único con `proyecto_id`), `titulo`, `responsable_id` FK, `solicitado_por_id` FK null, `plazo` timestamptz, `estado` text (`abierto`/`en_curso`/`bloqueado`/`resuelto`), `urgente` bool, `con_costo_probable` bool, `bloqueado_por_id` text null FK trabajos, `motivo_bloqueo` text null, `fecha_solucion` timestamptz null, `repuesto_id` text null FK (trabajos de conseguir/comprar), `cantidad_repuesto` int null, `etiqueta` text null (`conciliacion_inventario` en T15), `relacionados` jsonb `string[]` default `[]`, `origen` text (`semilla`/`captura`/`decision`), `captura_id` int null, `decision_id` text null, `creado_en`, `resuelto_en` null |
| `dependencias` | `trabajo_id` FK, `depende_de_id` FK; PK compuesta |
| `repuestos` | `id` text PK (`compresor-2hp`, `termostato`, `empaque-puerta`, `gas-refrigerante`, `motor-ventilador`), `nombre`, `unidad`, `existencia` int, `precio_habitual` int, `dias_habitual` int, `precio_local` int, `faltante_reportado_en` timestamptz null, `faltante_reportado_por` FK null |
| `necesidades_repuesto` | `trabajo_id` FK, `repuesto_id` FK, `cantidad` int, `fecha_disponible` timestamptz null, `atendida` bool default false; PK compuesta |
| `notas` | `id` serial, `trabajo_id` FK, `autor_id` null (null = Nexo), `en`, `texto` |
| `eventos` | `id` serial, `en`, `actor_id` null (null = Nexo), `tipo` text, `trabajo_id` null, `decision_id` null, `datos` jsonb |
| `acciones` | `id` serial, `en`, `tipo` text, `motivo` text, `hecho_origen` text, `trabajo_ids` jsonb, `decision_id` null, `destinatario_id` null, `captura_id` null |
| `avisos` | `id` serial, `persona_id` FK, `accion_id` FK acciones, `en`, `titulo`, `cuerpo`, `trabajo_ids` jsonb, `leido_en` null |
| `seguimientos` | `id` text PK (`S1`…), `trabajo_id` FK, `plazo_referencia` timestamptz, `nivel` int (0 solicitud, 1 recordatorio, 2 escalamiento 1, 3 escalamiento 2), `destinatario_id` FK, `urgente` bool, `proximo_en` timestamptz, `estado` (`pendiente`/`respondido`/`agotado`), `iniciado_en` |
| `decisiones` | `id` text PK (`D01`…), `creada_en`, `proyecto_id`, `numero` int (número de decisión dentro del proyecto), `proponente_id`, `decisor_id`, `captura_id` null, `repuesto_id`, `cantidad` int, `contexto` text, `afectados` jsonb `{trabajoIds, personaIds}`, `opcion_propuesta` text null, `estado` (`pendiente`/`aprobada`/`rechazada`), `opcion_elegida` text null, `decidida_en` null, `motivo_rechazo` null |
| `opciones_decision` | `decision_id` FK, `letra` (`A`/`B`/`C`); PK compuesta; `descripcion`, `costo` int, `lineas` jsonb `[{proveedor, cantidad, precioUnitario, llegada, trabajoIds}]`, `cambios_fecha` jsonb `[{trabajoId, de, a}]`, `consecuencia` text |
| `capturas` | `id` serial, `autor_id`, `texto`, `en`, `implementacion` text, `modelo` text null, `interpretacion` jsonb, `estado` (`aplicada`/`pregunta`/`duplicado`/`ignorada`/`respuesta`/`error`), `pregunta` text null, `resultado` jsonb |
| `preguntas` | `id` serial, `persona_id`, `en`, `texto`, `tema`, `respuesta`, `fuentes` jsonb, `implementacion`, `modelo` null |
| `reloj` | `id` int PK (siempre 1), `ahora` timestamptz |

Tipos de `acciones.tipo`: `crear_trabajo`, `actualizar_trabajo`, `pedir_estado`, `recordatorio`, `escalamiento`, `aviso`, `crear_decision`, `aplicar_decision`, `responder_pregunta`, `corregir_existencia`. Las de tipo `pedir_estado`, `recordatorio`, `escalamiento` y `aviso` tienen exactamente un destinatario y un aviso. Eventos (`eventos.tipo`): `trabajo_creado`, `estado_cambiado`, `plazo_cambiado`, `nota_agregada`, `existencia_corregida`, `faltante_reportado`, `decision_creada`, `decision_aprobada`, `decision_rechazada`, `respuesta_seguimiento`. Los cambios que provoca una decisión se registran con `actor_id` = quien decidió.

### 3.2 Cómo se representa cada concepto

- **Atrasado y En riesgo** no se guardan: `calcularMarcas(inst)` los calcula siempre desde la instantánea (§4.2). Ninguna tabla tiene columnas de marcas.
- **Reportado como faltante**: `repuestos.faltante_reportado_en` no nulo.
- **Relación trabajo–bloqueante**: `trabajos.bloqueado_por_id` (T04 → T31 en el guion) más `estado = 'bloqueado'`. No crea fila en `dependencias`.
- **Fecha de solución**: `trabajos.fecha_solucion` (cuándo se espera levantar el bloqueo). En la necesidad, `necesidades_repuesto.fecha_disponible` (cuándo llega el repuesto comprado).
- **Ahora**: `reloj.ahora`. Se lee con `obtenerAhora`; nadie usa la hora del sistema.
- **Nombres visibles (reforma de nombres).** Los ids (`T04`, `D01`, y `C1` en el correo) son de la especificación y del código: claves de la base, del motor, de las rutas (`/trabajos/T04`) y de las pruebas. **Nunca se muestran.** Las personas ven el **título** y, como referencia secundaria, `CLAVE-número`: un trabajo es «Cableado y tablero de control» (`COLINA-5`); una decisión, «Compra de 3 compresores de 2 HP» (`COLINA-D1`); un compromiso de correo, «Revisar el contrato de TransLog» (`TRANSLOG-2`). `numero` se asigna al crear, con `siguienteNumeroTrabajo`/`siguienteNumeroDecision` sobre la instantánea leída tras `tomarTurnoEscritura`, en la misma transacción que inserta (sin duplicados; además hay `UNIQUE (proyecto_id, numero)`), y no cambia nunca. El formato vive solo en `dominio/nombres.ts`; ningún texto construye un id a mano. En frases se cita «Título» (REF); en etiquetas, Título (REF); no se repite el proyecto, que ya está en la clave. Una persona puede escribir la referencia en la captura («sigo con COLINA-4») y se resuelve como el id interno. Correo: la referencia se calcula (no se guarda) con la clave del proyecto de nombre propio (`TRANSLOG`, `NAVIDAD`) y la numeración en el orden de los códigos, antes de aplicar correcciones; un compromiso sin proyecto de nombre propio se nombra solo por su título.

### 3.3 Semilla (04)

Personas con id = nombre en minúsculas sin tildes, unido con guion (`jose-alfaro`, `lucia-mora`…). Claves de proyecto en `CLAVES_PROYECTO` (`constantes.ts`); los 30 trabajos se numeran por proyecto en su orden (T01–T07 → COLINA-1…7, T08–T13 → TRIGAL-1…6, T14–T18 → REPUESTOS-1…5, T19–T30 → PEDIDOS-1…12; tabla en 04 §3); el T31 del guion es COLINA-8 y la compra que crea la decisión, COLINA-9. Plazos sin hora = 17:00 de ese día; con hora, la indicada (T04 mié 17:00, T22 10:00, T23 14:00, T28 12:00, T29 16:00). `creado_en` = lun 23 7:00; `resuelto_en` = plazo en los 8 resueltos (T01, T02, T03, T08, T09, T14, T19, T20). En curso: T04, T23. Necesidades: T04, T10, T11 → 1 `compresor-2hp`; T25 → 4 `termostato` y 10 `empaque-puerta`. T15 lleva `etiqueta = 'conciliacion_inventario'`. Repuestos con los precios de 04 y `dias_habitual` 6/3/3/3/6. Reloj: `2026-11-25T07:00:00-06:00`. Sin seguimientos ni acciones iniciales. Historial de la gerente: 2 notas de `marcela-solis` con su evento `nota_agregada` (`actor_id` = `marcela-solis`): T19 lun 23 10:00 «Confirmé con Soda El Roble la hora de entrega» y T20 mar 24 10:00 «Pedí priorizar al Hotel Mirador». Nota de T21 (04): `diego-rojas`, mar 24 15:30, «El cliente estaba cerrado el martes; los congeladores volvieron a bodega», con su evento `nota_agregada` (`actor_id` = `diego-rojas`; no cuenta como intervención de la gerente). La respuesta de C13 la cita como motivo del atraso de 1043. No hay más eventos iniciales (3 notas, 3 eventos).

### 3.4 Arranque y reinicio

`ddl.ts` exporta `DDL_CREAR` (todas las tablas con `CREATE TABLE IF NOT EXISTS`, en orden de claves foráneas) y `DDL_BORRAR` (`DROP TABLE IF EXISTS … CASCADE` de todas). Se ejecutan con el cliente crudo: `pglite.exec(sql)` o `pool.query(sql)` (sin parámetros, admite varias sentencias). Al abrir la conexión: `DDL_CREAR` y, si `personas` está vacía, `cargarSemilla`. `reiniciarDemo` = `DDL_BORRAR` + `DDL_CREAR` + `cargarSemilla` en una transacción. Elegido sobre las migraciones de drizzle porque no lee archivos en tiempo de ejecución ni depende de una CLI (robusto con el empaquetador y en Windows). La tarea 1.2 incluye una prueba que inserta y lee cada tabla con Drizzle para detectar desajustes entre `esquema.ts` y `ddl.ts`. `DDL_CREAR` termina con una puesta al día idempotente para bases anteriores a la reforma de nombres: añade `proyectos.clave`, `trabajos.numero` y `decisiones.numero` si faltan y los rellena (claves de `CLAVES_PROYECTO`; trabajos por proyecto en orden de id; decisiones por fecha).

---

## 4. Tipos y firmas

### 4.0 Archivos de contrato (escritos completos en 1.1, congelados después)
`dominio/tipos.ts`, `dominio/constantes.ts`, `db/esquema.ts`, `motor/instantanea.ts`, el tipo de `motor/efectos.ts`, `ia/interprete.ts`, `ia/esquema-interpretacion.ts`, `servicios/contexto.ts`, `servicios/vistas.ts`. Además 1.1 crea **todos** los demás archivos de §2 como esqueletos con la firma exacta: los servicios lanzan `new NoImplementado('<archivo>')`; las funciones del motor devuelven un valor neutro (`[]`, `new Map()`, `null`); los componentes devuelven un marcador simple. Así `typecheck` y `build` pasan desde el primer día y cada tarea solo rellena sus archivos.

**Precisiones fijadas por 1.1** (el código manda en el detalle): `NoImplementado` y `ErrorDominio` viven en `dominio/tipos.ts`. Los tipos que cruzan capas se definen en `dominio/tipos.ts` y los archivos de §4.2–4.4 los reexportan: `PersonaBreve`, `PlazoPropuesto`, `PropuestaCompra`, `OpcionCalculada`, `CambioFecha`, `HechoBloqueo`, `Cifras` y el plan validado `Plan` (`PlanTrabajoNuevo | PlanActualizacion | …`: la `Interpretacion` con ids comprobados y plazos ya resueltos a `Date`). `Decision` incluye `opciones: OpcionCalculada[]` (la carga `cargarInstantanea`). `Db` y el objeto `esquema` (todas las tablas) se exportan de `db/esquema.ts`; una transacción `tx` también es `Db`. Firmas que §4 no daba: `persistirEfectos(db, efectos): Promise<{ accionIds: number[] }>`; `validarInterpretacion(inst, interp, autorId): ResultadoValidacion`; `aplicarPlan(db, inst, plan, autorId, capturaId): Promise<ResultadoAplicacion>`; `crearConexion(modo: ModoConexion): Promise<Conexion>` con `Conexion { db; ejecutarSql(sql); cerrar() }` y `obtenerConexion()` (singleton); `crearInterprete(claveApi = process.env.ANTHROPIC_API_KEY)`; `prepararDemo(): Promise<{ ctx; cerrar() }>`.

### 4.1 Dominio y tiempo
```ts
export type EstadoTrabajo = 'abierto' | 'en_curso' | 'bloqueado' | 'resuelto';
export type CausaRiesgo = { tipo: 'bloqueado' | 'atrasado' | 'repuesto' | 'cadena'; trabajoId?: string; repuestoId?: string };
export interface Marcas { atrasado: boolean; enRiesgo: boolean; causas: CausaRiesgo[] }
// constantes.ts
export const ZONA = 'America/Costa_Rica'; export const DESFASE_CR = '-06:00';
export const UMBRAL_GERENTE = 100_000; export const HORA_INICIO = 7; export const HORA_FIN = 17;
export const MIN_URGENTE = 30; export const HORAS_LABORALES_NORMAL = 4;
export const HORA_ENTREGA_LOCAL = '15:00'; export const HORA_LLEGADA_HABITUAL = '07:00';
export const ROL_GERENTE = 'Gerente general'; export const ROL_JEFE_OPERACIONES = 'Jefe de operaciones';
export const ROL_COMPRAS = 'Encargada de compras'; export const ROL_SERVICIO_CLIENTE = 'Servicio al cliente';
// tiempo.ts (todas puras; CR no tiene horario de verano: desfase fijo −06:00)
export function enCR(fecha: string, hora: string): Date;                  // '2026-11-25','12:00' → instante
export function partesCR(d: Date): { fecha: string; hora: string; diaSemana: number };
export function esDiaHabil(d: Date): boolean;                              // lunes a viernes
export function sumarMinutos(d: Date, m: number): Date;
export function sumarHorasLaborales(d: Date, h: number): Date;             // salta noches y fines de semana (7:00–17:00)
export function sumarDiasHabiles(d: Date, n: number): Date;                // conserva la hora
export function diasHabilesEntre(a: Date, b: Date): number;                // fechas de calendario CR, b ≥ a
export function siguienteDiaHabil(d: Date): Date;                          // mismo reloj, día hábil siguiente
export function resolverPlazo(p: PlazoPropuesto, urgente: boolean, ahora: Date): Date;
// formato.ts
export function formatearColones(n: number): string;   // 1380000 → '₡1.380.000'
export function formatearFecha(d: Date): string;       // 'mié 25 nov, 15:00'
export function formatearHoras(min: number): string;   // 205 → '3,4 h'
// nombres.ts (reforma de nombres: lo ÚNICO que da forma a nombres y referencias visibles)
export function referenciaTrabajo(clave, numero): string;     // 'COLINA', 4 → 'COLINA-4'
export function referenciaDecision(clave, numero): string;    // 'COLINA', 1 → 'COLINA-D1'
export function nombreConReferencia(titulo, ref): string;     // 'Cableado y tablero de control (COLINA-5)' (etiquetas, enlaces)
export function citaConReferencia(titulo, ref): string;       // '«Cableado y tablero de control» (COLINA-5)' (frases)
export function tituloDecision(repuesto, cantidad): string;   // 'Compra de 3 compresores de 2 HP'
export function referenciasEnTexto(texto): string[];          // 'sigo con colina-4' → ['COLINA-4']
export function idsInternosEn(texto): string[];               // red de pruebas: T04, D01, S1, C1 sueltos
export function crearNombrador(f): Nombrador;                 // referencia/nombre/cita/citas/ref/refs/resolver, y lo mismo para decisiones
// texto.ts
export function normalizar(s: string): string;         // minúsculas, sin tildes ni puntuación, espacios simples
export function similitud(a: string, b: string): number; // Dice de bigramas sobre textos normalizados, 0..1
```
**`resolverPlazo`:** con `hora` → ese día a esa hora. Sin hora: `dia` `'hoy'` urgente → 12:00 si `ahora` < 12:00, si no 17:00; `'hoy'` normal → 17:00; `'manana'` → siguiente día hábil 17:00; `'AAAA-MM-DD'` → 17:00. **Vencido** = `ahora ≥ plazo`.

### 4.2 Motor (todo puro, sin base de datos)
```ts
export interface Instantanea { ahora: Date; personas: Persona[]; proyectos: Proyecto[]; trabajos: Trabajo[];
  dependencias: Dependencia[]; repuestos: Repuesto[]; necesidades: NecesidadRepuesto[];
  seguimientos: Seguimiento[]; decisiones: Decision[] }
export type Efecto =
  | { tipo: 'crear_trabajo'; trabajo: Trabajo; necesidades: NecesidadRepuesto[]; actorId: string | null }
  | { tipo: 'actualizar_trabajo'; trabajoId: string; cambios: Partial<Pick<Trabajo,
      'estado'|'plazo'|'bloqueadoPorId'|'motivoBloqueo'|'fechaSolucion'|'resueltoEn'>>; actorId: string | null }
  | { tipo: 'agregar_nota'; trabajoId: string; autorId: string | null; texto: string }
  | { tipo: 'actualizar_repuesto'; repuestoId: string; cambios: Partial<Pick<Repuesto,
      'existencia'|'faltanteReportadoEn'|'faltanteReportadoPor'>>; actorId: string | null }
  | { tipo: 'actualizar_necesidad'; trabajoId: string; repuestoId: string; cambios: { fechaDisponible?: Date | null; atendida?: boolean } }
  | { tipo: 'crear_seguimiento'; seguimiento: Seguimiento }
  | { tipo: 'actualizar_seguimiento'; seguimientoId: string; cambios: Partial<Seguimiento> }
  | { tipo: 'crear_decision'; decision: Decision }   // Decision.opciones: OpcionCalculada[] (filas de opciones_decision)
  | { tipo: 'actualizar_decision'; decisionId: string; cambios: Partial<Omit<Decision, 'id' | 'opciones'>> }
  | { tipo: 'accion'; accion: AccionNueva; aviso: AvisoNuevo | null }   // aviso.personaId = accion.destinatarioId
  | { tipo: 'evento'; evento: EventoNuevo };
// instantanea.ts (índices puros)
export function porId<T extends { id: string }>(xs: T[]): Map<string, T>;
export function dependientesDirectos(inst: Instantanea, trabajoId: string): string[];
export function cadenaDependientes(inst: Instantanea, trabajoId: string): string[];  // transitiva, orden BFS, sin repetir
export function siguienteIdTrabajo(inst: Instantanea): string;   // 'T31' si el máximo es T30
export function siguienteIdDecision(inst: Instantanea): string;  // 'D01', 'D02'…
export function siguienteIdSeguimiento(inst: Instantanea): string;
export function siguienteNumeroTrabajo(inst: Instantanea, proyectoId: string): number;   // máximo del proyecto + 1
export function siguienteNumeroDecision(inst: Instantanea, proyectoId: string): number;
export function nombrador(inst: Instantanea): Nombrador;         // crearNombrador(inst): así citan el motor y los servicios
// efectos.ts
export function aplicarEnMemoria(inst: Instantanea, efectos: Efecto[]): Instantanea; // para comparar antes/después
// marcas.ts
export function calcularMarcas(inst: Instantanea): Map<string, Marcas>;  // una entrada por trabajo
// seguimiento.ts
export function tick(inst: Instantanea): Efecto[];                         // R1, R2, R3 hasta inst.ahora
export function siguienteEvento(inst: Instantanea): Date | null;           // menor instante futuro > ahora
export function iniciarSeguimientoUrgente(inst: Instantanea, trabajoId: string): Efecto[]; // nivel 0 al crear
export function registrarRespuesta(inst: Instantanea, trabajoId: string, personaId: string): Efecto[];
// propagacion.ts
export function efectosBloqueo(inst: Instantanea, hecho: HechoBloqueo): Efecto[];   // estado, faltante, R4, R5
export function avisosPorRiesgoNuevo(antes: Instantanea, despues: Instantanea, hecho: string): Efecto[];
export function causaCitada(inst: Instantanea, repuestoId: string): string | null;  // 'T15' si aplica
export type HechoBloqueo = { trabajoBloqueadoId: string; bloqueanteId: string; motivo: string;
  repuestoFaltanteId: string | null; autorId: string; descripcion: string };
// actualizacion.ts
export function efectosActualizacion(inst: Instantanea, plan: PlanActualizacion, autorId: string): Efecto[];
// plazos.ts
export function desplazarCadena(inst: Instantanea, nuevos: Map<string, Date>): CambioFecha[]; // incluye los de `nuevos`
// opciones.ts
export type PropuestaCompra = { repuestoId: string; cantidad: number; proveedor: 'local' | 'habitual' | null;
  ajustePrecioPct: number | null; existenciaReal: number | null };
export interface OpcionCalculada { letra: 'A' | 'B' | 'C'; descripcion: string; costo: number;
  lineas: { proveedor: 'local' | 'habitual'; cantidad: number; precioUnitario: number; llegada: Date; trabajoIds: string[] }[];
  cambiosFecha: CambioFecha[]; consecuencia: string }
export type CambioFecha = { trabajoId: string; de: Date; a: Date };
export function calcularOpciones(inst: Instantanea, p: PropuestaCompra): OpcionCalculada[];
export function decisorPara(inst: Instantanea, opciones: OpcionCalculada[]): string;  // personaId
// decision.ts
export function efectosDecisionNueva(inst: Instantanea, p: PropuestaCompra, proponenteId: string,
  proyectoId: string, capturaId: number | null): Efecto[];
export function aplicarDecision(inst: Instantanea, decisionId: string, letra: 'A'|'B'|'C', decisorId: string): Efecto[];
export function rechazarDecision(inst: Instantanea, decisionId: string, decisorId: string, motivo: string): Efecto[];
// cifras.ts
export function calcularCifras(d: { trabajos: Trabajo[]; eventos: Evento[]; acciones: Accion[];
  preguntasRespondidas: number; gerenteId: string }): Cifras;
```

**Reglas exactas del motor** (completan R1–R10; ver §8 para lo que se resolvió):
1. **Fuentes de riesgo:** trabajo no resuelto que esté (a) atrasado; (b) bloqueado sin `fecha_solucion`, o con `fecha_solucion` > plazo; (c) con una necesidad no atendida cuyo repuesto tenga existencia 0 o faltante reportado, salvo que `fecha_disponible` ≤ plazo. **En riesgo** = trabajos no resueltos ni bloqueados que son fuente (c) o están en la cadena de dependientes de cualquier fuente o de otro trabajo en riesgo. `causas` guarda el origen.
2. **Seguimiento:** R1 crea un seguimiento por (trabajo, `plazo_referencia`) cuando `ahora ≥ plazo` y no está resuelto; `proximo_en` = plazo + intervalo. Un trabajo urgente creado por captura abre el seguimiento al crearse (`plazo_referencia` = creación; el aviso de asignación cuenta como la solicitud). Intervalo: urgente 30 min; normal 4 horas laborales. Niveles: 0→1 recordatorio al responsable; 1→2 escalamiento a su jefe; 2→3 escalamiento al jefe del jefe; después `agotado`. Sin jefe → `agotado`. Cada nivel se programa desde el anterior **programado**, no desde la hora real del tick; `tick` procesa todos los vencidos en orden. *Precisiones de 3.1:* `nivel` es el último hecho; el seguimiento pasa a `agotado` en el mismo paso en que ya no queda nivel (tras el nivel 3, o al no haber jefe siguiente), así que no deja eventos vacíos. R1 no abre otro seguimiento mientras el trabajo tenga uno `pendiente`. Las acciones llevan `en` = `ahora` del tick (e `iniciadoEn` de R1 también); saltar el reloj da los mismos niveles, textos y estado final que avanzar paso a paso, salvo esas horas. `tick` cierra como `respondido` (sin evento) los pendientes de trabajos ya resueltos y los de R1 cuyo trabajo tiene el plazo movido al futuro (`plazo_referencia` ≠ plazo y plazo > ahora; el urgente de captura, con `plazo_referencia` = creación, no se cierra por esto): Nexo no persigue a nadie hasta que venza el plazo nuevo (E5, T21). `iniciarSeguimientoUrgente` solo emite `crear_seguimiento` (la acción de asignación la emite la captura) y exige que `inst` ya contenga el trabajo. `siguienteEvento` considera lo que produciría un tick a la hora actual.
3. **Respuesta:** cierra el seguimiento pendiente (`respondido`) cualquier acción del responsable o de un destinatario de la cadena sobre ese trabajo: captura interpretada como actualización o decisión relacionada, botón Responder, o cambio de estado. Resolver un trabajo cierra sus seguimientos. *Precisión posterior a 4.6:* si el trabajo está `bloqueado` por otro que no está resuelto, pedir `en_curso` o `abierto` no cambia su estado ni libera nada: se cierra el seguimiento, se guarda la nota y la acción y el resumen dicen «T04 sigue bloqueado por T31». Resolverlo sí se permite; lo normal es que lo libere resolver su bloqueante (regla 5). *Precisión de 3.1:* `registrarRespuesta` cierra los pendientes si la persona es el responsable o un jefe al que ya se escaló (nivel ≥ 2 el jefe, nivel 3 el jefe del jefe) y emite el evento `respuesta_seguimiento` (actor = la persona, `datos: { seguimientoId, nivel }`); si no, devuelve `[]`.
4. **Avisos por bloqueo (R4, R5):** al bloquear, comparar marcas antes/después; cada trabajo que pasa a en riesgo genera aviso a su responsable, agrupado en uno por persona, excluyendo al autor. Si el repuesto tenía existencia > 0 en sistema, el aviso cita los trabajos no resueltos con `etiqueta = 'conciliacion_inventario'` (T15). Quitar riesgo fuera de una decisión **no** avisa. *Precisión de 3.2:* cada aviso es una acción `aviso` cuyos `trabajo_ids` son solo los trabajos de esa persona que pasan a en riesgo (Mario: [T05, T11]); el bloqueante y T15 se citan en el cuerpo; `hecho_origen` = `descripcion` del hecho.
5. **Liberación:** cuando un trabajo X pasa a resuelto o sale de bloqueado, Nexo avisa a los responsables de los dependientes directos no resueltos de X (excluido el autor). Cuando se resuelve **cualquier** trabajo X, los trabajos bloqueados por él vuelven a `en_curso`, se limpian `bloqueado_por_id`, `motivo_bloqueo` y `fecha_solucion`, y se avisa a su responsable (son dependientes directos de X; excluido el autor) y, como salen de bloqueado, a los de sus dependientes directos; si X tiene `repuesto_id`, además su necesidad de ese repuesto queda `atendida`. *(Generalizado en 3.3: antes solo liberaba con `repuesto_id` y C15 dejaba T24 bloqueado por un trabajo resuelto.)*
6. **Nota con problema** (`hayProblema`): avisa a los responsables de los trabajos de los que depende X no resueltos y, si X tiene dependientes no resueltos, al responsable del proyecto de esos dependientes. Excluye al autor.
7. **Reprogramación:** si cambia el plazo de un trabajo alguien que no es su responsable, se avisa al responsable. Las notas en trabajos relacionados no avisan. R5 agrupa todo lo de un mismo hecho en un aviso por persona.
8. **Opciones:** necesidades no atendidas del repuesto, ordenadas por plazo (empate: bloqueado primero). *Precisión de 3.3:* solo esperan la compra las necesidades sin `fecha_disponible`, de trabajos no resueltos, que la existencia real no cubre (existencia = `existenciaReal` si viene; si no, 0 con faltante reportado; si no, la del sistema; se descuenta en ese orden) y que caben en la cantidad; esos trabajos son las `trabajoIds` de las líneas y los únicos que pueden cambiar de fecha (C06: los 40 m en existencia cubren T25, así que no hay C ni cambios de fecha). Llegada local = hoy 15:00 si `ahora` < 15:00 en día hábil, si no siguiente día hábil 15:00. Llegada habitual = hoy + `dias_habitual` días **naturales**, 07:00. Precio habitual × (1 + ajuste/100), redondeado. **A** = todo local; **B** = todo habitual; **C** = 1 unidad local para el primer trabajo y el resto habitual (solo si cantidad ≥ 2 y hay ≥ 2 trabajos). Por opción: trabajo cuya llegada > plazo → nuevo plazo = día de llegada 17:00; después `desplazarCadena` mueve cada dependiente los mismos días hábiles que su predecesor más desplazado. **Decisor:** costo máximo de las opciones ≤ ₡100.000 → jefe de operaciones; si no, gerente general.
9. **Aplicar decisión (R8):** crea un trabajo de compra por línea para la persona con `ROL_COMPRAS` (título `Comprar {n} {repuesto} al proveedor {local|habitual}`, plazo = llegada, `repuesto_id`, `origen = 'decision'`); pone `fecha_disponible` en las necesidades cubiertas; a los trabajos bloqueados por un trabajo del mismo repuesto les pone `fecha_solucion` = llegada; aplica `cambiosFecha`; el bloqueante (T31) pasa a `en_curso` con plazo = llegada más temprana; si hay cambios de fecha, crea un trabajo para `ROL_SERVICIO_CLIENTE` «Avisar del atraso a {clientes}», plazo hoy 17:00. Avisa, uno por persona: responsables de trabajos que pierden el riesgo, cambian de plazo o reciben fecha de solución, el proponente y los responsables de los trabajos nuevos. **Rechazar:** aviso al proponente con el motivo. *Precisiones de 3.3:* la fecha de solución de cada bloqueado es la llegada de la línea que lo cubre (si ninguna, la más temprana); los trabajos nuevos tienen `solicitado_por` = decisor, no son urgentes y no llevan acción `crear_trabajo` aparte (los registra la acción `aplicar_decision`); ningún aviso va al decisor. Crear la decisión emite `corregir_existencia` (si cambia), `crear_decision`, el evento `decision_creada` (actor = proponente) y un único aviso al decisor (ninguno si decisor = proponente); no avisa de riesgos nuevos.

### 4.3 IA
```ts
export type PlazoPropuesto = { dia: 'hoy' | 'manana' | string /* AAAA-MM-DD */; hora?: string /* HH:mm */ };
export type Interpretacion =
  | { tipo: 'trabajo_nuevo'; titulo: string; proyectoId: string; responsableId: string;
      responsableSeguro: boolean;            // false → R9: se pregunta confirmación
      plazo: PlazoPropuesto; urgente: boolean; conCostoProbable: boolean;
      relacionados: string[]; bloquea: string[]; repuestoFaltante: { repuestoId: string } | null }
  | { tipo: 'actualizacion'; trabajoId: string; nuevoEstado: EstadoTrabajo | null; nota: string | null;
      hayProblema: boolean; reprogramar: { trabajoId: string; plazo: PlazoPropuesto }[];
      notasRelacionadas: { trabajoId: string; nota: string }[] }
  | { tipo: 'duplicado'; trabajoId: string }
  | { tipo: 'decision'; proyectoId: string; resumen: string;
      compra: { repuestoId: string; cantidad: number | null; proveedor: 'local' | 'habitual' | null; ajustePrecioPct: number | null };
      existenciaReal: number | null; trabajoRelacionadoId: string | null }
  | { tipo: 'no_es_trabajo'; motivo: string }
  | { tipo: 'pregunta'; pregunta: string };
export type TemaPregunta = 'pedidos_semana' | 'estado_proyectos' | 'atrasados' | 'mis_pendientes' | 'desconocido';
export interface ContextoCaptura { ahora: string; autor: PersonaBreve; personas: (PersonaBreve & { jefeId: string | null })[];
  proyectos: { id: string; clave: string; nombre: string; responsableId: string }[];
  trabajosAbiertos: { id: string; referencia: string /* COLINA-4 */; titulo: string; proyectoId: string; responsableId: string; estado: EstadoTrabajo;
    plazo: string; bloqueadoPorId: string | null; repuestoId: string | null }[];
  repuestos: { id: string; nombre: string; existencia: number }[]; seguimientosPendientesDelAutor: string[] }
export type ResultadoIA<T> = { valor: T; implementacion: 'claude' | 'local'; modelo: string | null; respaldo: boolean };
export interface InterpreteIA {
  readonly nombre: 'claude' | 'local';
  interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>>;
  clasificarPregunta(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<TemaPregunta>>;
  redactarRespuesta(pregunta: string, hechos: HechosPregunta): Promise<ResultadoIA<string>>;
}
export type HechosPregunta = { tema: TemaPregunta; datos: Record<string, unknown>; fuentes: { trabajoId: string; etiqueta: string }[] };
```
- **Local:** busca la frase en `respuestas-guardadas.ts` (`{ frase, construir(ctx) => Interpretacion | null }`): coincidencia exacta tras `normalizar`, si no la de mayor `similitud` ≥ 0,8. `construir` resuelve ids dinámicos desde el contexto (C14: el trabajo que bloquea a T04; C11: el trabajo abierto del autor con `repuestoId = compresor-2hp`; E1: el único trabajo con seguimiento pendiente del autor). Sin coincidencia, heurísticas en este orden: pregunta (`¿`/`?` con cómo/qué/cuántos/cuál) → `pregunta`; solo agradecimiento → `no_es_trabajo`; terminación («listo», «ya la/lo …») con un seguimiento pendiente → `actualizacion` a `resuelto`; si no, `trabajo_nuevo` en `OD`, responsable = jefe del autor, `responsableSeguro: false`, plazo `hoy`.
- **Claude:** `messages.create` con una herramienta `registrar_interpretacion` (esquema de `z.toJSONSchema`) y `tool_choice` forzado; captura con `claude-haiku-5-5`, preguntas con `claude-opus-5-5`; tiempo máximo 15 s. Salida inválida, error o tiempo agotado → respaldo Local con `respaldo: true`. El SDK se importa solo en `ia/claude/` y se instancia solo si hay clave.
- **Referencias (reforma de nombres):** el contexto lleva el id interno y la referencia visible de cada trabajo; la IA devuelve el id interno, pero si devuelve la referencia, `validarInterpretacion` la traduce de forma determinista (`Nombrador.resolver`). El Local reconoce una referencia escrita («sigo con COLINA-4» → `actualizacion` de T04; «ya quedó PEDIDOS-10» → `resuelto`) y, por compatibilidad, el id interno. Para redactar respuestas, Claude recibe los hechos sin `trabajoId` ni `id` y, si su texto trae un id interno, se usa la plantilla Local (`respaldo: true`).
- **La IA solo propone.** `validarInterpretacion` (puro) comprueba que existan persona, proyecto, trabajos y repuesto; que el trabajo a actualizar no esté resuelto; y decide la **única** pregunta (prioridad: responsable no seguro → cantidad nula → nada). *Repeticiones (corrección posterior a 4.6):* un `trabajo_nuevo` cuyo `bloquea` incluye un trabajo ya bloqueado por otro no resuelto es `duplicado` de ese bloqueante (no se crea ni se cambia nada; se comprueba antes de la pregunta de responsable); una `decision` con otra `pendiente` del mismo repuesto y proyecto es `error` «Ya está pendiente la decisión D01 sobre …, esperando a …. No creé nada.» (antes de preguntar la cantidad). Devuelve `{ tipo: 'plan', plan } | { tipo: 'pregunta', texto, opciones } | { tipo: 'error', mensaje }`.

### 4.4 Servicios y vistas
Todos reciben `ctx: ContextoServicio = { db: Db; ia: InterpreteIA }` como primer argumento. `Db = PgDatabase<PgQueryResultHKT, typeof esquema>`. Cada mutación: transacción → `tomarTurnoEscritura(tx)` (cerrojo `pg_advisory_xact_lock` que serializa las mutaciones: con `DATABASE_URL` dos capturas a la vez no calculan el mismo id ni se aprueba dos veces una decisión) → `cargarInstantanea` → motor → `persistirEfectos`.
```ts
// reloj.ts
obtenerAhora(ctx): Promise<Date>;
avanzarReloj(ctx, minutos: number): Promise<ResultadoTick>;       // suma (0 a 10.080 = 7 días; si no, ErrorDominio) y ejecuta tick
irAlSiguienteEvento(ctx): Promise<ResultadoTick>;                  // si el tick en ahora produce acciones, lo ejecuta sin mover el reloj; si no, siguienteEvento ?? +30 min, y tick
fijarReloj(ctx, ahora: Date): Promise<ResultadoTick>;              // solo pruebas; error si retrocede
type ResultadoTick = { ahora: string; acciones: AccionVista[] };
// captura.ts
capturar(ctx, autorId: string, texto: string): Promise<ResultadoCaptura>;
responderCaptura(ctx, capturaId: number, respuesta: string): Promise<ResultadoCaptura>;
type MetaIA = { implementacion: 'claude' | 'local'; modelo: string | null; respaldo: boolean };
type ResultadoCaptura = { capturaId: number; ia: MetaIA } & (
  | { estado: 'aplicada'; resumen: string; trabajosCreados: string[]; trabajosActualizados: string[]; decisionId: string | null; decision?: DecisionRef | null; avisosA: string[] }
  | { estado: 'pregunta'; pregunta: string; opciones: { valor: string; etiqueta: string }[] }
  | { estado: 'duplicado'; trabajoId: string; titulo: string; referencia?: string }
  | { estado: 'ignorada'; motivo: string }
  | { estado: 'respuesta'; respuesta: RespuestaPregunta }
  | { estado: 'error'; mensaje: string });
// estado-trabajos.ts
responderSeguimiento(ctx, trabajoId: string, personaId: string, r: { estado?: EstadoTrabajo; nota?: string }): Promise<void>;
cambiarEstado(ctx, trabajoId: string, personaId: string, estado: EstadoTrabajo): Promise<void>;
// consultas-trabajos.ts · proyectos.ts · personas.ts
obtenerTrabajo(ctx, id: string): Promise<TrabajoVista | null>;
listarTrabajos(ctx, f?: { proyectoId?: string; responsableId?: string }): Promise<TrabajoVista[]>;
listarProyectos(ctx): Promise<ResumenProyecto[]>;  obtenerProyecto(ctx, id: string): Promise<ProyectoDetalle | null>;
listarPersonas(ctx): Promise<PersonaBreve[]>;
// mi-dia.ts
obtenerMiDia(ctx, personaId: string): Promise<MiDia>;  marcarAvisosLeidos(ctx, personaId: string): Promise<void>;
// decisiones.ts
listarDecisiones(ctx, f?: { decisorId?: string; estado?: string }): Promise<DecisionVista[]>;
obtenerDecision(ctx, id: string): Promise<DecisionVista | null>;
aprobarDecision(ctx, id: string, letra: 'A'|'B'|'C', personaId: string): Promise<{ trabajosCreados: string[]; avisosA: string[] }>; // error si no es el decisor o no está pendiente
rechazarDecision(ctx, id: string, personaId: string, motivo: string): Promise<{ avisosA: string[] }>;
// preguntar.ts · registro.ts · cifras.ts · demo.ts
preguntar(ctx, personaId: string, texto: string): Promise<RespuestaPregunta>;
listarAcciones(ctx, f?: { limite?: number }): Promise<AccionVista[]>;   // más recientes primero
obtenerCifras(ctx): Promise<Cifras>;
reiniciarDemo(ctx): Promise<void>;
```
Vistas (`servicios/vistas.ts`; fechas como `Date`, la interfaz las formatea en el servidor y pasa texto a los componentes de cliente):
```ts
PersonaBreve { id; nombre; rol; area }
TrabajoRef { id; titulo; referencia }   // dominio/nombres.ts: el id solo va en la ruta; se muestran título y referencia
DecisionRef { id; titulo; referencia }
TrabajoVista { id; titulo; referencia; proyecto: { id; nombre }; responsable: PersonaBreve; solicitadoPor: PersonaBreve | null;
  estado; plazo; urgente; conCostoProbable; marcas: Marcas; bloqueadoPor: TrabajoRef | null; fechaSolucion: Date | null;
  bloquea: string[] /* cadena desde este trabajo si está bloqueado */; dependeDe: string[];
  bloqueaTrabajos: TrabajoRef[]; dependeDeTrabajos: TrabajoRef[]; causasTrabajos: Record<id, TrabajoRef>; causasRepuestos: Record<id, string>;
  necesita: { repuesto: string; cantidad: number }[]; seguimiento: { nivel: number; desde: Date } | null; notas: { en; autor; texto }[] }
AvisoVista { id; en; titulo; cuerpo; trabajoIds: string[]; trabajos: TrabajoRef[]; tipoAccion; leido: boolean }
MiDia { persona: PersonaBreve; ahora: Date; debo: TrabajoVista[]; esperoDeOtros: TrabajoVista[];
  avisos: AvisoVista[]; decisionesPendientes: DecisionVista[] }
ResumenProyecto { id; clave; nombre; responsable: PersonaBreve; fecha: Date | null; total; abiertos; enCurso; bloqueados; resueltos; atrasados; enRiesgo }
ProyectoDetalle = ResumenProyecto & { trabajos: TrabajoVista[] }
OpcionVista = OpcionCalculada & { costoTexto: string }
DecisionVista { id; titulo; referencia; estado; creadaEn; proyecto; proponente: PersonaBreve; decisor: PersonaBreve; contexto: string;
  afectados: { trabajoId; titulo; referencia; responsable: string }[]; opciones: OpcionVista[]; trabajos: Record<id, TrabajoRef>; opcionPropuesta: string | null;
  opcionElegida: string | null; decididaEn: Date | null; motivoRechazo: string | null }
AccionVista { id; en; tipo; motivo; hechoOrigen; trabajoIds: string[]; trabajos: TrabajoRef[]; destinatario: PersonaBreve | null; decisionId: string | null; decision: DecisionRef | null }
RespuestaPregunta { texto; tema: TemaPregunta; fuentes: { trabajoId; etiqueta }[]; datos: Record<string, unknown>; ia: MetaIA }
Cifras { resueltosSinGerente; resueltosTotal; porcentaje /* entero */; seguimientos; preguntasRespondidas; minutosAhorrados; horasAhorradas /* 1 decimal */ }
```
Orden de `debo`: urgente, luego atrasado, luego plazo ascendente. `esperoDeOtros`: trabajos no resueltos que la persona solicitó (de otro responsable), de los que dependen o por los que están bloqueados sus trabajos; sin repetir, por plazo. `avisos`: los de la persona, más recientes primero, máximo 20.

---

## 5. Contrato de la interfaz

**Nombres en pantalla:** ninguna pantalla muestra un id interno. La etiqueta de código (`CodigoTrabajo`) muestra la referencia (COLINA-4); los enlaces a trabajos muestran el título, con la referencia pequeña al lado (`componentes/enlaces-trabajos.tsx`); las decisiones se titulan «Compra de 3 compresores de 2 HP» con su referencia COLINA-D1; los proyectos muestran su clave junto al nombre.

Marco común (`layout.tsx`, `export const dynamic = 'force-dynamic'`): barra superior con **selector «ver como»** (cookie `nexo_persona`, por defecto `marcela-solis`), **reloj** (`mié 25 nov, 7:05`) con botones `+5 min`, `+30 min`, `Siguiente evento`, botón **Reiniciar demo** (pide confirmación) y navegación. **Caja de captura siempre visible**: fija abajo en teléfono (< 640 px), arriba en escritorio; tras enviar muestra la tarjeta de resultado con la insignia «Respondió: Local» / «Respondió: Claude · claude-haiku-5-5» / «Local (respaldo)». Si el resultado es una pregunta, muestra los botones de `opciones` o un campo para la respuesta.

| Ruta | Muestra | Lee | Server actions |
|---|---|---|---|
| `/` | Redirige a `/mi-dia` | — | — |
| `/mi-dia` | Lo que debo (con quién lo pidió, qué bloquea, marcas, seguimiento pendiente), lo que espero de otros, qué cambió (avisos, con enlaces a trabajos) y decisiones pendientes si es decisor | `obtenerMiDia` | `accionResponderSeguimiento`, `accionMarcarLeidos` |
| `/proyectos` | **Las tres cifras** arriba y una tarjeta por proyecto con abiertos/en curso/bloqueados/resueltos, atrasados y en riesgo | `listarProyectos`, `obtenerCifras` | — |
| `/proyectos/[id]` | Trabajos del proyecto con estado, marcas, responsable, plazo y dependencias | `obtenerProyecto` | — |
| `/trabajos/[id]` | Detalle: estado, marcas con causas, bloqueante y fecha de solución, notas, dependencias | `obtenerTrabajo` | `accionResponderSeguimiento` |
| `/decisiones` | Pendientes del decisor actual arriba, luego el historial. Cada una: qué pasó, afectados, opciones A/B/C (costo, llegada, cambios de fecha, consecuencia), quién la propuso. Botones Aprobar por opción y Rechazar con motivo. Nexo no recomienda opción | `listarDecisiones` | `accionAprobar`, `accionRechazar` |
| `/preguntar` | Campo de pregunta, respuesta con enlaces a `/trabajos/[id]` por fuente e insignia de implementación; «No lo sé» si el tema es `desconocido` | — | `accionPreguntar` |
| `/registro` | Las tres cifras y la lista de acciones de Nexo: hora, tipo, destinatario, motivo, hecho de origen, trabajos | `listarAcciones`, `obtenerCifras` | — |

Server actions (`src/app/acciones/`): `cambiarPersona(id)`, `avanzar(minutos)`, `siguienteEvento()`, `reiniciar()`, `accionCapturar(prev, formData)`, `accionResponderCaptura(prev, formData)`, `accionResponderSeguimiento(formData)`, `accionMarcarLeidos()`, `accionAprobar(decisionId, letra)`, `accionRechazar(decisionId, motivo)`, `accionPreguntar(prev, formData)`. Todas obtienen el contexto con `obtenerContextoApp()`, la persona con `personaActual()`, devuelven datos serializables y llaman `revalidatePath('/', 'layout')`. Las páginas reciben `params` como `Promise` (Next 15+).

**Las tres cifras** (`cifras-demo.tsx`, en `/proyectos` y `/registro`):
1. «Trabajos cerrados sin intervención de la gerente: **6 de 8 (75 %)** · meta 50 %». Intervención = existe al menos un evento de cualquier tipo con `actor_id` = la persona con `ROL_GERENTE` y `trabajo_id` = ese trabajo, en cualquier fecha; `porcentaje` = redondeo entero de sin intervención / resueltos × 100.
2. «Seguimientos hechos por Nexo: **19**» = acciones `pedir_estado` + `recordatorio` + `escalamiento` + `aviso`.
3. «Horas de coordinación ahorradas esta semana: **3,4 h** · estimado» = (seguimientos × 10 + preguntas respondidas × 15) min. Nota visible: «Hipótesis de minutos, no medición. Línea base: 10 supervisores × 1 h diaria = 50 h/semana». (Valores del final del guion, §6.3.)

---

## 6. Mapa de pruebas

Ayudante `prepararDemo({ hora?: 'HH:mm' })` (`tests/ayudantes/preparar.ts`): PGlite en memoria, DDL, semilla, intérprete Local y reloj fijado **sin tick** a esa hora del mié 25 (por defecto 07:05). `instantaneaDesdeSemilla()` construye la instantánea sin base para pruebas puras. Hora en las tablas: mié 25-nov salvo que diga otra fecha.

### 6.1 Frases de control (captura a las 7:05, estado inicial, cada una aislada)

| Frase | Archivo | Resultado esperado exacto |
|---|---|---|
| C01 | `tests/captura/trabajo-nuevo.test.ts` | `aplicada`; T31 en P1, responsable `lucia-mora`, `solicitadoPor` `jose-alfaro`, plazo 12:00, urgente; T04 `bloqueado`, `bloqueadoPorId` T31; compresor con faltante reportado por José; seguimiento de T31 nivel 0, `proximo_en` 7:35; `avisosA` contiene `lucia-mora` |
| C05 | ídem | T31 en P4, `andres-vargas`, plazo 17:00, no urgente, `relacionados` [T26, T27]; `avisosA` = [`andres-vargas`] |
| C08 | ídem | T31 en P2, `lucia-mora`, plazo jue 26 07:00, `relacionados` [T11] |
| C10 | ídem | Primero `pregunta` con primera opción `lucia-mora` y 0 trabajos nuevos; `responderCaptura(id, 'lucia-mora')` → T31 en OD, `lucia-mora`, plazo 17:00 |
| C12 | ídem | T31 en P2, `paola-herrera`, plazo vie 27 17:00 |
| C15 | ídem | T31 en P4, `lucia-mora`, urgente, plazo 12:00, `conCostoProbable`; T24 `bloqueado` por T31 |
| C02 | `tests/captura/actualizacion.test.ts` | T12 `en_curso` con nota; siguen 30 trabajos |
| C03 | ídem | Nota en T21; `avisosA` = [`sofia-navarro`]; 30 trabajos |
| C09 | ídem | Nota en T27; `avisosA` = [`andres-vargas`], aviso con T26 y T27; 30 trabajos |
| C14 | ídem | Tras C01: T31 `resuelto`, T04 `en_curso` sin bloqueante ni fecha de solución, necesidad de T04 atendida; `avisosA` = [`mario-chaves`] con [T05] |
| C04 | `tests/captura/otros.test.ts` | `duplicado`, `trabajoId` T28; 30 trabajos |
| C06 | ídem | `pregunta` que contiene «metros»; 0 trabajos y 0 decisiones |
| C07 | ídem | `ignorada`; 30 trabajos; 0 acciones |
| C11 | `tests/captura/decisiones.test.ts` | `aplicada`, `decisionId` D01, decisor `marcela-solis`, existencia del compresor 0, opciones A ₡1.380.000, B ₡1.140.000, C ₡1.220.000 |
| C06 (respuesta) | ídem | `responderCaptura(id, '20')` → D01 en P3, decisor `andres-vargas`; A local 20 × ₡4.200 = ₡84.000, llega hoy 15:00; B habitual 20 × ₡3.920 = ₡78.400, llega sáb 28 07:00; sin C; sin cambios de fecha |
| C13 | `tests/preguntar/c13.test.ts` | `respuesta`, tema `pedidos_semana`; `datos`: entregados 2 (1041, 1042), enRutaHoy 1 (1044), atrasados 1 (1043), pendientes 3 (1045, 1046, 1047); fuentes = T19, T20, T21, T23, T24, T25, T26; el texto menciona a Sofía Navarro para 1043 y el pago para 1047; 0 trabajos nuevos |

Además `tests/ia/interprete-local.test.ts` (2.1) comprueba el tipo de las 15 interpretaciones y que variantes sin tildes, con otra puntuación o «2HP» coincidan.

### 6.2 Escenarios

| Escenario | Archivo | Pasos y resultado esperado |
|---|---|---|
| E1 | `tests/escenarios/e1.test.ts` | `prepararDemo({hora:'11:59'})`, `avanzarReloj(1)` → acción `pedir_estado` a `paola-herrera` con [T28]. `avanzarReloj(10)`, Paola captura «Ya la envié» → T28 `resuelto`, su seguimiento `respondido`; ninguna acción `recordatorio`/`escalamiento` sobre T28 y ningún evento con actor `andres-vargas` o `marcela-solis` |
| E2 | `tests/escenarios/e2.test.ts` | C01 a 7:05 → aviso a Lucía. `irAlSiguienteEvento` → 7:35, `recordatorio` a `lucia-mora` [T31]. `irAlSiguienteEvento` → 8:05, `escalamiento` a `andres-vargas` cuyo cuerpo contiene «José Alfaro», «T04», «T05», «T06», «T07» y «7:05». Sin respuesta: 8:35 `escalamiento` a `marcela-solis`; `avanzarReloj(60)` → ninguna acción nueva sobre T31, seguimiento `agotado` |
| E3 | `tests/escenarios/e3.test.ts` | C01 a 7:05 → T04 `bloqueado`; en riesgo exactamente {T05, T06, T07, T10, T11, T13, T16, T17, T18}; 5 avisos de propagación: `mario-chaves` [T05, T11], `esteban-castro` [T06], `ricardo-brenes` [T07], `daniela-quesada` [T10], `sofia-navarro` [T13]; todos citan «T15» |
| E4 | `tests/escenarios/e4.test.ts` | Tras E3, a 8:10 C11 → D01 con A/B/C como §6.1. **A:** 8:12 Marcela aprueba → T32 «Comprar 3 compresores de 2 HP al proveedor local», `karla-jimenez`, plazo 15:00; en riesgo = {T16, T17, T18}; T04 `bloqueado` con `fecha_solucion` 15:00; T31 `en_curso` plazo 15:00; `avisosA` = {jose-alfaro, mario-chaves, esteban-castro, ricardo-brenes, daniela-quesada, sofia-navarro, lucia-mora, karla-jimenez}; evento `decision_aprobada` con actor `marcela-solis`. **Variante B:** T04 plazo mar 1-dic 17:00 y `fecha_solucion` 1-dic 07:00; T05 → mié 2-dic; T06, T07 → jue 3-dic; T10, T11 → mar 1-dic; T13 → jue 3-dic; trabajo para `sofia-navarro` «Avisar del atraso a Supermercado La Colina y Panadería Trigal», plazo hoy 17:00; ninguno de los seis en riesgo. **Rechazo:** aviso a `lucia-mora` con el motivo; marcas sin cambio |
| E5 | `tests/escenarios/e5.test.ts` | `prepararDemo({hora:'09:30'})`, Sofía captura «Don Beto recibe mañana jueves en la mañana» → T22 `resuelto`; T21 plazo jue 26 12:00 y no atrasado; nota en T29; `avisosA` = [`diego-rojas`]; ningún evento con actor `andres-vargas` o `marcela-solis` |

Pruebas puras: `tests/dominio/{tiempo,formato,texto}.test.ts`, `tests/motor/marcas.test.ts` (estado inicial: atrasados {T15, T21}; en riesgo {T16, T17, T18}), `tests/motor/seguimiento.test.ts`, `tests/motor/opciones.test.ts`, `tests/motor/cifras.test.ts`. Base: `tests/db/conexion.test.ts`, `tests/db/semilla.test.ts` (12 personas, 5 proyectos, 30 trabajos: 8 resueltos, 2 en curso, 20 abiertos), `tests/servicios/{reloj,consultas,mi-dia}.test.ts`.

### 6.3 Integración del guion (`tests/integracion/guion.test.ts`)

Un solo `prepararDemo({hora:'07:00'})` y los pasos de 03 §4 en orden, solo con servicios:

| Paso | Llamada | Resultado esperado exacto |
|---|---|---|
| 0 | estado inicial | 7:00; atrasados {T15, T21}; en riesgo {T16, T17, T18} |
| 1 | `avanzarReloj(5)` | 7:05; 2 acciones `pedir_estado`: `lucia-mora` [T15], `diego-rojas` [T21] |
| 2 | `capturar(jose-alfaro, C01)` | Como C01 y E3; `ia.implementacion` = `local`; seguimientos acumulados = 8 |
| 3 | `avanzarReloj(1)`; `obtenerMiDia(lucia-mora)` | 7:06; `debo[0]` = T31 con `solicitadoPor` José y `bloquea` ⊇ [T04]; `debo` incluye T15 con `atrasado` |
| 4 | `irAlSiguienteEvento` ×2 | 7:35 `recordatorio` a Lucía; 8:05 `escalamiento` a Andrés (contenido de E2); seguimientos = 10 |
| 5 | `avanzarReloj(1)`; `obtenerMiDia(mario-chaves)` | 8:06; exactamente un aviso de propagación con [T05, T11] que cita T15; `debo` incluye T05 y T11 en riesgo |
| 6 | `avanzarReloj(4)`; `capturar(lucia-mora, C11)` | 8:10; D01 para `marcela-solis`; existencia 0; seguimiento de T31 `respondido`; seguimientos = 11 |
| 7 | `avanzarReloj(2)`; `listarDecisiones({decisorId: marcela})` → [D01]; `aprobarDecision(D01,'A',marcela)` | 8:12; como E4-A (T32 para Karla); seguimientos = 19 |
| 8 | `avanzarReloj(1)`; `preguntar(marcela, C13)` | 8:13; como C13 |
| 9 | `avanzarReloj(1)`; `obtenerCifras`; `listarAcciones` | 8:14; `{resueltosSinGerente: 6, resueltosTotal: 8, porcentaje: 75, seguimientos: 19, preguntasRespondidas: 1, minutosAhorrados: 205, horasAhorradas: 3.4}`; ninguna acción de tipo `escalamiento` a `marcela-solis` |

---

## 7. Planes por etapa

**Reglas:** cada archivo tiene un solo dueño a la vez; la propiedad solo pasa a otra tarea a través de una dependencia explícita (p. ej. 1.1 crea el esqueleto que luego rellena 1.5). Nadie toca `package.json` después de 1.1. Cada tarea trabaja en su propio worktree y termina con `pnpm verificar` en verde, además de su criterio. Dificultad → modelo: alta Opus, media Sonnet, baja Haiku. «∥» = puede correr en paralelo con las demás tareas de su grupo.

### Etapa 1 — Esqueleto y modelo
| Id | Título | Dif. → modelo | Archivos que posee | Depende de | ∥ | Terminado cuando |
|---|---|---|---|---|---|---|
| 1.1 | Esqueleto, dependencias y contratos | alta → Opus | configuración (§1), contratos (§4.0) y esqueletos de **todos** los archivos de §2 | — | — | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan |
| 1.2 | DDL y conexión | media → Sonnet | `db/ddl.ts`, `db/conexion.ts`, `tests/db/conexion.test.ts` | 1.1 | ∥ 1.3, 1.7 | `pnpm vitest run tests/db/conexion` |
| 1.3 | Tiempo, formato y texto | media → Sonnet | `dominio/{tiempo,formato,texto}.ts`, `tests/dominio/*` | 1.1 | ∥ 1.2, 1.7 | `pnpm vitest run tests/dominio` |
| 1.4 | Semilla de Frío del Valle | baja → Haiku | `db/semilla/*`, `tests/db/semilla.test.ts` | 1.2, 1.3 | — | `pnpm vitest run tests/db/semilla` |
| 1.5 | Instantánea, efectos, reloj y demo | media → Sonnet | `db/instantanea.ts`, `motor/efectos.ts` (función), `servicios/{reloj,demo,personas}.ts`, `servidor/contexto-app.ts`, `scripts/reiniciar-db.ts`, `tests/ayudantes/preparar.ts`, `tests/servicios/reloj.test.ts` | 1.4 | — | `pnpm vitest run tests/servicios/reloj` |
| 1.6 | Consultas de proyectos y trabajos | media → Sonnet | `servicios/{consultas-trabajos,proyectos}.ts`, `tests/servicios/consultas.test.ts` | 1.5 | ∥ 1.7 | `pnpm vitest run tests/servicios/consultas` |
| 1.7 | Interfaz base | media → Sonnet | `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/proyectos/**`, `app/trabajos/**`, `app/acciones/{persona,reloj,demo}.ts`, `componentes/{barra-superior,selector-persona,control-reloj,tarjeta-trabajo,insignia-marcas}.tsx` | 1.1 (código); 1.6 (criterio) | ∥ 1.2–1.6 | `pnpm build`; con `pnpm dev`, `curl -s http://localhost:3000/proyectos` contiene «Cámara fría La Colina» y `.data/pglite` existe |

### Etapa 2 — Captura
| Id | Título | Dif. → modelo | Archivos que posee | Depende de | ∥ | Terminado cuando |
|---|---|---|---|---|---|---|
| 2.1 | Intérprete Local | media → Sonnet | `ia/local/{interprete-local,respuestas-guardadas,heuristicas}.ts`, `tests/ia/interprete-local.test.ts` | 1.3 | ∥ 2.2, 2.4, 2.5, 3.1 | `pnpm vitest run tests/ia/interprete-local` |
| 2.2 | Intérprete Claude y selección | media → Sonnet | `ia/claude/*`, `ia/elegir.ts`, `tests/ia/elegir.test.ts` (sin red: SDK simulado) | 1.1 | ∥ 2.1 | `pnpm vitest run tests/ia/elegir` |
| 2.3 | Servicio de captura | alta → Opus | `ia/contexto.ts`, `servicios/{captura,validacion,aplicar}.ts`, `motor/actualizacion.ts`, `tests/captura/{trabajo-nuevo,actualizacion,otros}.test.ts` | 1.5, 2.1 | — | `pnpm vitest run tests/captura` (13 frases de la etapa 2) |
| 2.4 | Marcas calculadas | media → Sonnet | `motor/marcas.ts`, `tests/motor/marcas.test.ts` | 1.5 | ∥ 2.1–2.3 | `pnpm vitest run tests/motor/marcas` |
| 2.5 | Interfaz de captura | media → Sonnet | `componentes/{caja-captura,tarjeta-resultado-captura,insignia-implementacion}.tsx`, `app/acciones/captura.ts` | 1.7 | ∥ 2.1–2.4 | `pnpm build`; en `pnpm dev` a 375 px, la frase C01 muestra la tarjeta con T31 y «Respondió: Local» |

### Etapa 3 — Coordinación
| Id | Título | Dif. → modelo | Archivos que posee | Depende de | ∥ | Terminado cuando |
|---|---|---|---|---|---|---|
| 3.1 | Seguimiento y escalamiento | alta → Opus | `motor/seguimiento.ts`, `tests/motor/seguimiento.test.ts` | 1.5 | ∥ etapa 2 | `pnpm vitest run tests/motor/seguimiento` |
| 3.2 | Propagación y avisos agrupados | alta → Opus | `motor/propagacion.ts`, `tests/escenarios/e3.test.ts` | 2.3, 2.4 | ∥ 3.3 | `pnpm vitest run tests/escenarios/e3` |
| 3.3 | Opciones, plazos y decisiones | alta → Opus | `motor/{plazos,opciones,decision}.ts`, `servicios/decisiones.ts`, `tests/motor/opciones.test.ts`, `tests/captura/decisiones.test.ts`, `tests/escenarios/e4.test.ts` | 2.3, 2.4 (E4 también 3.2) | ∥ 3.2 | `pnpm vitest run tests/motor/opciones tests/captura/decisiones tests/escenarios/e4` |
| 3.4 | Respuestas y escenarios E1, E2, E5 | media → Sonnet | `servicios/estado-trabajos.ts`, `tests/escenarios/{e1,e2,e5}.test.ts` | 2.3, 3.1 | ∥ 3.2, 3.3 | `pnpm vitest run tests/escenarios` (5 de 5) |

### Etapa 4 — Vistas por persona
| Id | Título | Dif. → modelo | Archivos que posee | Depende de | ∥ | Terminado cuando |
|---|---|---|---|---|---|---|
| 4.1 | Mi día | media → Sonnet | `servicios/mi-dia.ts`, `app/mi-dia/page.tsx`, `app/acciones/trabajos.ts`, `componentes/{lista-avisos,boton-responder}.tsx`, `tests/servicios/mi-dia.test.ts` | 3.2, 3.4 | ∥ 4.2–4.4 | `pnpm vitest run tests/servicios/mi-dia` y `pnpm build` |
| 4.2 | Bandeja de decisiones | media → Sonnet | `app/decisiones/page.tsx`, `app/acciones/decisiones.ts`, `componentes/tarjeta-decision.tsx` | 3.3 | ∥ | `pnpm build`; en `pnpm dev` se aprueba D01 tras C01 y C11 |
| 4.3 | Preguntar | media → Sonnet | `servicios/preguntar.ts`, `ia/local/preguntas-local.ts`, `app/preguntar/page.tsx`, `app/acciones/preguntar.ts`, `tests/preguntar/c13.test.ts` | 1.6, 2.2, 2.3 | ∥ | `pnpm vitest run tests/preguntar` |
| 4.4 | Registro y cifras | baja → Haiku | `motor/cifras.ts`, `servicios/{cifras,registro}.ts`, `app/registro/page.tsx`, `componentes/cifras-demo.tsx`, `tests/motor/cifras.test.ts` | 1.5 | ∥ | `pnpm vitest run tests/motor/cifras` y `pnpm build` |
| 4.5 | Integración del guion | alta → Opus | `tests/integracion/guion.test.ts` | 3.3, 3.4, 4.1, 4.3, 4.4 | ∥ 4.6 | `pnpm vitest run tests/integracion` y `pnpm verificar` |
| 4.6 | Diseño visual (skill `impeccable`) | alta → Opus | pasa a poseer `app/globals.css`, `app/**/page.tsx`, `app/layout.tsx` y `componentes/**`; solo marcado y clases, sin cambiar datos ni llamadas | 2.5, 4.1–4.4 | ∥ 4.5 | `pnpm build`; guion completo a mano en 375 px y 1280 px sin errores en consola |

Camino crítico: 1.1 → 1.2 → 1.4 → 1.5 → 2.1 → 2.3 → 3.2/3.3 → 4.1 → 4.5.

---

## 8. Contradicciones resueltas

1. **Fechas de la opción B y C (03 §4, 04 E4).** 03 dice que con B «La Colina y los dos locales de Trigal se atrasan al 2-dic», mientras que la variante de E4 mueve T04 al 1-dic; con la cadena de 04 (T04→T05→T06) ninguna regla única da ambas cosas. Regla fijada (§4.2.8): llegada habitual 1-dic 07:00; T04, T10, T11 → 1-dic; dependientes desplazados en días hábiles: T05 → 2-dic, T06 y T07 → 3-dic, T13 → 3-dic. Consecuencias que se muestran: **B** «La Colina se entrega el jue 3-dic (instalación el 1-dic); Cartago y Curridabat pasan al 1-dic». **C** «La Colina se entrega a tiempo; Cartago y Curridabat pasan al 1-dic». Costos sin cambio.
2. **E4 retira «en riesgo» aunque T04 sigue Bloqueado**, contra la definición de 03 §2. Un bloqueo con fecha de solución ≤ plazo no propaga, y una necesidad con fecha disponible ≤ plazo no cuenta.
3. **E3 pone T13 en riesgo por T10 y T11**, que no están ni bloqueados ni atrasados. El riesgo también se propaga desde trabajos en riesgo (cadena).
4. **«Los seis afectados» de E4** son seis personas (José por T04, Mario por T05 y T11, Esteban, Ricardo, Daniela y Sofía), no seis avisos por trabajo. Con Lucía y Karla son 8 avisos.
5. **R1 frente a E2:** E2 recuerda a las 7:35 un trabajo con plazo 12:00. En un trabajo urgente creado por captura, el aviso de asignación es la primera solicitud y el ciclo arranca al crearse.
6. **Guion 7:06 → «7:35 → 8:05»:** con un botón de +30 min saldrían 7:36 y 8:06. Hay botón «Siguiente evento», y cada nivel se programa desde el anterior programado.
7. **C14 avisa solo a Mario**, pero al desbloquear T04 también pierden riesgo T06 y T07. Liberar un trabajo avisa solo a los dependientes directos; quitar riesgo solo avisa dentro de una decisión (R8).
8. **El guion empieza a las 7:05 y el reloj a las 7:00:** el presentador pulsa «+5 min», y ese tick pide el estado de T15 y T21 (atrasados). Es coherente con R1 y suma 2 seguimientos.
9. **Plazos sin hora** («lun 23») = 17:00 de ese día. «Hoy» urgente = 12:00 (C01, C15). Un plazo vence en el minuto exacto (`ahora ≥ plazo`, E1 a las 12:00).

---

## 9. Riesgos técnicos y cómo evitarlos

| Riesgo | Prevención |
|---|---|
| La recarga en caliente de Next crea varias PGlite sobre el mismo directorio (bloqueo o corrupción) | Singleton en `globalThis.__nexo` con la *promesa* de inicialización; nunca crear PGlite al importar un módulo |
| El empaquetador rompe el wasm de PGlite | `serverExternalPackages: ['@electric-sql/pglite']`; solo runtime Node (nada de `runtime = 'edge'`); si Turbopack falla en dev, `next dev --webpack` |
| Dos procesos abren `.data/pglite` (dev + `db:reset`) | `db:reset` es para usar con dev parado y avisa si no puede abrir; en la demo se usa el botón «Reiniciar demo». Las pruebas usan memoria |
| OneDrive sincroniza `.data` y `.next` y provoca EPERM/EBUSY | `NEXO_DATA_DIR` fuera de OneDrive (p. ej. `%LOCALAPPDATA%\Nexo\pglite`) si aparece el error; marcar la carpeta «Mantener siempre en este dispositivo» o clonar fuera de OneDrive para la demo |
| Rutas de Windows | `path.join(process.cwd(), …)` y rutas absolutas; nunca concatenar con `/` |
| Zona horaria del equipo distinta a Costa Rica | Toda la lógica en `tiempo.ts` con desfase −06:00; pruebas con `TZ=UTC`; ESLint prohíbe `Date.now()` y `new Date()` sin argumentos en la lógica |
| `next build` intenta prerenderizar y abre la base | `dynamic = 'force-dynamic'` en el layout; sin `generateStaticParams` |
| Instalación de pnpm bloquea scripts (esbuild, sharp) | Lista de permitidos en `pnpm-workspace.yaml`; 1.1 comprueba que `pnpm install` no deja avisos de scripts ignorados |
| Doble clic en Aprobar o en el reloj | Transacción por servicio; `aprobarDecision` exige estado `pendiente`; PGlite serializa las consultas |
| Desajuste entre `esquema.ts` y `ddl.ts` | Prueba de 1.2 que inserta y lee cada tabla con Drizzle |
| Arranque lento de PGlite en pruebas | Una instancia por archivo, `pool: 'forks'`, `testTimeout` de 30 s |
| Claude sin red o con clave inválida en vivo | Respaldo Local automático con la insignia «Local (respaldo)»; la demo funciona sin clave |
