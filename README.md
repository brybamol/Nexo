# Nexo

## Qué es Nexo

Nexo es una plataforma web donde viven los trabajos y proyectos de una empresa, y que hace ella misma la coordinación. Convierte una frase en un trabajo con responsable y plazo, pide el estado cuando vence el plazo, avisa a quien está afectado, escala si nadie responde y prepara las decisiones con costo. Las personas hacen el trabajo y deciden; nadie hace de mensajero.

El escalamiento sigue al trabajo, no al organigrama. Si el responsable no responde, Nexo acude al responsable del proyecto, que puede reasignar el trabajo, mover el plazo o declararlo bloqueado desde la interfaz. Si tampoco actúa, acude a los responsables de los otros proyectos perjudicados y, si no hay ninguno, al responsable de la operación. El responsable del proyecto decide los gastos de hasta ₡100.000; por encima decide la gerente general, y nadie aprueba su propia propuesta.

Lo que hace hoy la aplicación:

- **El correo alimenta al motor.** Nexo lee los buzones conectados cuando avanza el reloj de la demo (sin red: son buzones de ejemplo) y convierte cada pedido que encuentra en un trabajo, con su responsable, su plazo y la cita del correo como evidencia. Un pedido igual a un trabajo que ya existe no se duplica: solo suma su evidencia. Si una espera del correo coincide con otro trabajo, nace una dependencia o un bloqueo. Lo personal y los boletines se descartan sin guardar su contenido, y un pedido sin plazo no se convierte en trabajo: la pantalla Correo pregunta «¿Para cuándo?».
- **Lo que Nexo infiere es una propuesta.** Si solo uno de los dos buzones lo vio, el trabajo nace «propuesto»: solo su dueño lo ve, no avisa a nadie y espera a que lo **Confirme**, lo **Corrija** o lo **Descarte**. Si lo vieron los buzones de las dos partes, queda confirmado por dos fuentes.
- **Resuelto exige evidencia.** Si otra persona pidió el trabajo, el responsable lo declara **entregado** (con una nota o un enlace) y quien lo pidió confirma que lo recibió; solo entonces queda Resuelto. Si no confirma, Nexo se lo recuerda, pero no escala.
- **Cuánto se equivoca Nexo.** Cada revisión de una propuesta se guarda con lo propuesto y lo final, y de ahí sale la tasa de corrección, que se ve en Correo, Registro y Proyectos.
- **Quién espera a quién.** Con los trabajos visibles para quien mira, la pantalla Correo muestra las cadenas de espera entre departamentos y el cuello de botella si lo hay.
- **Proyectos como recorrido.** Cada proyecto se lee como una secuencia de etapas: qué ya se hizo, qué frena y qué viene.
- **Nombres con título y referencia.** Las personas nunca ven ids internos ni números de regla: ven el título de cada cosa y una referencia como COLINA-5.

La prueba que la distingue de un gestor de proyectos (Asana, Monday, Notion): si un jefe todavía tiene que abrir la herramienta, leer el estado y perseguir a alguien, es un gestor de proyectos. Si la plataforma persigue, avisa y escala, y el jefe solo decide, es lo que Nexo busca ser.

## Estado

Es un MVP de hackathon. Funciona en local con datos de ejemplo de una empresa ficticia: una distribuidora de Costa Rica con áreas de oficina, bodega y campo. Todavía no tiene autenticación (un selector «ver como» elige la persona) ni despliegue en internet. Los buzones de correo son de ejemplo (8 de las 12 personas de Frío del Valle los tienen conectados) y no hay conexión con Gmail ni con Outlook.

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

### Si ya tenías una base de una versión anterior

Las versiones anteriores no guardaban la clave de cada proyecto ni el número de cada trabajo (ver «Cómo se nombran los trabajos»). Al arrancar, Nexo añade esas columnas a la base de `.data/` y las rellena solo: los trabajos se numeran por proyecto en el orden de su id y las decisiones por fecha. No se borra nada, salvo la tabla `correcciones_correo` del modelo de correo anterior, que se elimina: la base queda con 20 tablas. Una base anterior queda sin buzones conectados y la pantalla Correo lo dice («Ningún buzón conectado: reinicia la demo»). Los avisos y el registro que ya estaban guardados conservan su texto viejo, con códigos como «T04»; para ver la demo con los textos nuevos, pulsa **Reiniciar demo** en la aplicación o, con `pnpm dev` parado, ejecuta `pnpm db:reset`.

