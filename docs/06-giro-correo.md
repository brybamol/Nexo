# Nexo — Giro: coordinación entre departamentos a partir del correo

*Fecha: 21-11-2026 · Estado: borrador para aprobar · Rama: `giro-correo` · Complementa a `03`, `04` y `05`; no los reemplaza todavía*

Este documento define el giro de Nexo y el prototipo que lo demuestra. Mientras esté en borrador, `05-arquitectura-y-planes.md` sigue siendo el contrato del MVP actual; lo que aquí se añade vive en piezas nuevas (`src/correo/`, una tabla nueva y una pantalla nueva) y no cambia el comportamiento del guion de la demo.

---

## 1. La premisa

Nexo es **el punto donde se conectan los departamentos** de una empresa corporativa. Nadie crea tareas en Nexo: Nexo lee el correo que la gente ya intercambia (Gmail con cuentas de Google Workspace primero; Outlook y WhatsApp después, ver §13) y reconstruye por sí solo:

- **qué se pidió**: requerimientos, compromisos y entregables, con quién lo pidió y para cuándo;
- **qué ya hay**: lo entregado o confirmado;
- **qué falta** y **quién espera a quién**, entre departamentos.

Con eso, Finanzas no tiene que perseguir a Legal ni Legal a Finanzas: Nexo hace visible la cadena completa y la empuja.

La prueba sigue siendo la del README: si alguien tiene que cargar información o perseguir a otro para saber cómo va algo, todavía no es Nexo.

## 2. Principios

1. **Cada persona conecta su propio buzón.** Permiso de solo lectura; Nexo nunca envía correo en nombre de nadie sin aprobación.
2. **Nexo guarda hechos de trabajo, no correos.** De cada correo laboral solo se guarda lo extraído, una cita corta como evidencia y un enlace al mensaje original. Lo no laboral se descarta sin guardarse.
3. **Nadie crea tareas; todos pueden corregir.** Lo que Nexo infiere aparece como *propuesto por Nexo*; la persona lo confirma, lo corrige o lo descarta. Cada corrección queda registrada.
4. **Nexo une lo que ven distintos buzones.** El mismo pedido aparece en los enviados de quien pide y en la bandeja de quien lo recibe: es **un solo compromiso** visto desde dos lados.
5. **Se conservan las reglas del MVP:** la IA solo propone; nada con costo se ejecuta sin aprobación humana; si no hay dato, «no lo sé»; la hora viene del reloj de la demo.

## 3. Qué cambia y qué se conserva

| Pieza | MVP actual | Con el giro |
|---|---|---|
| Entrada | Caja de captura: alguien escribe una frase | Buzones conectados: Nexo lee hilos de correo |
| Unidad | Una frase genera un trabajo | Un hilo produce compromisos, entregas y esperas |
| Origen | `captura` o `semilla` | `correo`, con evidencia (cita + enlace) |
| Empresa | Distribuidora con bodega y técnicos | Corporativo con departamentos |
| Identidad | Selector «ver como» | Prototipo: «ver como»; producto: cuenta de Google Workspace (después, Microsoft 365) |
| Salida | Avisos dentro de la web | Prototipo: web; producto: también resumen por correo |
| Se conserva | Estados (Abierto, En curso, Bloqueado, Resuelto), marcas calculadas (Atrasado, En riesgo), dependencias, decisiones con costo, registro con hecho de origen | — |

## 4. El flujo

1. **Fuente.** Cada buzón entrega sus mensajes en la forma de su proveedor y un **adaptador** los lleva a un mensaje normalizado (`MensajeCorreo`): id en el buzón, hilo en el buzón, `Message-ID`, `In-Reply-To`/`References`, asunto, remitente, destinatarios, fecha, texto plano, enlace y si es automático. El resto del flujo no sabe de qué proveedor viene.
   - **Gmail** (primero, §13): API de Gmail, `users.messages.get`. Producto: avisos por Pub/Sub + historial incremental. Prototipo: archivos de ejemplo con esa misma forma; es la fuente de la demo.
   - **Outlook**: Microsoft Graph, `/me/messages`. Producto: notificaciones de cambio + consulta delta. Prototipo: el mismo ejemplo en esa forma, para probar que da el mismo resultado.
