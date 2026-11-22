# Nexo — Reformas de la versión 2: una sola empresa, un solo modelo

*Fecha: 21-11-2026 · Rama: `reformas-v2` · Estado: contrato para los agentes de código · Amplía `05` (que sigue mandando en lo que aquí no cambia) y sustituye el modelo de `06` §6–§10*

Este documento es el contrato de cinco reformas. Si algo no está aquí ni en `05`, el agente pregunta; no inventa. Ningún agente toca `src/app/proyectos/**` ni `src/motor/secuencia.ts` (rediseño en curso) y todos parten de la reforma de escalamiento ya fusionada (responsable del proyecto, responsable de la operación, aprobación por monto): este documento no la cambia.

---

## 1. Las cinco reformas en breve

| # | Reforma | En dos frases |
|---|---|---|
| 5 | **Una sola empresa** | Desaparece Grupo Altavista: los buzones de ejemplo pasan a ser de **Frío del Valle**, con hilos entre sus áreas, sus clientes y proveedores, y el mismo ruido. Las personas del correo son las 12 de la semilla, con su dirección `@friodelvalle.cr`. |
| 1 | **Un solo modelo** | Cada pedido leído del correo es un **trabajo** (mismo esquema, estados, marcas, seguimiento, decisiones y registro) con `origen = 'correo'` y su evidencia; una espera es una dependencia; una entrega es evidencia de resolución. Nexo lee los buzones **al avanzar el reloj**, sin red y sin leer dos veces un mensaje. |
| 2 | **Propuesto y confirmado** | Lo que Nexo infiere nace **propuesto**: solo lo ve su dueño y no molesta a nadie más hasta confirmarse (lo afirma una persona, o lo ven los buzones de las dos partes). No es un estado: es el campo `confirmacion`. |
| 3 | **Cuánto se equivoca** | Cada revisión humana de una propuesta (confirmar, corregir, descartar) se guarda con lo propuesto y lo final; de ahí sale la **tasa de corrección** y, más adelante, casos de prueba. |
| 4 | **Resuelto con evidencia** | Si otra persona lo pidió, el responsable lo declara **entregado** (nota o enlace) y quien lo pidió confirma que lo recibió; entonces queda Resuelto. «Entregado, por confirmar» son campos, no un estado ni una marca. |

Se relacionan en cadena: la empresa única (5) da los datos; el modelo único (1) los convierte en trabajos; como esos trabajos son inferidos, nacen propuestos (2); cada revisión alimenta la tasa (3); y la entrega detectada en un hilo es la evidencia que pide (4).

---

## 2. Esquema de datos

Archivos de contrato afectados (necesitan aprobación humana, §9): `dominio/tipos.ts`, `dominio/constantes.ts`, `db/esquema.ts`, `db/ddl.ts`, `motor/instantanea.ts`, el tipo de `motor/efectos.ts`, `servicios/vistas.ts`.

### 2.1 Columnas nuevas o modificadas

| Tabla | Cambio |
|---|---|
| `trabajos` | `origen` admite `'correo'`. **Nuevas:** `confirmacion` text not null default `'confirmado'` (`propuesto`/`confirmado`/`descartado`); `dueno_propuesta_id` text null FK personas; `confirmado_por_id` text null FK personas (persona que lo afirmó; null = confirmado por origen o por dos fuentes); `entrega` jsonb null `{ en: ISO, porId, nota: string\|null, enlace: string\|null, fuente: 'correo'\|'captura'\|'interfaz' }` |
| `seguimientos` | **Nueva:** `tipo` text not null default `'estado'` (`estado`/`recepcion`/`propuesta`) |

### 2.2 Tablas nuevas

| Tabla | Columnas (tipo; clave) |
|---|---|
| `buzones` | `persona_id` text PK FK personas, `direccion` text, `proveedor` text (`gmail`/`outlook`), `conectado_en` timestamptz |
| `evidencias` | `id` serial PK, `trabajo_id` FK trabajos, `tipo` (`pedido`/`aceptacion`/`espera`/`entrega`/`recepcion`/`insistencia`), `fuente` (`correo`/`captura`/`interfaz`), `compromiso_clave` text null (`c-h3-m1`: une los hechos de un mismo pedido entre lecturas), `mensaje_id` text null (`Message-ID`), `buzones` jsonb `string[]` default `[]` (personas en cuyo buzón está el mensaje), `enlaces` jsonb `Record<personaId, url>` default `{}`, `autor_id` text null, `en` timestamptz (envío del mensaje o hora de la acción), `cita` text (≤ 220) |
| `mensajes_leidos` | `persona_id` text, `id_internet` text; PK compuesta; `enviado` timestamptz, `leido_en` timestamptz, `clase` (`laboral`/`personal`/`boletin`), `resultado` (`propuso`/`creo`/`reconocio`/`entrega`/`espera`/`aceptacion`/`recepcion`/`insistencia`/`sin_compromisos`/`sin_plazo`/`sin_parte`/`descartado`), `trabajo_ids` jsonb `string[]` default `[]`. De lo personal y los boletines **no** se guarda asunto, remitente ni cuerpo |
| `revisiones` | `id` serial PK, `en`, `persona_id` FK, `origen` (`correo`/`captura`), `trabajo_id` text null FK, `captura_id` int null, `resultado` (`confirmada`/`corregida`/`descartada`), `campos` jsonb `CampoCorregible[]`, `propuesto` jsonb `{ titulo, responsableId, plazo: ISO\|null, proyectoId }`, `final` jsonb igual o null (descartada), `entrada` jsonb `{ asunto?, cita, deId?, paraIds?, enviado? } \| { texto }` (lo necesario para rehacer el caso), `motivo` text null |

### 2.3 Lo que se elimina

`correcciones_correo` (y con ella `src/correo/modelo.ts`, `src/correo/enlaces.ts`, `Compromiso`, `CompromisoConMarcas`, `ModeloCorreo`, `CorreccionCorreo`): los compromisos ya no se recalculan desde los correos; son trabajos. Los códigos `C1…C7` y las referencias `TRANSLOG-n` desaparecen. Los datos de correcciones de Grupo Altavista se pierden (son de otra empresa).

### 2.4 Puesta al día de bases existentes

Al final de `DDL_CREAR`, idempotente: `ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS confirmacion text NOT NULL DEFAULT 'confirmado'`, ídem `dueno_propuesta_id`, `confirmado_por_id`, `entrega`; `ALTER TABLE seguimientos ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'estado'`; `CREATE TABLE IF NOT EXISTS` de las cuatro nuevas; `DROP TABLE IF EXISTS correcciones_correo`. No inserta buzones: una base anterior queda sin buzones conectados y Correo lo dice («Ningún buzón conectado: reinicia la demo»). `DDL_BORRAR` incluye las tablas nuevas y `correcciones_correo`. Total de tablas: 20. *(R2: el `DROP TABLE IF EXISTS correcciones_correo` y la salida de la tabla de `esquema.ts` los hace R9, porque la pantalla Correo actual la usa hasta R7a; entre R2 y R9 hay 21 tablas.)*

### 2.5 Semilla

`cargarSemilla(db, { buzones = true })` inserta además los 8 buzones de `BUZONES_DEMO` (§5.1) con `conectado_en` = lun 23 7:00. `prepararDemo({ hora?, correo = false })` llama `cargarSemilla(db, { buzones: correo })`: **las pruebas existentes no leen correo**; las nuevas y el guion pasan `correo: true`. Los 30 trabajos de la semilla llevan `confirmacion = 'confirmado'`, sin dueño, sin `confirmado_por_id` y sin entrega.

---

## 3. Reglas

Numeradas como continuación de §4.2 de `05`. «Parte» de un trabajo = su solicitante o su responsable.

**10. Lectura de correo (cuándo).** Nexo lee en la misma transacción que mueve el reloj (`avanzarReloj`, `irAlSiguienteEvento`, `fijarReloj`), **antes** del `tick`: toma los mensajes de los buzones conectados con `enviado ≤ ahora` y procesa solo los que no están en `mensajes_leidos`. Con 0 buzones o 0 mensajes nuevos no hace nada (ni acción). `irAlSiguienteEvento`: si hay mensajes sin leer con `enviado ≤ ahora`, lee y ejecuta tick sin mover el reloj; si no, el destino es el menor entre `siguienteEvento(inst)` y el envío del próximo mensaje sin leer. La caja de captura, `prepararDemo` y `reiniciarDemo` no leen. Todo es determinista: los buzones son los de ejemplo, el orden es (`enviado`, `id_internet`, orden del hecho en el mensaje).