## Cómo se nombran los trabajos

Un número suelto no dice nada cuando hay miles de trabajos. Por eso, ante las personas:

- **Un trabajo se nombra por su título** y lleva, pequeña al lado, una **referencia** con la clave de su proyecto y un número propio de ese proyecto: «Cableado y tablero de control» **COLINA-5**. La referencia sirve para citar un trabajo de palabra o escribirlo en la captura: «sigo con COLINA-4» se entiende como el trabajo COLINA-4.
- **Una decisión** se nombra por lo que decide, «Compra de 3 compresores de 2 HP», con la referencia de su proyecto y una «D»: **COLINA-D1**.
- **Un trabajo leído del correo** es un trabajo más y se nombra igual: «Enviar las guías de entrega firmadas de los pedidos 1041 y 1042» **PEDIDOS-13**.
- Claves de los proyectos de Frío del Valle: **COLINA** (Cámara fría La Colina), **TRIGAL** (Mantenimiento Trigal), **REPUESTOS** (Repuestos críticos), **PEDIDOS** (Pedidos de la semana) y **DIARIA** (Operación diaria).

Los ids `T04`, `D01` o `M01` (los trabajos que nacen del correo) son de la especificación (`docs/03`, `docs/04`, `docs/08`) y del código: claves de la base, rutas (`/trabajos/T04`) y pruebas. Nexo no los muestra nunca. La equivalencia de los 30 trabajos de ejemplo está en `docs/04-empresa-y-casos-de-control.md`.

## Cómo recorrer la demo

La demo es el guion de cuatro minutos del plan (`docs/02-plan-mvp-hackathon.md`), ampliado con el correo y la entrega (`docs/08-reformas-v2.md` §7). Sigue estos pasos en orden. La hora aparece en la barra superior, junto a los botones del reloj, y «ver como» está en el mismo panel.

0. Pulsa **Reiniciar demo** y acepta la confirmación. El reloj queda en mié 25 nov, 7:00, con 8 buzones conectados.
1. Pulsa **+5 min**. El reloj queda en 7:05. Nexo lee el correo (23 copias de mensajes en 8 buzones) y pide el estado de dos trabajos atrasados.
2. En el selector **ver como**, elige a **José Alfaro**. En la caja de captura escribe «No puedo terminar la instalación en La Colina, falta el compresor de 2 HP» y envíala. Nexo responde «Creé «Conseguir compresor de 2 HP» (COLINA-8) para Lucía Mora…» y deja bloqueado «Instalar unidad condensadora y compresor» (COLINA-4).
3. Cambia a **Lucía Mora** y abre **Mi día**. Arriba está «Conseguir compresor de 2 HP», con su referencia COLINA-8.
4. Pulsa **Siguiente evento**: el reloj queda en 7:35 (recordatorio a Lucía). Pulsa **Siguiente evento** otra vez: 8:05, y Lucía no respondió, así que Nexo escala a **Esteban Castro**, responsable del proyecto La Colina (no al jefe de Lucía). Cambia a Esteban: en **Mi día** verás el trabajo en «Nexo te pide», con los botones **Reasignar**, **Mover el plazo** y **Declarar bloqueo**. No los uses en el recorrido: cambiarían el guion.
5. Cambia a **Mario Chaves** y abre **Mi día**. Un solo aviso con sus dos trabajos, de dos proyectos: «Cableado y tablero de control» (COLINA-5) y «Cambiar compresor en local Curridabat» (TRIGAL-4), con la causa «Conciliar el conteo con el sistema» (REPUESTOS-2).
6. Cambia a **Lucía Mora** y escribe en la caja de captura «No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local». Nexo prepara la decisión «Compra de 3 compresores de 2 HP» (COLINA-D1).
7. Cambia a **Marcela Solís** (gerente general), abre **Decisiones** y aprueba la opción A. Nexo crea «Comprar 3 compresores de 2 HP al proveedor local» (COLINA-9) para Karla.
8. Como Marcela, escribe en **Preguntar** «¿Cómo vamos con los pedidos de la semana?». Cada pedido se cita con su referencia, por ejemplo «Pedido 1043 · Minisúper Don Beto (PEDIDOS-3)».
9. Como Marcela, abre **Proyectos** y **Registro**. Las cifras en este punto son las del primer bloque de abajo.
10. Pulsa **Siguiente evento**: el reloj salta a las 8:20 y llega un correo (el próximo mensaje, antes que el siguiente evento del motor). Cambia a **Ricardo Brenes** y abre **Correo**: un trabajo nuevo, creado solo, «lo vieron los dos buzones», que depende de la cotización de Paola.
11. Como Ricardo, abre **Mi día**. En **Propuestas de Nexo** está la de las guías de entrega: pulsa **Confirmar**. Después, en **Por confirmar recibido**, pulsa **Sí, lo recibí**. El trabajo queda Resuelto y Nexo avisa a Diego.
12. Cambia a **Esteban Castro** y abre **Mi día**. En **Propuestas de Nexo**, pulsa **Corregir** en su propuesta y cambia el plazo al jue 26 nov, 17:00.
13. Cambia a **Marcela Solís** y abre **Registro** (cifras y tasa de corrección de abajo) y **Correo** (el cuello de botella es Lucía Mora).