2. **Filtro de privacidad.** Clasifica cada mensaje como `laboral`, `personal` o `boletin`. Solo `laboral` sigue. De lo descartado solo se cuenta cuántos hubo, por buzón.
3. **Unión de buzones.** El mismo `Message-ID` en varios buzones es un solo mensaje. El hilo del proveedor solo vale dentro de un buzón (en Gmail cada persona tiene su propio `threadId`), así que dos mensajes van al mismo hilo si uno responde al otro (`In-Reply-To`/`References`) o si comparten hilo en algún buzón. Cada mensaje recuerda en qué buzones aparece; el enlace «Abrir en Gmail» solo se muestra a quien lo tiene en su buzón.
4. **Extracción por hilo.** Recorre el hilo en orden y produce hechos: pedido, aceptación, entrega, espera (dependencia o bloqueo) e insistencia.
5. **Enlace entre hilos.** Una espera («lo reviso cuando Finanzas confirme la garantía») se enlaza con el compromiso que la resuelve en **otro** hilo y quizá en **otro** buzón. Los compromisos enlazados forman un proyecto.
6. **Modelo vivo.** Sobre los compromisos se calculan las marcas (Atrasado, En riesgo, con causas), las cadenas de «quién espera a quién» y los cuellos de botella.
7. **Personas.** Cada quien ve *lo que le piden*, *lo que pidió y espera* y *quién espera a quién*. Confirma, corrige o descarta. Las correcciones se aplican sobre lo extraído cada vez que se calcula el modelo.

## 5. Privacidad (reglas del prototipo)

- **Laboral:** el remitente es del dominio de la empresa o de un dominio externo registrado como contacto de trabajo (proveedores, clientes, banco).
- **Boletín:** trae la cabecera `List-Unsubscribe`, Gmail lo puso en Promociones, Social o Foros, o el remitente es `noreply`/`no-reply`/`no-responder`. Se descarta aunque sea de un dominio laboral.
- **Personal:** cualquier otro remitente externo. Se descarta.
- **La clasificación usa solo encabezados.** El cuerpo de lo personal y de los boletines ni se decodifica.
- **No se leen** borradores, spam ni papelera.
- **Solo cuentas de la empresa:** Nexo no conecta cuentas personales `@gmail.com`; la cuenta tiene que ser del dominio de la empresa (Google Workspace).
- De lo laboral se usa solo lo que escribió esa persona en ese mensaje: el historial citado de las respuestas («El … escribió:», `>`) se quita.
- Un mensaje laboral sin pedidos ni entregas (por ejemplo, una invitación a un cumpleaños) no produce nada.
- La pantalla de buzones muestra, por persona, cuántos mensajes se leyeron, cuántos fueron laborales y cuántos se descartaron. Nunca muestra asunto ni remitente de lo descartado.
- La evidencia es **una oración**, recortada a 220 caracteres.

En producción, la clasificación la hará la IA con estas mismas categorías, y cada persona podrá marcar un hilo o un contacto como «no leer».

## 6. Modelo

```ts
type ClasePrivacidad = 'laboral' | 'personal' | 'boletin';
interface Compromiso {
  id: string;               // estable: sale del internetMessageId del pedido
  titulo: string;           // «Revisar el contrato de TransLog»
  solicitanteId: string;    // quien pidió
  responsableId: string;    // quien debe hacerlo
  plazo: Date | null;       // null = no lo sé
  monto: number | null;     // colones; si hay monto, tiene costo
  estado: EstadoTrabajo;    // los mismos cuatro estados
  esperaA: Espera | null;   // dependencia (pedida así) o bloqueo (declarado por el responsable)
  insistencias: number;     // cuántas veces el solicitante preguntó cómo iba
  evidencias: Evidencia[];  // cita, autor, fecha, mensaje
  hiloId: string;
  proyecto: string;         // nombre propio común a los asuntos enlazados
  revision: { tipo: 'propuesto' | 'confirmado' | 'corregido'; porId?: string; en?: Date };
}
interface Espera { texto: string; compromisoId: string | null; tipo: 'dependencia' | 'bloqueo' }
```