**11. De mensaje a hecho.** Se conservan privacidad, unión y extracción de `06` §4–§7 (solo encabezados para clasificar, historial citado fuera, borradores/spam/papelera no se leen). La extracción devuelve **hechos** por mensaje: `pedido`, `aceptacion`, `espera` (`dependencia` si la escribe el solicitante al pedir; `bloqueo` si la escribe el responsable), `entrega`, `recepcion` (el solicitante responde «recibido», «ya lo recibí», «gracias, recibido» tras una entrega) e `insistencia`. Plazos: «antes del 27 de noviembre», «mañana antes de las 12:00» y «hoy antes de las 16:00» (este último es nuevo); sin señal → `null`.

**12. Pedido → trabajo.** Para cada `pedido` nuevo, en orden:
- (a) **Sin parte interna conectada**: si el responsable no es de la empresa, o el mensaje no está en el buzón conectado de ninguna de las dos partes (solo en copia de un tercero) → nada; `resultado = 'sin_parte'`.
- (b) **Mismo hecho**: si hay un trabajo no resuelto ni descartado, de cualquier origen, con el mismo responsable, `similitud(título del pedido, título) ≥ UMBRAL_MISMO_HECHO` (0,55) y sin solicitante o con el mismo solicitante → no se crea nada: se agrega una evidencia `pedido` a ese trabajo (el de mayor similitud; empate: id menor), acción `reconocer_correo`, `resultado = 'reconocio'`. No cambia campos del trabajo. Si el trabajo era `propuesto` y ahora sus evidencias `pedido` cubren los buzones de las dos partes → pasa a `confirmado` (regla 14b).
- (c) **Sin plazo** → no se crea trabajo (no se inventa); `resultado = 'sin_plazo'` y la pantalla Correo lo lista con la pregunta «¿Para cuándo?» al dueño del buzón.
- (d) **Nuevo**: trabajo con id `M01`, `M02`… (prefijo propio: no consume `T31`), `numero` = siguiente de su proyecto, `origen = 'correo'`, `titulo`, `responsable`, `solicitado_por` (null si el autor es externo), `plazo`, `urgente = false`, `con_costo_probable = monto ≠ null`, `creado_en = ahora`, y evidencia `pedido`. Si el mensaje está en los buzones conectados de **las dos partes** → `confirmado` (dos fuentes), acción `crear_trabajo`, **sin aviso** (el responsable ya tiene el correo). Si no → `propuesto` con `dueno_propuesta_id` = la parte en cuyo buzón está, acción `proponer_trabajo` (destinatario = dueño, sin aviso) y seguimiento `propuesta` (regla 15). Un monto nunca crea una decisión: el motivo dice «Tiene costo (₡…): si implica una compra, pásalo por una decisión».
- **Proyecto** de un trabajo nuevo: el del trabajo al que espera (regla 13); si no, por el asunto normalizado, en este orden: «pedido» o un número 1041–1047 → P4; «trigal» → P2; «colina» → P1; «repuesto», «inventario» o «reorden» → P3; si no, OD.

**13. Espera → dependencia o bloqueo.** El objeto de la espera se enlaza con el trabajo no resuelto y no descartado de mayor puntaje = `similitud(objeto, título)` + 0,25 si el actor nombrado coincide con el primer nombre o el departamento del responsable; umbral 0,45 (los de `06` §7). Objeto pronominal («me los envíe»): el trabajo del actor nombrado pedido por quien espera. `dependencia` → fila en `dependencias` (efecto `crear_dependencia`, evento `dependencia_creada`). `bloqueo` → como un bloqueo de captura: `estado = bloqueado`, `bloqueado_por_id`, `motivo_bloqueo` = la cláusula, y R4/R5 si el trabajo está confirmado. Sin enlace → nota de Nexo «Espera "…": no sé a qué trabajo corresponde» y nada más.

**14. Confirmación.** Un trabajo queda `confirmado` cuando:
- (a) **lo afirma una persona**: lo escribió en la captura (origen `captura`, inmediato como hoy), lo confirma o corrige su dueño (regla 16), o su dueño o la otra parte escribe en la captura un trabajo nuevo que es el mismo hecho (misma regla 12b aplicada en `validarInterpretacion`: el resultado es `duplicado` y la propuesta queda confirmada por esa persona; *R6b: «parte» = dueño, solicitante o responsable de la propuesta; mismo responsable y similitud ≥ 0,55; la confirmación pasa por la regla 16 y deja una revisión `confirmada`*); o
- (b) **coinciden dos fuentes**: las evidencias `pedido` incluyen los buzones del solicitante y del responsable. La confirmación por fuentes no crea revisión. *(R6a: si al confirmarse por fuentes ya trae una entrega, la entrega se trata como cualquier otra de un confirmado —regla 20—: aviso «{Responsable} entregó «…». ¿Lo recibiste?» a quien lo pidió y seguimiento `recepcion` nivel 0, salvo que quien lo pidió sea el responsable o ya haya un `recepcion` pendiente.)* Un trabajo **descartado** nunca vuelve por una fuente nueva: la decisión humana manda.
- Origen `semilla` y `decision`: confirmados desde que nacen.

**15. Qué hace y qué no hace una propuesta.** Un trabajo `propuesto`: no abre seguimiento de estado (R1–R3), no recibe ni genera avisos (asignación, propagación, liberación, reprogramación), no es fuente de riesgo para trabajos confirmados (en `calcularMarcas` sus aristas hacia confirmados se ignoran; él sí recibe marcas de sus predecesores, que ve su dueño), no aparece en decisiones ni en Preguntar, y solo lo ve su dueño (regla 18). Al crearse abre un seguimiento `tipo = 'propuesta'` (nivel 0, destinatario = dueño, `plazo_referencia` = `iniciado_en` = creación, `proximo_en` = creación + 4 horas laborales). Al vencer: acción `recordatorio` al dueño con aviso «Tienes una propuesta de Nexo sin revisar: «…»» y el seguimiento queda `agotado`. Nunca escala ni avisa a terceros. Revisarla lo cierra (`respondido`).

**16. Revisión de una propuesta.** Puede revisar: el dueño, mientras está `propuesto`; una parte, si está confirmado por dos fuentes y aún no tiene revisión humana. Nadie más (`ErrorDominio` «Solo X puede revisar «…»»).
- **Confirmar** → `confirmado`, `confirmado_por_id` = persona; revisión `confirmada` con `campos = []`.
- **Corregir** (`titulo`, `responsable`, `plazo`, `proyecto`; al menos uno distinto, si no `ErrorDominio` «No cambiaste nada») → aplica los cambios y confirma; revisión `corregida` con los campos cambiados. Corregir el proyecto le da el siguiente número del proyecto nuevo (única excepción a «el número no cambia», y solo mientras no tenía revisión humana).
- **Descartar** (motivo opcional) → `descartado`: sale de la instantánea (sus dependencias y seguimientos se ignoran o cierran) pero su número queda ocupado; revisión `descartada`; el mensaje no se vuelve a proponer.
- Tras confirmar o corregir: aviso de asignación al responsable si no es quien revisa y el trabajo no tiene entrega; R1 aplica desde ese momento (si el plazo ya venció, el siguiente tick pide el estado). Si tiene entrega y quien revisa es el solicitante, se abre en silencio el seguimiento `recepcion` (regla 20). *(R6b: si tiene entrega y quien revisa **no** es quien lo pidió —p. ej. el responsable dueño de la propuesta, o la otra parte que la escribe en la captura (regla 14a)—, al quedar confirmada la entrega se trata como cualquier otra: aviso «{Responsable} entregó «…». ¿Lo recibiste?» a quien lo pidió y seguimiento `recepcion` con ese aviso como nivel 0. Si ya hay un seguimiento `recepcion` pendiente, no se repite.)*
- Cada revisión: acción `revisar_propuesta` (sin destinatario), evento `propuesta_revisada` `{ resultado, campos }` con actor = la persona, y fila en `revisiones`.