> **Advertencias:** no pulses **Siguiente evento** después del paso 13: saltaría a las 10:00 y cambiaría las cifras. No uses **+30 min** antes del paso 10: el correo de las 8:20 se leería a otra hora. **Siguiente evento** primero procesa lo que ya venció a la hora actual, sin mover el reloj; si no hay nada vencido, salta al siguiente evento programado o al próximo correo. No lo pulses antes de la primera frase (paso 2).

Cifras esperadas en el paso 9 (el guion original):

- **6 de 8** trabajos cerrados sin intervención de la gerente (**75 %**).
- **19** seguimientos hechos por Nexo en lugar de una persona.
- **3,4 h** de coordinación ahorradas, marcadas como **estimado**. Es una hipótesis de minutos, no una medición.

Cifras esperadas al final (paso 13):

- **7 de 9** trabajos cerrados sin intervención de la gerente (**78 %**).
- **21** seguimientos.
- **3,8 h** de coordinación ahorradas (estimado).
- **Tasa de corrección: 50 %**: de 2 propuestas revisadas, 1 se confirmó tal cual y 1 se corrigió (plazo), y 1 más quedó confirmada por dos buzones sin revisión de una persona.

## La IA: con y sin clave

Nexo interpreta las frases de dos formas:

- **Sin clave (por defecto):** usa un intérprete local. Entiende bien las frases del guion y los casos de control de `docs/04-empresa-y-casos-de-control.md`. Con otras frases puede no entender o pedir una aclaración.
- **Con clave de la API de Claude:** copia `.env.example` como `.env.local` y escribe tu clave en `ANTHROPIC_API_KEY`. La captura usa `claude-haiku-5-5` y las preguntas usan `claude-opus-5-5`. Si Claude no responde a tiempo (15 segundos) o da un error, Nexo usa el intérprete local y lo indica.

La tarjeta de resultado de cada captura muestra quién respondió: «Respondió: Local», «Respondió: Claude · claude-haiku-5-5» o «Local (respaldo)».

**Aviso honesto:** la integración con Claude está probada solo con un cliente simulado. **No se ha verificado contra la API real.** La lectura del correo usa siempre un extractor local, afinado a los correos de ejemplo: no usa Claude.

El archivo `.env.local` contiene una clave privada. **Nunca lo subas al repositorio.**

## Comandos útiles

Estos son los scripts de `package.json`. Arranca la aplicación en `http://localhost:3000`:

```bash
pnpm dev
```

Compila la aplicación para producción:

```bash
pnpm build
```

Ejecuta todas las pruebas una vez (Vitest):

```bash
pnpm test
```

Ejecuta las pruebas y las vuelve a correr al cambiar archivos:

```bash
pnpm test:watch
```

Comprueba los tipos de TypeScript sin generar archivos:

```bash
pnpm typecheck
```

Revisa el código con ESLint:

```bash
pnpm lint
```

Ejecuta tipos, lint y pruebas en ese orden; es lo que comprueba GitHub:

```bash
pnpm verificar
```

Borra y recrea la base de datos con los datos de ejemplo desde la consola (detén `pnpm dev` antes; si la base está abierta, el comando lo avisa):

```bash
pnpm db:reset
```

Hay también `pnpm start`, que sirve la aplicación ya compilada con `pnpm build`.

## Cómo trabajar en equipo con GitHub

El repositorio `brybamol/Nexo` es privado. El dueño invita a cada colega en GitHub con **Settings → Collaborators → Add people**, y el colega acepta la invitación que le llega por correo.