**Marcas** (se calculan, no se guardan): *Atrasado* si no está resuelto y `ahora ≥ plazo`. *En riesgo* si espera a un compromiso no resuelto que está atrasado, bloqueado o en riesgo, o cuyo plazo es posterior al propio. Cada marca lleva su causa.

**Tabla nueva** `correcciones_correo`: `id` serial, `compromiso_id` text, `persona_id` text, `en` timestamptz, `tipo` (`confirmar`/`corregir`/`descartar`), `cambios` jsonb (`{ titulo?, responsableId?, plazo?, estado? }`). Es lo único que el prototipo guarda: los compromisos se recalculan desde los correos y se les aplican las correcciones en orden.

## 7. Extracción local (prototipo)

El prototipo usa un intérprete local determinista: lo bastante bueno para los correos de ejemplo, no para correo real. En producción lo hará Claude con un esquema zod, como la captura actual, y el local quedará de respaldo. Reglas por oración, en orden del hilo:

| Hecho | Señal | Efecto |
|---|---|---|
| Pedido | «¿Puedes/Podrías/Me ayudas a *verbo*…?» de un remitente a un destinatario directo | Compromiso nuevo: título = verbo en infinitivo (sin pronombre) + complemento, recortado antes de «por ₡», «antes de», «para el» |
| Plazo | «antes del 4 de diciembre», «antes del viernes 20 de noviembre», «mañana antes de las 10:00» | Fecha en hora de Costa Rica; sin hora → 17:00. Sin señal → `null` («no lo sé») |
| Monto | «₡18.000.000» | `monto`; tiene costo |
| Aceptación | «lo reviso», «la gestiono», «me encargo» del responsable | En curso |
| Espera | «cuando/en cuanto *[Persona/Departamento]* *verbo* *objeto*» | Del responsable: Bloqueado. Del solicitante al pedir: dependencia (sigue Abierto) |
| Entrega | «te adjunto», «quedan listas», «ya está» del responsable, sin espera | Resuelto |
| Insistencia | «seguimos sin», «sigo esperando», «¿cómo vamos con…?» del solicitante | `insistencias + 1` |

**Enlace de esperas:** se busca, entre los demás compromisos no descartados, el de mayor similitud (Dice de bigramas, `dominio/texto.ts`) entre el objeto de la espera y el título, con bonificación si el responsable coincide con la persona o el departamento nombrados. Si el objeto es un pronombre («me los envíe»), se usa la persona nombrada y el solicitante. Por debajo del umbral, la espera queda sin enlazar y se muestra como «no sé de qué compromiso depende».

**Proyecto:** compromisos unidos por esperas o por un nombre propio común en sus asuntos (sin contar la primera palabra) forman un proyecto; su nombre es ese nombre propio.

## 8. Empresa ficticia: Grupo Altavista

Corporativo de 320 empleados con oficinas en San José; la demo usa 7 personas y el dominio `altavista.cr`. Contactos externos de trabajo: `translog.cr` (proveedor de logística). "Hoy" es el del reloj de la demo: **miércoles 25 de noviembre de 2026, 7:00**.

| Persona | Rol | Departamento | Jefe |
|---|---|---|---|
| Roberto Solano | Gerente general | Gerencia | — |
| Ana Rodríguez | Jefa de compras | Compras | Roberto Solano |
| Luis Méndez | Abogado corporativo | Legal | Roberto Solano |
| Carla Fernández | Tesorera | Finanzas | Roberto Solano |
| Pablo Rojas | Analista financiero | Finanzas | Carla Fernández |
| Sergio Vargas | Gerente de marketing | Marketing | Roberto Solano |
| Valeria Castro | Líder de TI | TI | Roberto Solano |