**17. Captura insegura.** La captura sigue aplicándose al instante. La pregunta única de R9 es la forma de proponer en la captura: no crea trabajo hasta la respuesta. Al responderla se guarda una revisión `origen = 'captura'`: `confirmada` si la respuesta es la primera opción propuesta; `corregida` con `['responsable']` si es otra. Las preguntas de cantidad (C06) no son propuestas.

**18. Visibilidad y confianza.** `visiblePara(t, personaId)`: confirmado → todos; propuesto → solo su dueño; descartado → nadie. Las vistas generales (`listarTrabajos`, proyectos, Preguntar, contexto de la IA) cargan la instantánea **visible** sin propuestos; Mi día, el detalle y Correo usan la visible para quien mira. Confianza (calculada, no se guarda): `una_fuente` = propuesto; `dos_fuentes` = origen correo, confirmado, `confirmado_por_id` null; `persona` = todo lo demás. Un enlace «Abrir en Gmail» solo se muestra a quien tiene ese mensaje en su buzón.

**19. Quién puede dar algo por resuelto.** Para pasar un trabajo X a Resuelto (captura, botón, respuesta a un seguimiento):
- **Quien lo pidió** (solicitante ≠ responsable): lo resuelve directamente, con o sin entrega previa («Ya llegó el compresor», C14). La captura o la confirmación es la evidencia (`recepcion`).
- **El responsable**, si X tiene otro solicitante: no lo resuelve; **declara la entrega** (regla 20). La nota es el texto de la captura, la nota del botón o un enlace; sin nota ni enlace → `ErrorDominio` «Escribe qué entregaste o pega el enlace».
- **El responsable**, si X no tiene solicitante (semilla) o se lo pidió a sí mismo: lo resuelve con una nota como evidencia (la captura cuenta; desde el botón, `evidencia` obligatoria).
- **Nadie más** (ni un jefe de la cadena): `ErrorDominio` «Solo «quien pidió» o «responsable» puede darlo por resuelto». En la captura, la actualización se aplica sin el cambio de estado y el resumen lo dice.
- Un trabajo bloqueado por otro sin resolver no puede declararse entregado (sí resolverse, como hoy).

**20. Entrega y recepción.** Declarar la entrega (botón, captura del responsable o hecho `entrega` del correo) pone `entrega` y una evidencia `entrega`, cierra los seguimientos `estado` pendientes (cuenta como respuesta), acción `registrar_entrega` y evento `entrega_registrada`. Si X está confirmado: aviso al solicitante «{Responsable} entregó «…». ¿Lo recibiste?» y seguimiento `recepcion` (nivel 0 = ese aviso; nivel 1 = recordatorio al solicitante pasado el intervalo de R2; después `agotado`; **no escala**). Si X está propuesto: sin aviso (lo ve su dueño). **Confirmar recepción** (solo el solicitante; también el hecho `recepcion` del correo) → Resuelto con `resuelto_en = ahora`, liberación de la regla 5, cierre de seguimientos, acción `confirmar_recepcion`, evento `recepcion_confirmada`, y aviso al responsable «{Solicitante} confirmó que recibió «…»». **Rechazar la entrega** (solicitante, motivo obligatorio) → `entrega = null`, nota con el motivo, aviso al responsable, evento `entrega_rechazada`; R1 vuelve a aplicar con el plazo.

**21. Entrega en marcas, dependencias y cifras.** `entregado` = no resuelto con `entrega ≠ null` («entregado, por confirmar»). Atrasado = no resuelto ∧ `ahora ≥ plazo` ∧ ¬(`entrega.en ≤ plazo`): entregar a tiempo quita el atraso; entregar tarde no. Un trabajo entregado **no es fuente de riesgo** para sus dependientes, pero **no los libera**: la liberación (regla 5) espera a Resuelto. R1 no pide estado de un trabajo entregado. Las cifras cuentan solo Resueltos; los entregados se cuentan aparte en Registro.

**22. Tasa de corrección.** Universo: trabajos con `origen = 'correo'` (también los descartados) y capturas con pregunta de responsable respondida. De cada uno cuenta solo su **primera** revisión humana. `revisadas = confirmadas + corregidas + descartadas`; `tasa = revisadas = 0 ? null : round(100 × (corregidas + descartadas) / revisadas)`. Aparte: `porCampo` (responsable, plazo, titulo, proyecto: cuántas corregidas cambiaron cada uno; una corrección puede sumar en varios), `confirmadasPorFuentes` (dos fuentes sin revisión humana) y `sinRevisar` (propuestos vivos). Con `tasa = null` se muestra «Todavía no lo sé: nadie ha revisado lo que Nexo propuso». Reprogramar un plazo por captura no es una corrección.

**23. Quién espera a quién.** Se calcula sobre la instantánea visible para quien mira. Arista «A espera a B» si A depende de B (`dependencias`) o A está bloqueado por B, ambos no resueltos. Cadena = camino máximo desde un trabajo al que nadie espera hasta uno que no espera a nadie (sin repetir trabajos). Personas de la cadena: el solicitante del primero (o su responsable si no tiene) y el responsable de cada eslabón, sin repetir seguidas. **Cuello de botella** = persona responsable del último eslabón de cadenas de **dos o más proyectos** con **dos o más personas distintas** esperando detrás (sin contarse a sí misma).

---

## 4. Tipos y firmas