Flujo para cada cambio:

1. Crea una rama propia:

   ```bash
   git switch -c nombre-de-la-rama
   ```

2. Haz tus cambios y guárdalos con commits.
3. Sube la rama:

   ```bash
   git push -u origin nombre-de-la-rama
   ```

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
| `src/servicios` | Casos de uso que llama la interfaz: captura, decisiones, Mi día, reloj, cifras, correo, propuestas, entregas, tasa de corrección y proyectos. |
| `src/correo` | Lectura del correo: buzones de ejemplo de Frío del Valle, adaptadores de Gmail y Outlook, filtro de privacidad, unión de buzones y extracción de hechos. Código puro. |
| `src/motor` | Reglas de coordinación: marcas, seguimiento, propagación, opciones y decisiones, y las de las reformas v2: confianza, propuestas, entregas, ingesta del correo, esperas, tasa y secuencia de proyectos. Es código puro, sin base de datos ni red. |
| `src/ia` | Intérpretes Local y Claude, y la validación de sus respuestas. |
| `src/db` | Esquema de la base (Drizzle), conexión (PGlite o PostgreSQL) y datos de ejemplo en `semilla/`. |
| `src/dominio` | Tipos, constantes, tiempo (hora de Costa Rica), formato, texto y nombres (`nombres.ts`: cómo se nombra y se referencia cada cosa ante las personas). |
| `src/servidor` | Contexto de la aplicación y persona actual. |
| `tests/` | Pruebas: captura, correo, escenarios de coordinación, motor, servicios, base de datos e integración del guion. |
| `scripts/` | `reiniciar-db.ts`, que usa el comando `pnpm db:reset`. |
| `.claude/agents/` | Agentes para trabajar el código con Claude Code. |
| `.github/workflows/` | Comprobación automática de cada cambio en GitHub. |

Documentos de `docs/`:

- `01-exploracion.md`: problema, evidencia, opciones con sus pros y contras, y cómo empezar.
- `02-plan-mvp-hackathon.md`: alcance del MVP, guion de la demo, pila técnica, etapas y riesgos.
- `03-etapa-0-definicion.md`: especificación, vocabulario, reglas de coordinación y guion detallado.
- `04-empresa-y-casos-de-control.md`: empresa ficticia, personas, trabajos y casos de control.
- `05-arquitectura-y-planes.md`: contrato técnico, con pila, esquema de datos, firmas, interfaz y planes por etapa.
- `06-giro-correo.md` y `07-brief-version-2.md`: el giro hacia el correo; su modelo de correo aparte quedó sustituido por `08`.
- `08-reformas-v2.md`: contrato de las reformas v2 (una sola empresa, un solo modelo, propuestas, tasa de corrección y entrega con evidencia). Amplía a `05` y, donde choquen, manda.
- `marca/`: identidad aprobada de la marca (la aplicación a la interfaz está en `DESIGN.md`).

## Limitaciones conocidas

- Los buzones son de ejemplo: no hay conexión real con Gmail ni con Outlook. Los adaptadores y la lectura se prueban con mensajes de muestra, y 8 de las 12 personas tienen buzón conectado.
- El intérprete es local por defecto y la lectura del correo usa un extractor local afinado a los correos de ejemplo: con otras frases o textos puede no entender.
- La integración con la API de Claude no está verificada contra la API real.
- No hace WhatsApp ni otros canales de entrada o aviso.
- No se integra con ERP, hojas de cálculo ni calendarios.
- No tiene cuentas ni permisos: el selector «ver como» simula a las personas.
- No tiene despliegue: corre solo en local.
- Solo maneja una empresa. El diseño está pensado para escritorio y proyector; en teléfono no se ha cuidado.
- No incluye diagramas de Gantt, informes ni gráficos de gestión.
- Los datos (personas, clientes, proveedores, precios, correos y cifras) son inventados.
- Un pedido del correo sin plazo no se convierte en trabajo (no se inventa uno): la pantalla Correo pregunta «¿Para cuándo?».
- Las preguntas respondidas no aparecen en el registro de acciones.
- Con Claude, una reprogramación de una entrega a un cliente se aplica sin pasar por una decisión (la regla está pendiente de definir).
- Las horas ahorradas son una estimación basada en minutos supuestos (10 por seguimiento y 15 por pregunta), no una medición.