### Hilos laborales

| Hilo | Mensajes |
|---|---|
| H1 · Revisión contrato TransLog | mié 18 nov Ana → Luis (cc Roberto): pide revisar el contrato antes del 4 dic. · vie 20 nov Luis → Ana: lo revisa en cuanto Finanzas confirme la garantía. |
| H2 · Garantía de cumplimiento TransLog | mar 17 nov Ana → Carla: pide gestionar la garantía bancaria antes del 30 nov (₡25.000.000). · mar 24 nov Carla → Ana: el banco pide estados auditados; la solicita en cuanto Pablo se los envíe. |
| H3 · Estados financieros auditados 2025 | mar 24 nov Carla → Pablo: pide los estados mañana antes de las 10:00. |
| H4 · Alta de TransLog en el ERP | vie 20 nov Ana → Valeria: pide darlo de alta antes del 7 dic, cuando firmen el contrato con TransLog. |
| H5 · Presupuesto campaña Navidad | lun 16 nov Sergio → Carla: pide aprobar el presupuesto (₡18.000.000) antes del vie 20 nov. · sáb 21 nov Sergio → Carla (cc Roberto): «seguimos sin la aprobación». |
| H6 · Bases legales promoción Navidad | mar 17 nov Sergio → Luis: pide revisarlas antes del 24 nov. · sáb 21 nov Luis → Sergio: te adjunto las bases; quedan listas. |
| H7 · Landing campaña Navidad | jue 19 nov Valeria → Sergio: pide los textos finales antes del 26 nov. · mar 24 nov Sergio → Valeria: se los pasa cuando Finanzas apruebe el presupuesto. |

### Ruido (no debe producir nada)

Ana recibe el estado de cuenta de su tarjeta (personal). Carla recibe un correo familiar (personal). Luis y Valeria reciben boletines con `List-Unsubscribe`. Sergio invita a todos al cumpleaños de Pablo (laboral, sin compromisos). Roberto tiene un borrador sin enviar que pide algo a Carla (no se lee). En formato Gmail, el boletín de licencias está en Promociones, el de Luis en Notificaciones, y el correo de Ana a Valeria llega solo en HTML.

## 9. Casos de control

Los códigos se asignan por la fecha del pedido y no cambian aunque alguien descarte uno.

| Caso | Se espera |
|---|---|
| CC1 | 7 compromisos (C1–C7); ninguno sale del ruido. |
| CC2 | C1 «Aprobar el presupuesto de la campaña de Navidad»: Sergio → Carla, vie 20 nov 17:00, ₡18.000.000, **Abierto**, **Atrasado**, 1 insistencia. |
| CC3 | C2 «Gestionar la garantía bancaria de cumplimiento con el banco»: Ana → Carla, lun 30 nov 17:00, ₡25.000.000, **Bloqueado**, espera a C7. Sin marcas a las 7:00. |
| CC4 | C3 «Revisar las bases legales de la promoción de Navidad»: Sergio → Luis, **Resuelto** el sáb 21 nov. |
| CC5 | C4 «Revisar el contrato de TransLog»: Ana → Luis, vie 4 dic 17:00, **Bloqueado**, espera a C2, **En riesgo** (C2 bloqueado). |
| CC6 | C5 «Enviar los textos finales de la campaña de Navidad»: Valeria → Sergio, jue 26 nov 17:00, **Bloqueado**, espera a C1, **En riesgo** (C1 atrasado). |
| CC7 | C6 «Dar de alta a TransLog como proveedor en el ERP»: Ana → Valeria, lun 7 dic 17:00, **Abierto**, depende de C4, **En riesgo**. |
| CC8 | C7 «Enviar los estados financieros auditados 2025 firmados»: Carla → Pablo, mié 25 nov 10:00, **Abierto**. A las 10:00 pasa a **Atrasado** y C2 queda **En riesgo** por esa causa. |
| CC9 | Proyectos: **TransLog** (C2, C4, C6, C7) y **Navidad** (C1, C3, C5). Cadenas: Ana (Compras) → Valeria (TI) → Luis (Legal) → Carla (Finanzas) → Pablo (Finanzas); Valeria (TI) → Sergio (Marketing) → Carla (Finanzas). Cuello de botella: Carla, en las dos cadenas. |
| CC10 | Unión: los mensajes internos aparecen en 2 o más buzones y cuentan una sola vez. En Gmail cada copia tiene otro `id` y otro `threadId`, y el hilo se une igual por `In-Reply-To`/`References`. |
| CC11 | Privacidad: 2 personales y 2 boletines descartados (aunque el correo personal y un boletín contienen «¿puedes…?»); el cumpleaños no produce compromisos; ninguna vista muestra asunto ni remitente de lo descartado; el borrador de Roberto no se lee. |
| CC12 | Correcciones: Carla corrige el plazo de C1 al 27 nov → C1 deja de estar atrasado y C5 deja de estar en riesgo; Luis descarta C3 → desaparece de todas las vistas y los demás códigos no cambian; Pablo confirma C7 → «Confirmado por Pablo Rojas». Solo quien pidió o quien responde puede corregir. |
| CC13 | Gmail y Outlook: los mismos correos en formato Gmail y en formato Graph dan los mismos compromisos, cadenas, cuellos de botella y conteos. |
| CC14 | Cuentas: una cuenta `@gmail.com` o de otro dominio se rechaza al conectar. |