```ts
// dominio/tipos.ts (nuevos o cambiados)
export type OrigenTrabajo = 'semilla' | 'captura' | 'decision' | 'correo';
export type Confirmacion = 'propuesto' | 'confirmado' | 'descartado';
export type Confianza = 'una_fuente' | 'dos_fuentes' | 'persona';
export type TipoSeguimiento = 'estado' | 'recepcion' | 'propuesta';
export type CampoCorregible = 'titulo' | 'responsable' | 'plazo' | 'proyecto';
export interface Entrega { en: Date; porId: string; nota: string | null; enlace: string | null; fuente: 'correo' | 'captura' | 'interfaz' }
// Trabajo += confirmacion: Confirmacion; duenoPropuestaId: string | null; confirmadoPorId: string | null; entrega: Entrega | null
// Seguimiento += tipo: TipoSeguimiento
// TipoAccion += 'leer_correo' | 'proponer_trabajo' | 'reconocer_correo' | 'revisar_propuesta' | 'registrar_entrega' | 'confirmar_recepcion' | 'rechazar_entrega'
// TipoEvento += 'propuesta_revisada' | 'entrega_registrada' | 'recepcion_confirmada' | 'entrega_rechazada' | 'dependencia_creada' | 'evidencia_agregada'
export interface EvidenciaTrabajo { id: number; trabajoId: string; tipo: TipoEvidencia; fuente: 'correo' | 'captura' | 'interfaz';
  compromisoClave: string | null; mensajeId: string | null; buzones: string[]; enlaces: Record<string, string>; autorId: string | null; en: Date; cita: string }
export interface RevisionPropuesta { id: number; en: Date; personaId: string; origen: 'correo' | 'captura'; trabajoId: string | null;
  capturaId: number | null; resultado: 'confirmada' | 'corregida' | 'descartada'; campos: CampoCorregible[];
  propuesto: ValoresPropuesta; final: ValoresPropuesta | null; entrada: EntradaRevision; motivo: string | null }
export interface TasaCorreccion { inferidos: number; revisadas: number; confirmadas: number; corregidas: number; descartadas: number;
  porCampo: Record<CampoCorregible, number>; confirmadasPorFuentes: number; sinRevisar: number; tasa: number | null }
// constantes.ts
export const UMBRAL_MISMO_HECHO = 0.55; export const DOMINIO_EMPRESA = 'friodelvalle.cr'; export const PREFIJO_TRABAJO_CORREO = 'M';
// R2 añadió: UMBRAL_ENLACE_ESPERA = 0.45; BONO_ACTOR_ESPERA = 0.25; HORAS_REVISION_PROPUESTA = 4; MAX_CITA_EVIDENCIA = 220;
//   BUZONES_CONECTADOS_EN_ISO (lun 23 7:00). Tipos nuevos de apoyo en dominio/tipos.ts: FuenteEvidencia, TipoEvidencia,
//   ProveedorCorreo, ClaseCorreo, ResultadoLectura, ResultadoRevision, TrabajoDescartado, EvidenciaNueva, BuzonConectado,
//   MensajeLeido(Nuevo), ValoresPropuesta, EntradaRevision, RevisionNueva, CambiosPropuesta, EntradaRevisionPropuesta,
//   DatosRevisionCaptura, CasoCorreccion, Esperas; y noImplementado(donde, ...args) para los esqueletos.

// motor/instantanea.ts
// Instantanea += evidencias: EvidenciaTrabajo[]; descartados: Pick<Trabajo, 'id' | 'proyectoId' | 'numero'>[]
//   (trabajos ya NO incluye los descartados; dependencias, necesidades y seguimientos de descartados no se cargan;
//   R2: las evidencias se cargan todas, también las de descartados, por id. Orden de trabajos: id natural, M01 antes que T01)
export function siguienteIdTrabajoCorreo(inst: Instantanea): string;       // 'M01', 'M02'… (cuenta también los descartados)
// siguienteNumeroTrabajo: cuenta también los descartados (su número queda ocupado)
// R2: visiblePara e instantaneaVisible viven aquí (contrato de la instantánea, hechas por R2); motor/confianza.ts las reexporta.
//   db/instantanea.ts: cargarInstantaneaVisible(db, personaId | null), cargarBuzones, cargarMensajesLeidos,
//   cargarClavesLeidas (+ claveLeido(personaId, idInternet)), cargarRevisiones.
// motor/efectos.ts: Efecto += 
//   | { tipo: 'crear_dependencia'; dependencia: Dependencia; actorId: string | null }   // R2: con actor (evento derivado dependencia_creada)
//   | { tipo: 'agregar_evidencia'; evidencia: Omit<EvidenciaTrabajo, 'id'> }          // R2: evento derivado evidencia_agregada; id provisional = máx + 1
//   | { tipo: 'actualizar_evidencia'; evidenciaId: number; cambios: { buzones?: string[]; enlaces?: Record<string, string> } }
//   | { tipo: 'registrar_mensajes'; mensajes: MensajeLeidoNuevo[] }
//   | { tipo: 'registrar_revision'; revision: Omit<RevisionPropuesta, 'id'> }
//   actualizar_trabajo.cambios += 'titulo' | 'responsableId' | 'proyectoId' | 'numero' | 'confirmacion' | 'confirmadoPorId' | 'entrega'
//   (confirmacion = 'descartado' en aplicarEnMemoria mueve el trabajo a `descartados`)

// motor/confianza.ts (nuevo)
export function confianzaDe(t: Trabajo, evidencias: EvidenciaTrabajo[]): Confianza;            // regla 18
export function visiblePara(t: Trabajo, personaId: string | null): boolean;                     // null = vista general: solo confirmados
export function instantaneaVisible(inst: Instantanea, personaId: string | null): Instantanea;   // sin lo que esa persona no ve
export function buzonesDelPedido(t: Trabajo, evidencias: EvidenciaTrabajo[]): string[];         // partes en cuyo buzón está el pedido
// motor/propuestas.ts (nuevo)
export function seguimientoDePropuesta(inst: Instantanea, trabajoId: string): Efecto[];         // regla 15, nivel 0 sin acción
export function efectosRevision(inst: Instantanea, trabajoId: string, personaId: string,
  r: { tipo: 'confirmar' } | { tipo: 'corregir'; cambios: CambiosPropuesta } | { tipo: 'descartar'; motivo: string | null }): Efecto[]; // regla 16
export function revisionDeCaptura(propuestoId: string, elegidoId: string, datos: DatosRevisionCaptura): Omit<RevisionPropuesta, 'id'>; // regla 17 (R2: DatosRevisionCaptura en dominio/tipos.ts)
// motor/entregas.ts (nuevo)
export function modoResolucion(t: Trabajo, personaId: string): 'resolver' | 'entregar' | 'prohibido'; // regla 19
export function efectosEntrega(inst: Instantanea, trabajoId: string, personaId: string, e: { nota: string | null; enlace: string | null; fuente: Entrega['fuente'] }): Efecto[];
export function efectosRecepcion(inst: Instantanea, trabajoId: string, personaId: string, cita: string, fuente: Entrega['fuente']): Efecto[];
export function efectosRechazoEntrega(inst: Instantanea, trabajoId: string, personaId: string, motivo: string): Efecto[];
// motor/ingesta.ts (nuevo): reglas 12–14b sobre hechos ya extraídos
export function planLectura(inst: Instantanea, e: { hechos: HechoCorreo[]; copias: CopiaLeida[]; yaLeidos: Set<string> /* `${personaId}|${idInternet}` */;
  empresa: EmpresaCorreo }): { efectos: Efecto[]; resumen: ResumenLectura };
export function mismoHecho(inst: Instantanea, p: PedidoCorreo): string | null;                  // regla 12b
export function enlazarEspera(inst: Instantanea, espera: EsperaCorreo, propioId: string | null): string | null; // regla 13
export function proyectoDelPedido(inst: Instantanea, p: PedidoCorreo, enlazadoId: string | null): string;
// motor/esperas.ts (nuevo; sustituye a calcularCadenas y cuellos de correo/modelo.ts)
export function calcularEsperas(inst: Instantanea): { cadenas: { trabajoIds: string[]; personaIds: string[]; proyectoIds: string[] }[];
  cuellos: { personaId: string; proyectoIds: string[]; esperando: string[] }[] };            // regla 23
// motor/tasa.ts (nuevo)
export function calcularTasaCorreccion(revisiones: RevisionPropuesta[], inferidos: { id: string; confirmacion: Confirmacion; confirmadoPorId: string | null }[]): TasaCorreccion;
export function casoDePrueba(r: RevisionPropuesta): CasoCorreccion;                             // { entrada, propuesto, esperado: final, resultado }
// cambian: calcularMarcas (reglas 15 y 21), tick/siguienteEvento (tipos de seguimiento; R1 omite propuestos y entregados),
// efectosActualizacion(inst, plan, autorId, evidencia?: { texto: string; fuente }) (regla 19), efectosBloqueo y avisosPorRiesgoNuevo (sin avisos a propuestos)

// correo/tipos.ts (cambia): EmpresaCorreo y PersonaCorreo se conservan; Compromiso* y ModeloCorreo se van.
// R2: todo hecho lleva BaseHechoCorreo { compromisoClave; mensajeId; autorId; en; cita; enlaces; buzones } (también `buzones`,
//   que van a evidencias.buzones). EsperaCorreo { clase: 'dependencia' | 'bloqueo'; texto; actor; objeto; quienEsperaId }:
//   se llama `clase` (no `tipo`) para que `{ tipo: 'espera' } & EsperaCorreo` no sea imposible.
//   ResumenLectura vive en dominio/tipos.ts (la usa vistas.ts) y correo/tipos.ts la reexporta.
export type HechoCorreo = PedidoCorreo | (BaseHechoCorreo & { tipo: 'aceptacion' | 'entrega' | 'recepcion' | 'insistencia' })
  | (BaseHechoCorreo & { tipo: 'espera' } & EsperaCorreo);
export interface PedidoCorreo { tipo: 'pedido'; compromisoClave: string; mensajeId: string; asunto: string; titulo: string; solicitanteId: string | null;
  responsableId: string | null; plazo: Date | null; monto: number | null; espera: EsperaCorreo | null; buzones: string[]; enlaces: Record<string, string>; en: Date; cita: string }
export interface CopiaLeida { personaId: string; idInternet: string; enviado: Date; clase: ClasePrivacidad }
export interface ResumenLectura { leidos: number; laborales: number; descartados: number; creados: string[]; propuestos: string[];
  reconocidos: string[]; entregas: string[]; sinConvertir: number }
// correo/lectura.ts (nuevo, puro)
export function hechosDeCorreo(buzones: Buzon[], empresa: EmpresaCorreo, ahora: Date): { hechos: HechoCorreo[]; copias: CopiaLeida[] };
export function siguienteEnvio(buzones: Buzon[], yaLeidos: Set<string>, ahora: Date): Date | null; // próximo mensaje sin leer > ahora
// correo/extraccion.ts: extraerHechos(hilo: Hilo, empresa: EmpresaCorreo): HechoCorreo[]   (sustituye a extraerDeHilo)
// correo/extractor.ts (nuevo): interface ExtractorCorreo { readonly nombre: 'local' | 'claude'; extraer(hilo: Hilo, empresa: EmpresaCorreo): HechoCorreo[] }
//   Solo la implementación local; la de Claude queda para después (se ejecutará fuera de la transacción y se validará como la captura).

// servicios
leerCorreo(tx: Db, ahora: Date): Promise<ResumenLectura | null>;                 // regla 10; dentro de la transacción del reloj
siguienteCorreo(tx: Db, ahora: Date): Promise<Date | null>;
obtenerVistaCorreo(ctx, personaId: string): Promise<VistaCorreo>;                // pantalla Correo (§6)
conectarBuzon(ctx, personaId: string, direccion: string, proveedor: Proveedor): Promise<void>; // rechaza dominios ajenos (CC14)
revisarPropuesta(ctx, trabajoId: string, personaId: string, r: EntradaRevisionPropuesta): Promise<void>; // servicios/propuestas.ts
declararEntrega(ctx, trabajoId: string, personaId: string, e: { nota?: string; enlace?: string }): Promise<void>; // estado-trabajos.ts
confirmarRecepcion(ctx, trabajoId: string, personaId: string, nota?: string): Promise<void>;
rechazarEntrega(ctx, trabajoId: string, personaId: string, motivo: string): Promise<void>;
cambiarEstado(ctx, trabajoId: string, personaId: string, estado: EstadoTrabajo, evidencia?: string): Promise<void>; // regla 19 (R2: firma puesta; `evidencia` sin usar hasta R6b)
obtenerTasaCorreccion(ctx): Promise<TasaCorreccion>;  exportarCasosDePrueba(ctx): Promise<CasoCorreccion[]>; // servicios/tasa.ts
listarTrabajos(ctx, f?: { proyectoId?; responsableId?; verComo?: string }); obtenerTrabajo(ctx, id, verComo?: string);
cargarVistasTrabajos(db, verComo?: string | null): Promise<{ inst /* visible */; vistas }>;
// vistas.ts
ResultadoTick += lectura: ResumenLectura | null
TrabajoVista += origen; confirmacion; confianza: Confianza; dueno: PersonaBreve | null; confirmadoPor: PersonaBreve | null;
  entrega: { en; por: PersonaBreve; nota; enlace } | null; evidencias: { tipo; cita; autor: PersonaBreve | null; en; enlace: string | null }[]
MiDia += propuestas: TrabajoVista[]; porConfirmarRecibido: TrabajoVista[]
VistaCorreo { ahora; buzones: { persona; conectado; proveedor | null; leidos; laborales; personales; boletines }[];
  lineas: { en; de; para: PersonaBreve[]; resultado; trabajos: TrabajoRef[]; cita; enlace | null }[];
  sinConvertir: { en; de; cita }[]; esperas: ReturnType<typeof calcularEsperas> con nombres; tasa: TasaCorreccion }
// R2: `de` es RemitenteVista { nombre; correo; persona: PersonaBreve | null } (puede ser externo); esperas: EsperasVista;
//   calcularEsperas devuelve `Esperas` (dominio/tipos.ts). Proveedor de buzón = ProveedorCorreo ('gmail' | 'outlook'),
//   distinto de `Proveedor` (repuestos). Estado de las vistas hasta R6c: confianza 'persona' y evidencias [] (marcados «R6c»).
// R2: efectosActualizacion ya recibe `evidencia?: { texto; fuente: FuenteEvidencia }` (sin usar hasta R4).
```