## 10. Interfaz del prototipo

Una pantalla nueva, **Correo** (`/correo`), con su propio «ver como» para las personas de Grupo Altavista (`?como=<id>`), porque no comparten personas con Frío del Valle:

1. **Te piden**: compromisos donde eres responsable.
2. **Pediste y esperas**: compromisos que pediste.
3. **Quién espera a quién**: por proyecto, las cadenas entre departamentos y el cuello de botella.
4. **Buzones conectados**: lo que Nexo leyó, usó y descartó por persona, y qué correo tiene conectado (Gmail u Outlook).

Cada compromiso muestra título, estado, marcas, quién pidió y quién responde (con su departamento), plazo, a quién espera, insistencias, la evidencia citada y su revisión (propuesto, confirmado o corregido). Quien pidió o quien responde puede **confirmar**, **corregir** (título, responsable, plazo, estado) o **descartar**.

## 11. Fuera del prototipo (siguientes etapas)

1. **Conexión real con Gmail:** ver §13.
1. **Conexión real con Outlook:** aplicación registrada en Microsoft Entra (multiinquilino), permiso delegado `Mail.Read` con `offline_access`, consentimiento del administrador de TI del cliente, notificaciones de cambio y consulta delta. Para probar: cuenta de desarrollador de Microsoft 365.
2. **Extracción con Claude** con esquema zod y validación, como `ia/claude/`; el intérprete local queda de respaldo.
3. **Persistir hechos** extraídos (hoy se recalculan) con su retención y borrado.
4. **Unir con el motor actual:** seguimiento, recordatorio y escalamiento (R1–R3) y decisiones con costo sobre los compromisos de correo.
5. **Salida por correo:** resumen diario por persona y avisos de cadena («Legal espera tu garantía»).
6. **WhatsApp** con la misma interfaz de fuente.
7. Cuentas reales en lugar de «ver como».

## 12. Preguntas abiertas

1. ¿Quién decide qué dominios externos son laborales: TI del cliente al conectar, o Nexo los aprende?
2. ¿Los compromisos de un hilo privado (por ejemplo, Recursos Humanos) se muestran a terceros? Propuesta: solo a quienes participan en el hilo y a su cadena de jefes.
3. ¿El resumen diario sale desde una cuenta de Nexo o desde el buzón de cada persona?
4. ¿Las correcciones de una persona aplican para todos, o cada lado (solicitante y responsable) puede tener su versión?

## 13. Gmail (Google Workspace) primero

**Decisión (21-11-2026):** la primera conexión real es con Gmail, porque es el camino más rápido para leer correo real en un piloto. Outlook queda como segunda fuente, con el mismo modelo.