`nombres.ts`: `idsInternosEn` también detecta `M\d{2,}`. Ningún texto visible lleva `M01`.

---

## 5. La empresa única: Frío del Valle en el correo

### 5.1 Personas y buzones

Las 12 personas de `04` con dirección `nombre.apellido@friodelvalle.cr` sin tildes (`andres.vargas@…`) y departamento para el correo: Marcela Gerencia; Andrés Operaciones; Ricardo Contabilidad; Paola Ventas; Sofía Servicio al cliente; Karla Compras; Lucía y Diego Bodega; Esteban, José, Daniela y Mario Campo. Jefes = los de la semilla. `EMPRESA_FRIO_DEL_VALLE` (en `src/correo/ejemplo/empresa.ts`) usa los mismos ids que `PERSONAS_SEMILLA` (una prueba lo comprueba). Dominios laborales externos: `lacolina.cr`, `panaderiatrigal.cr`, `hotelmirador.cr`, `refrigeracioncentral.cr` (proveedor habitual), `repuestosya.cr` (proveedor local).

**Buzones conectados (`BUZONES_DEMO`, todos Gmail):** Marcela, Andrés, Ricardo, Paola, Sofía, Karla, Lucía y Esteban. **Sin conectar:** Diego, José, Daniela y Mario (bodega y técnicos casi no usan correo). Sus mensajes existen, pero Nexo solo los ve cuando están en un buzón conectado.

### 5.2 Hilos laborales

| Hilo · asunto | Mensajes (fecha · de → para) | Hecho | Resultado en Nexo |
|---|---|---|---|
| H1 · Pago anticipado pedido 1047 | lun 23 9:00 · Andrés → Ricardo, cc Paola: «Ricardo, ¿puedes confirmar el pago anticipado del pedido 1047 de La Colina? Lo necesitamos antes del 26 de noviembre para despachar las vitrinas.» | pedido | **Reconoce T27** (PEDIDOS-9), dos fuentes |
| H2 · Cotización cámara fría Hotel Mirador (solo HTML) | mar 24 15:00 · Andrés → Paola: «Paola, ¿puedes enviar la cotización de la cámara fría al Hotel Mirador? La necesitan mañana antes de las 12:00.» | pedido | **Reconoce T28** (PEDIDOS-10) |
| H3 · Guías de entrega pedidos 1041 y 1042 | lun 23 15:00 · Ricardo → Diego: «Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042? Las necesito antes del 27 de noviembre para facturar.» · mar 24 16:30 · Diego → Ricardo: «Ricardo, te adjunto las guías firmadas de 1041 y 1042.» | pedido, entrega | **M01 nuevo, propuesto** (una fuente: Ricardo; dueño Ricardo), P4 **PEDIDOS-13** «Enviar las guías de entrega firmadas de los pedidos 1041 y 1042», Diego, pedido por Ricardo, vie 27 17:00; **entregado por Diego** mar 24 16:30 |
| H4 · Fotos mantenimiento Trigal Heredia y Alajuela | mar 24 17:00 · Esteban → Daniela: «Daniela, ¿puedes enviarme las fotos del mantenimiento de Heredia y Alajuela? Las necesito antes del 27 de noviembre para el informe de Trigal.» | pedido | **M02 nuevo, propuesto** (dueño Esteban), P2 **TRIGAL-7** «Enviar las fotos del mantenimiento de Heredia y Alajuela», Daniela, pedido por Esteban, vie 27 17:00 |
| H5 · Factura proforma Hotel Mirador | **mié 25 8:20** · Andrés → Ricardo: «Ricardo, ¿puedes emitir la factura proforma de la cámara fría del Hotel Mirador? La necesito antes del 27 de noviembre; se puede hacer en cuanto Paola envíe la cotización.» | pedido + espera (dependencia) | **M03 nuevo, confirmado por dos fuentes** (Andrés y Ricardo), P4 **PEDIDOS-14** «Emitir la factura proforma de la cámara fría del Hotel Mirador», Ricardo, pedido por Andrés, vie 27 17:00, **depende de T28**. Llega durante la demo |
| H6 · Reorden de repuestos críticos | mar 24 10:00 · Lucía → Karla: «Karla, ¿puedes cotizar el reorden con dos proveedores? Lo necesito antes del 27 de noviembre para definir la compra.» | pedido | **Reconoce T17** (REPUESTOS-4), dos fuentes |
| H7 · Reprogramar entrega 1043 Don Beto | mar 24 16:00 · Diego → Sofía: «Sofía, ¿puedes reprogramar la entrega 1043 con el cliente? Don Beto estaba cerrado el martes y los congeladores volvieron a bodega.» | pedido (sin plazo) | **Reconoce T22** (PEDIDOS-4), una fuente. Reconocer no necesita plazo |

Áreas cubiertas: Gerencia/Operaciones → Contabilidad y Ventas, Contabilidad → Bodega, Campo → Campo, Bodega → Compras, Bodega → Servicio al cliente. Los cuatro trabajos reconocidos ya existen en la semilla: el correo es **el mismo hecho** y solo agrega evidencia; los tres nuevos (M01–M03) no existen. Ninguno toca La Colina (P1), para que el guion conserve COLINA-8, COLINA-9 y COLINA-D1, ni cambia estados o marcas de la semilla antes de las 8:14.

### 5.3 Ruido (no produce nada)

Karla recibe el estado de cuenta de su tarjeta (`alertas@banco-personal.com`, personal). Sofía recibe un correo familiar «¿puedes traer el postre el domingo?» (personal). Lucía recibe un boletín de `ofertas@frioindustrial.com` con `List-Unsubscribe` en Promociones: «¿Puedes aprovechar nuestras ofertas de compresores antes del 30 de noviembre?». Ricardo recibe el boletín de `noreply@boletin-tributario.cr` en Notificaciones. Paola invita a las 11 personas al cumpleaños de Diego (lun 23 10:00; laboral, sin compromisos). Marcela tiene un borrador para Ricardo «¿puedes enviarme el flujo de caja de diciembre antes del viernes?» (no se lee). Gmail = Outlook: los mismos `MENSAJES_BASE` en forma Graph dan los mismos hechos y conteos.

### 5.4 Conteos esperados

Lectura de las 7:05 (todo lo enviado hasta entonces): **23 copias leídas**, 19 de trabajo (8 mensajes únicos), 2 personales y 2 boletines descartados. Por buzón (leídos/de trabajo/personales/boletines): Marcela 1/1/0/0, Andrés 3/3/0/0, Ricardo 5/4/0/1, Paola 3/3/0/0, Sofía 3/2/1/0, Karla 3/2/1/0, Lucía 3/2/0/1, Esteban 2/2/0/0. Orden de los hechos: H1 (T27), H3-m1 (M01), H6 (T17), H2 (T28), H7 (T22), H3-m2 (entrega M01), H4 (M02). Lectura de las 8:20: 2 copias (Andrés y Ricardo), 1 mensaje, M03.

---

## 6. Pantallas

Ninguna pantalla muestra ids internos (`M01`): título y referencia, como hoy.

**Correo (`/correo`)** deja de tener su propio «ver como»: usa la persona de la barra. Título «Correo · Lo que Nexo lee». Secciones: (1) **Buzones**: las 12 personas, conectado o no, proveedor, leídos, de trabajo, personales y boletines descartados, sin asunto ni remitente de lo descartado. (2) **Qué entendió Nexo** (solo mensajes del buzón de quien mira): fecha, de → para, resultado («Propuso «Enviar las guías…» (PEDIDOS-13)», «Creó … — lo vieron los dos buzones», «Es lo mismo que «Confirmar el pago…» (PEDIDOS-9)», «Entrega de …», «Mensaje de trabajo sin pedidos»), la cita y «Abrir en Gmail». (3) **Sin convertir**: pedidos sin plazo, con «¿Para cuándo?». (4) **Quién espera a quién** sobre los trabajos (regla 23), con el cuello de botella: «Lucía Mora (Bodega) es el final de cadenas en La Colina y Repuestos críticos: 6 personas esperan detrás». (5) **Cuánto se equivoca Nexo** (regla 22). Desaparecen «Te piden» y «Pediste y esperas»: viven en Mi día.

**Mi día** añade, arriba de «Lo que debo», **Propuestas de Nexo** (solo el dueño): tarjeta con título, referencia, «Propuesto por Nexo · una fuente: lo vi en tu buzón (lun 23, 15:00). Solo tú lo ves hasta que lo confirmes.», la cita, responsable, quien pidió, plazo, la entrega si la hay, y botones **Confirmar**, **Corregir** (título, responsable, plazo, proyecto) y **Descartar**. Y **Por confirmar recibido** (solo el solicitante): «Diego Rojas lo entregó el mar 24, 16:30: "Ricardo, te adjunto las guías firmadas de 1041 y 1042." ¿Lo recibiste?» con **Sí, lo recibí** y **No está bien** (motivo). En «Lo que debo», un trabajo entregado muestra «Entregado · falta que Ricardo Brenes confirme que lo recibió» y no tiene botón de estado; uno con solicitante tiene **Marcar entregado** (nota o enlace); uno sin solicitante, **Resuelto** con nota obligatoria.

**Detalle de trabajo**: insignia de confianza («Propuesto por Nexo · una fuente», «Confirmado por dos buzones: Andrés Vargas y Ricardo Brenes», «Confirmado por Ricardo Brenes», «Lo escribió José Alfaro», «Registrado en Nexo», «Creado por la decisión COLINA-D1»); sección **Evidencia** (cada cita con autor, hora y enlace si quien mira lo tiene); bloque de entrega; los mismos botones que Mi día según la regla 19. Un propuesto visto por otra persona responde «Este trabajo todavía es una propuesta de Nexo para X».

**Registro**: las tres cifras, debajo «Cuánto se equivoca Nexo: de 2 propuestas revisadas, 1 se confirmó tal cual, 1 se corrigió (plazo: 1) y 0 se descartaron · tasa de corrección 50 %. Además, 1 confirmada por dos buzones sin revisión de una persona.», y «Entregados por confirmar: n». Las acciones nuevas con etiqueta: Lectura de correo, Propuesta, Reconocido en el correo, Revisión, Entrega, Recibido, Entrega rechazada. **Proyectos** muestra la misma línea de la tasa cuando termine el rediseño (tarea R10).

---

## 7. Casos de control y guion ampliado

### 7.1 Casos nuevos (`prepararDemo({ correo: true })` salvo que diga otra cosa)