### Qué cuentas

Solo cuentas de **Google Workspace** del dominio de la empresa cliente. Las cuentas personales `@gmail.com` se rechazan: mezclan lo personal y lo laboral, y la premisa de privacidad no se sostiene ahí.

### Correspondencia con el mensaje normalizado

| `MensajeCorreo` | API de Gmail (`format=full`) |
|---|---|
| `idEnBuzon` | `id` (distinto en cada buzón) |
| `hiloEnBuzon` | `threadId` (distinto en cada buzón) |
| `idInternet` | encabezado `Message-ID` |
| `respondeA` | encabezados `In-Reply-To` y `References` |
| `asunto`, `de`, `para`, `cc` | encabezados `Subject`, `From`, `To`, `Cc`, decodificados (RFC 2047) |
| `enviado` | `internalDate` (milisegundos) |
| `texto` | parte `text/plain` en base64url; si no hay, `text/html` limpio; sin adjuntos y sin historial citado |
| `enlace` | `https://mail.google.com/mail/u/?authuser=<cuenta>#all/<id>` (a validar con cuentas reales) |
| `automatico` | `List-Unsubscribe` o etiqueta `CATEGORY_PROMOTIONS`, `CATEGORY_SOCIAL` o `CATEGORY_FORUMS` |
| (no se lee) | etiquetas `DRAFT`, `SPAM`, `TRASH` |

En el prototipo esto vive en `src/correo/fuentes/gmail.ts`, con las piezas comunes en `src/correo/fuentes/comun.ts`. Los buzones de ejemplo en formato Gmail salen de `construirBuzonesGmail()` en `src/correo/ejemplo/buzones.ts`.

### Lectura en producción

1. **Primero solo encabezados** (`format=metadata`) para clasificar. **Después el cuerpo** (`format=full`) solo de lo laboral.
2. **Sincronización:**
   - Al conectar se hace una lectura inicial de los últimos 30 días, a definir.
   - Después, `users.watch` sobre un tema de Pub/Sub; hay que renovarlo antes de 7 días, idealmente cada día.
   - Con cada aviso se llama a `users.history.list` desde el último `historyId`. Si Google responde que ese `historyId` ya no existe, se vuelve a hacer la lectura inicial.
3. **Tokens:** el `refresh_token` de cada persona se guarda cifrado. Nexo no guarda cuerpos de correo, solo lo extraído (§2).

### Permisos de Google y camino para salir

El permiso para leer el contenido es `https://www.googleapis.com/auth/gmail.readonly`. Google lo clasifica como **restringido**.

| Etapa | Qué pide Google | Para qué alcanza |
|---|---|---|
| Pruebas | Pantalla de consentimiento «Externa» en modo de prueba, hasta 100 usuarios de prueba agregados a mano; aviso de «app no verificada»; hay que volver a autorizar cada 7 días | Piloto con 2–3 empresas |
| Producción abierta | Verificación de la app por Google y evaluación de seguridad anual de un tercero (CASA) por usar un permiso restringido; tiene costo y toma semanas | Venta abierta |
| Por empresa | El administrador de Google Workspace del cliente autoriza a Nexo para todo su dominio (delegación en todo el dominio o instalación desde Marketplace). Si esto evita o no la verificación, está por confirmar con Google | Conectar a toda una empresa sin que cada persona dé su permiso |

**Para arrancar:**
- un proyecto en Google Cloud con la API de Gmail activada;
- un cliente OAuth web con redirección a `/api/auth/google/callback`;
- una cuenta de Google Workspace de prueba con 3–7 usuarios para recrear a Grupo Altavista con correo real.

Las claves van en `.env.local`, que nunca se sube.

### Preguntas abiertas de Gmail

1. ¿El piloto conecta persona por persona (OAuth) o a toda la empresa con su administrador?
2. ¿Cuántos días hacia atrás se leen al conectar?
3. ¿Se presupuesta ya la evaluación de seguridad (CASA) para salir del modo de prueba?