| Caso | Entrada | Resultado esperado exacto |
|---|---|---|
| V1 | hora 07:00, `avanzarReloj(5)` | `lectura` = `{ leidos: 23, laborales: 8, descartados: 4, creados: [], propuestos: ['M01','M02'], reconocidos: ['T27','T17','T28','T22'], entregas: ['M01'], sinConvertir: 0 }`; `acciones` del tick = 2 `pedir_estado` (T15, T21); 0 avisos nuevos fuera de esos dos; M01 `propuesto`, dueño `ricardo-brenes`, PEDIDOS-13, `entrega.porId = 'diego-rojas'`; M02 `propuesto`, dueño `esteban-castro`, TRIGAL-7; T27 con evidencia `pedido` y `buzones ⊇ ['andres-vargas','ricardo-brenes']` |
| V2 | V1 y `avanzarReloj(0)` | ninguna fila nueva en `mensajes_leidos`, ninguna acción `leer_correo`, `lectura = null` |
| V3 | V1 | `listarTrabajos()` = 30; P4 total 12; `obtenerMiDia(ricardo).propuestas` = [M01]; `obtenerMiDia(diego).debo` sin M01; `obtenerTrabajo('M01', 'diego-rojas')` = null |
| V4 | V1 y `fijarReloj(11:05)` | `recordatorio` a `ricardo-brenes` [M01] y a `esteban-castro` [M02]; ninguna acción con destinatario Diego o Daniela; a las 15:05, nada más sobre M01/M02 |
| V5 | V1 y `irAlSiguienteEvento` desde 08:14 | reloj 08:20; `creados: ['M03']`; M03 `confirmado`, confianza `dos_fuentes`, P4 PEDIDOS-14, dependencia M03→T28; 0 avisos |
| V6 | V5 y `fijarReloj(12:00)` | T28 atrasado; M03 en riesgo con causa `{ tipo: 'atrasado', trabajoId: 'T28' }` |
| V7 | V1; Ricardo confirma M01; luego `confirmarRecepcion(M01, ricardo)` | tras confirmar: `confirmado`, `confirmadoPorId = ricardo`, revisión `confirmada` `[]`, sin aviso; tras recibir: `resuelto`, aviso a `diego-rojas`, evento `recepcion_confirmada` actor Ricardo |
| V8 | V1; Esteban corrige M02 `{ plazo: jue 26 17:00 }` | plazo jue 26 17:00; revisión `corregida` `['plazo']` con `propuesto.plazo` vie 27 y `final.plazo` jue 26; aviso de asignación a `daniela-quesada`; seguimiento `propuesta` `respondido` |
| V9 | V1; Ricardo descarta M01; `avanzarReloj(0)`; Sofía captura C05 | M01 fuera de `inst.trabajos` y en `inst.descartados`; no se vuelve a proponer; el trabajo de C05 es PEDIDOS-14 (13 sigue ocupado) |
| V10 | V1; Daniela intenta confirmar M02 | `ErrorDominio`; nada cambia |
| V11 | correo apagado; tras E4-A, `declararEntrega(T32, karla, { nota: 'Llegaron a bodega, factura 4471' })` a 8:20 | T32 `en_curso` con `entrega`; aviso a `marcela-solis`; seguimiento `recepcion`; a las 12:20 `recordatorio` a Marcela, después nada (sin escalamiento); a las 15:00 T32 no atrasado ni `pedir_estado` a Karla; `confirmarRecepcion(T32, marcela)` → resuelto, aviso a Karla |
| V12 | correo apagado; C01; `cambiarEstado(T31, lucia, 'resuelto', 'Lo traje del proveedor local')` | T31 **no** resuelto, con `entrega`; T04 sigue bloqueado; aviso a `jose-alfaro`. Sin evidencia → `ErrorDominio` |
| V13 | correo apagado, 12:10 | `cambiarEstado(T28, paola, 'resuelto')` → `ErrorDominio` «Escribe qué entregaste…»; con evidencia «Enviada al Hotel Mirador» → resuelto. `cambiarEstado(T28, andres, 'resuelto', 'x')` → `ErrorDominio` |
| V14 | correo apagado | `obtenerTasaCorreccion` = `{ inferidos: 0, revisadas: 0, …, tasa: null }`; C10 y `responderCaptura(id, 'lucia-mora')` → revisión `confirmada` origen `captura` (`revisadas: 1, tasa: 0`); con `'diego-rojas'` → `corregida` `['responsable']` (`tasa: 100`) |
| V15 | puras sobre `MENSAJES_BASE` | Gmail y Outlook: mismos hechos y conteos; ningún hecho sale del ruido; ninguna fila de `mensajes_leidos` del borrador; `conectarBuzon(…, 'paola@gmail.com')` → `ErrorDominio` |
| V16 | puras con mensajes de prueba | pedido sin plazo nuevo → `sin_plazo`, sin trabajo; pedido visto solo en copia de un tercero → `sin_parte`; espera de bloqueo del responsable → trabajo bloqueado por el enlazado; «recibido, gracias» del solicitante tras una entrega → resuelto; un pedido igual a un trabajo de captura → reconocido, sin duplicado |
| V17 | guion paso 13 | `calcularEsperas`: un solo cuello, `lucia-mora`, proyectos [P1, P3] |

### 7.2 Guion ampliado (`tests/integracion/guion.test.ts`, `prepararDemo({ hora: '07:00', correo: true })`)

Los pasos 0–9 de `05` §6.3 **no cambian de resultado**; el paso 1 añade la aserción de V1 sobre `r.lectura`. Pasos nuevos (en `03` §4, entre «Registro» y el cierre):

| Paso | Reloj · ver como | Llamada | Resultado esperado exacto |
|---|---|---|---|
| 10 | 8:20 · Ricardo | `irAlSiguienteEvento` | reloj 8:20 (el próximo correo, antes que el siguiente evento del motor, 10:00); `acciones` del tick `[]`; `lectura.creados = ['M03']` (V5). En pantalla: el correo de Andrés se volvió trabajo con dependencia, sin que nadie escribiera nada |
| 11 | 8:21 · Ricardo | `avanzarReloj(1)`; `obtenerMiDia(ricardo)`; `revisarPropuesta(M01, ricardo, confirmar)`; `confirmarRecepcion(M01, ricardo)` | `propuestas` = [M01] con confianza `una_fuente` y entrega de Diego; `debo` incluye M03 (`dos_fuentes`); M01 resuelto; aviso a Diego; seguimientos = 20 |
| 12 | 8:22 · Esteban | `avanzarReloj(1)`; `obtenerMiDia(esteban)`; `revisarPropuesta(M02, esteban, corregir { plazo: jue 26 17:00 })` | `propuestas` = [M02]; como V8; seguimientos = 21 |
| 13 | 8:23 · Marcela | `avanzarReloj(1)`; `obtenerCifras`; `obtenerTasaCorreccion`; `listarProyectos`; `obtenerVistaCorreo(marcela)` | cifras `{ resueltosSinGerente: 7, resueltosTotal: 9, porcentaje: 78, seguimientos: 21, preguntasRespondidas: 1, minutosAhorrados: 225, horasAhorradas: 3.8 }`; tasa `{ inferidos: 3, revisadas: 2, confirmadas: 1, corregidas: 1, descartadas: 0, porCampo: { titulo: 0, responsable: 0, plazo: 1, proyecto: 0 }, confirmadasPorFuentes: 1, sinRevisar: 0, tasa: 50 }`; sumas de proyectos (total, resueltos, bloqueados, atrasados, en riesgo) = [35, 9, 1, 2, 3]; cuello V17; ninguna acción `escalamiento` a Marcela |
| 14 | — | (el antiguo paso 10) | ningún texto con id interno, ahora también `M\d{2}`; referencias: T31 COLINA-8, T32 COLINA-9, M01 PEDIDOS-13, M02 TRIGAL-7, M03 PEDIDOS-14; D01 COLINA-D1 |

Registro al final (conteos por tipo): `pedir_estado` 2, `recordatorio` 1, `escalamiento` 1, `aviso` 17, `crear_decision` 1, `aplicar_decision` 1, `leer_correo` 2, `reconocer_correo` 4, `proponer_trabajo` 2, `crear_trabajo` 2, `registrar_entrega` 1, `revisar_propuesta` 2, `confirmar_recepcion` 1. Frase de cierre: «La gerente tomó una decisión. No persiguió a nadie, y nadie le escribió una tarea a Nexo.»

### 7.3 Pruebas existentes que cambian

| Prueba | Cambio y motivo |
|---|---|
| `tests/correo/*` | Se reescriben: Frío del Valle en vez de Grupo Altavista; desde R5 comprueban hechos y la lectura, no compromisos ni `correcciones_correo` |
| `tests/db/conexion.test.ts` | 20 tablas (+`buzones`, `evidencias`, `mensajes_leidos`, `revisiones`; −`correcciones_correo`); lee y escribe cada tabla nueva |
| `tests/db/{instantanea,semilla}.test.ts`, `tests/motor/efectos.test.ts` | Campos nuevos de `Trabajo`/`Seguimiento`, `inst.evidencias` y `inst.descartados`, efectos nuevos; la semilla tiene 8 buzones |
| `tests/escenarios/e1-responder.test.ts` (línea 60) | `cambiarEstado(T28, paola, 'resuelto')` necesita evidencia (regla 19): se pasa `'Ya la envié.'` |
| `tests/servicios/mi-dia.test.ts` (línea 53) | Marcela resuelve T18 (sin solicitante) con evidencia; Mi día trae `propuestas` y `porConfirmarRecibido` vacíos |
| `tests/servicios/reloj.test.ts` | `ResultadoTick` trae `lectura` (null con correo apagado) |
| `tests/dominio/nombres.test.ts` | Sin TRANSLOG; `idsInternosEn('M01')` = ['M01'] |
| `tests/integracion/guion.test.ts` | Pasos 10–14 nuevos; el antiguo 10 pasa a 14 |
| C01–C15, E1–E5, C13 | Sin cambio de resultado (no leen correo; C14 la resuelve quien la pidió; E1 y E5 son trabajos sin solicitante resueltos con la captura como nota) |

---

## 8. Plan por tareas

Reglas de `05` §7: un dueño por archivo; la propiedad pasa solo por una dependencia explícita; cada tarea en su worktree; `pnpm verificar` en verde además de su criterio; no se toca `package.json`. **R2 puede hacer, además, ediciones mecánicas** (añadir los campos nuevos con su valor por defecto) en cualquier archivo que construya literales de `Trabajo` o `Seguimiento`; nada más.

| Id | Título | Dif. → modelo | Archivos que posee | Depende de | Terminado cuando |
|---|---|---|---|---|---|
| R1 | Empresa única: Frío del Valle en el correo | media → Sonnet | `src/correo/ejemplo/{empresa,buzones}.ts`, `src/correo/{extraccion,privacidad}.ts` (solo ajustes para los textos nuevos y «hoy antes de las»), `src/servicios/correo.ts`, `src/app/correo/page.tsx` (textos), `src/app/acciones/correo.ts`, `src/componentes/correo/*`, `src/dominio/nombres.ts` (comentarios y ejemplos), `tests/correo/*`, `tests/dominio/nombres.test.ts`, `docs/06`, `docs/07`, `README.md` | — | `pnpm vitest run tests/correo tests/dominio` (hilos y conteos de §5 con el modelo actual) y `git grep -il altavista -- . ':!docs/08-reformas-v2.md'` vacío |
| R2 | Contratos y esquema v2 | alta → Opus | `dominio/{tipos,constantes}.ts`, `db/{esquema,ddl,instantanea}.ts`, `db/semilla/{datos,cargar}.ts`, `motor/{instantanea,efectos}.ts`, `servicios/vistas.ts`, `dominio/nombres.ts`, `tests/ayudantes/preparar.ts`, `tests/db/*`, `tests/motor/efectos.test.ts`, `tests/dominio/nombres.test.ts` | R1 | `pnpm verificar`; `pnpm vitest run tests/db` con una base anterior puesta al día (prueba de §2.4) |
| R3 | Motor: confianza, propuestas, marcas y seguimiento | alta → Opus | `motor/{confianza,propuestas,marcas,seguimiento,propagacion}.ts`, `tests/motor/{confianza,propuestas,marcas,seguimiento}.test.ts` | R2 y la reforma de escalamiento fusionada | `pnpm vitest run tests/motor` (reglas 14–18, 21 en marcas, tipos de seguimiento) |
| R4 | Motor: entrega y resolución con evidencia | alta → Opus | `motor/{entregas,actualizacion}.ts`, `tests/motor/entregas.test.ts` | R2 | `pnpm vitest run tests/motor/entregas tests/captura` (reglas 19–20) |
| R5 | Lectura de correo: hechos, ingesta y esperas | alta → Opus | `src/correo/{tipos,lectura,extractor}.ts`, `src/correo/extraccion.ts` (pasa de R1), `motor/{ingesta,esperas}.ts`, `tests/correo/{lectura,ingesta}.test.ts`, `tests/motor/esperas.test.ts` | R1, R3 | `pnpm vitest run tests/correo tests/motor/esperas` (§5.4, V15, V16, V17 en puro) |
| R6a | Lectura en el reloj y servicio de correo | alta → Opus | `servicios/{reloj,correo}.ts`, `tests/servicios/{reloj,lectura}.test.ts` | R5 | `pnpm vitest run tests/servicios/reloj tests/servicios/lectura` (V1, V2, V4, V5) |
| R6b | Propuestas, entregas, captura y tasa | alta → Opus | `servicios/{propuestas,tasa,estado-trabajos,validacion,captura,aplicar}.ts`, `ia/contexto.ts`, `motor/tasa.ts`, `tests/servicios/{propuestas,entregas,tasa}.test.ts`, `tests/escenarios/e1-responder.test.ts` | R3, R4 | `pnpm vitest run tests/servicios/propuestas tests/servicios/entregas tests/servicios/tasa tests/captura tests/escenarios` (V7–V14) |
| R6c | Visibilidad y Mi día | media → Sonnet | `servicios/{consultas-trabajos,mi-dia}.ts`, `tests/servicios/{consultas,mi-dia}.test.ts` | R3, R4 | `pnpm vitest run tests/servicios/consultas tests/servicios/mi-dia tests/preguntar` (V3) |
| R7a | Pantalla Correo como vista de la fuente | media → Sonnet | `src/app/correo/page.tsx`, `src/app/acciones/correo.ts`, `src/componentes/correo/*` (pasan de R1), `src/componentes/{insignia-confianza,tasa-correccion}.tsx`, `src/app/globals.css` (un bloque al final) | R6a, R6c, rediseño fusionado | `pnpm build`; con `pnpm dev`, reiniciar, «+5 min» y `/correo` como Ricardo muestra «PEDIDOS-13» y 5 leídos |
| R7b | Mi día, detalle y registro | media → Sonnet | `src/app/{mi-dia,registro}/page.tsx`, `src/app/trabajos/[id]/page.tsx`, `src/app/acciones/{trabajos,propuestas}.ts`, `src/componentes/{tarjeta-propuesta,formulario-entrega,insignia-entrega}.tsx` | R6b, R6c, R7a | `pnpm build`; con `pnpm dev`, pasos 10–13 del guion a mano en 1280 px sin errores en consola |
| R8 | Guion ampliado | alta → Opus | `tests/integracion/guion.test.ts`, `docs/03-etapa-0-definicion.md` (§4: pasos nuevos) | R6a, R6b, R6c | `pnpm vitest run tests/integracion` y `pnpm verificar` |
| R9 | Retirar el modelo aparte y poner al día los documentos | baja → Haiku | borra `src/correo/{modelo,enlaces}.ts` y lo que solo ellos usan; `db/{esquema,ddl}.ts` (quitar `correcciones_correo`, pasan de R2); `tests/db/conexion.test.ts`; `docs/05` (§2, §3, §4.4: remiten a este documento), `docs/06` (§6–§10 sustituidos) | R7a, R7b, R8 | `pnpm verificar && pnpm build`; `git grep -n "correccionesCorreo\|calcularModeloCorreo"` vacío |
| R10 | Tasa en Proyectos | baja → Haiku | `src/app/proyectos/page.tsx` (solo añadir `<TasaCorreccion>`), `src/componentes/cifras-demo.tsx` | R7a y el rediseño de proyectos fusionado | `pnpm build`; `/proyectos` muestra la línea de la tasa |

**Orden recomendado:** R1 → R2 → (R3 ∥ R4) → R5 → (R6a ∥ R6b ∥ R6c) → R7a → (R7b ∥ R8) → R9 → R10. Camino crítico: R1 → R2 → R3 → R5 → R6a → R7a → R7b → R9. Un verificador (`pnpm verificar` + `pnpm build`) después de R2, de R6 y de R9.

---

## 9. Riesgos y decisiones para el dueño del producto

**Riesgos.** (1) R3 edita `motor/seguimiento.ts`, que la reforma de escalamiento está cambiando: R3 no empieza hasta que esa reforma esté fusionada. (2) `globals.css` y Proyectos pertenecen al rediseño: R7a añade un solo bloque al final y R10 espera al rediseño. (3) El extractor local es frágil: está afinado a los textos de §5.2; cambiar una palabra de un correo de ejemplo puede cambiar un hecho (las pruebas de R1 y R5 lo detectan). (4) La lectura alarga la transacción del reloj; con los ejemplos es despreciable, con correo real habrá que leer fuera de ella. (5) Siete archivos de contrato cambian a la vez: R2 los cierra antes de que nadie más empiece.

**Decisiones** (cada una con mi recomendación):

1. **Aprobar los cambios de contrato y borrar `correcciones_correo`** (§2). Recomiendo aprobar: sin ellos no hay modelo único; los datos que se pierden son de Grupo Altavista.
2. **¿Escala la falta de confirmación de recibido?** Recomiendo que no: un aviso y un recordatorio al solicitante, sin jefes, porque la entrega ya no frena a los dependientes (regla 21) y escalar un «¿lo recibiste?» sería ruido.
3. **Las dos copias del mismo correo cuentan como dos fuentes.** Es lo ordenado, pero es el mismo mensaje visto por las dos partes, no dos testimonios. Recomiendo mantenerlo y nombrarlo así en pantalla («lo vieron los dos buzones»), y exigir que ambos buzones sean de las partes, nunca de alguien en copia.
4. **Pedidos sin plazo no se convierten en trabajo** (regla 12c), porque el esquema exige plazo y no se inventa. Recomiendo mantenerlo y preguntar «¿Para cuándo?» en Correo; volver plazo opcional costaría tocar todo el motor.
5. **Buzones de la demo: 8 de 12 conectados** (bodega y técnicos no). Recomiendo esto: permite mostrar a la vez una propuesta de una fuente y una confirmación de dos; si todos conectaran, casi nada sería «propuesto».
