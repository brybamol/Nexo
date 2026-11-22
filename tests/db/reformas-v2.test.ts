// Reformas v2 (docs/08 §2 y §4, tarea R2): puesta al día de una base anterior, persistencia de los efectos nuevos,
// trabajos descartados e instantánea visible (los propuestos no aparecen en las vistas generales).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq, sql } from 'drizzle-orm';
import { DDL_CREAR } from '@/db/ddl';
import { crearConexion } from '@/db/conexion';
import { buzones, dependencias, eventos, evidencias, mensajesLeidos, seguimientos, trabajos } from '@/db/esquema';
import {
  cargarBuzones,
  cargarClavesLeidas,
  cargarInstantanea,
  cargarInstantaneaVisible,
  cargarMensajesLeidos,
  cargarRevisiones,
  claveLeido,
  persistirEfectos,
} from '@/db/instantanea';
import { cargarSemilla } from '@/db/semilla/cargar';
import { enCR } from '@/dominio/tiempo';
import type { EvidenciaNueva, RevisionNueva, Seguimiento, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { siguienteIdTrabajo, siguienteIdTrabajoCorreo, siguienteNumeroTrabajo } from '@/motor/instantanea';
import { cargarVistasTrabajos, listarTrabajos, obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { listarProyectos } from '@/servicios/proyectos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const AHORA = enCR(MIE, '07:05');

/** M01 de docs/08 §5.2 (H3): propuesto, dueño Ricardo, PEDIDOS-13, entregado por Diego. */
function m01(extra: Partial<Trabajo> = {}): Trabajo {
  return {
    id: 'M01',
    proyectoId: 'P4',
    numero: 13,
    titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
    responsableId: 'diego-rojas',
    solicitadoPorId: 'ricardo-brenes',
    plazo: enCR('2026-11-27', '17:00'),
    estado: 'abierto',
    urgente: false,
    conCostoProbable: false,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: null,
    cantidadRepuesto: null,
    etiqueta: null,
    relacionados: [],
    origen: 'correo',
    capturaId: null,
    decisionId: null,
    creadoEn: AHORA,
    resueltoEn: null,
    confirmacion: 'propuesto',
    duenoPropuestaId: 'ricardo-brenes',
    confirmadoPorId: null,
    entrega: null,
    ...extra,
  };
}

function pedidoM01(extra: Partial<EvidenciaNueva> = {}): EvidenciaNueva {
  return {
    trabajoId: 'M01',
    tipo: 'pedido',
    fuente: 'correo',
    compromisoClave: 'c-h3-m1',
    mensajeId: '<h3-m1@friodelvalle.cr>',
    buzones: ['ricardo-brenes'],
    enlaces: { 'ricardo-brenes': 'https://mail.google.com/mail/u/0/#all/18aa' },
    autorId: 'ricardo-brenes',
    en: enCR('2026-11-23', '15:00'),
    cita: 'Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042?',
    ...extra,
  };
}

function seguimientoPropuesta(): Seguimiento {
  return {
    id: 'S1',
    trabajoId: 'M01',
    plazoReferencia: AHORA,
    nivel: 0,
    destinatarioId: 'ricardo-brenes',
    urgente: false,
    proximoEn: enCR(MIE, '11:05'),
    estado: 'pendiente',
    iniciadoEn: AHORA,
    escaladosA: [],
    tipo: 'propuesta',
  };
}

/** M01 propuesto con su evidencia, su seguimiento de propuesta y una dependencia de T29 (para ver qué se oculta). */
function efectosM01(): Efecto[] {
  return [
    { tipo: 'crear_trabajo', trabajo: m01(), necesidades: [], actorId: null },
    { tipo: 'agregar_evidencia', evidencia: pedidoM01() },
    { tipo: 'crear_seguimiento', seguimiento: seguimientoPropuesta() },
    { tipo: 'crear_dependencia', dependencia: { trabajoId: 'M01', dependeDeId: 'T29' }, actorId: null },
  ];
}

describe('base creada con el esquema anterior a las reformas v2', () => {
  it('DDL_CREAR añade columnas y tablas, todo lo anterior queda confirmado y de estado, sin buzones y sin perder datos', async () => {
    const c = await crearConexion({ tipo: 'pglite', dir: null });
    try {
      await cargarSemilla(c.db);
      await c.db.insert(seguimientos).values({
        id: 'S9',
        trabajoId: 'T15',
        plazoReferencia: AHORA,
        nivel: 1,
        destinatarioId: 'lucia-mora',
        proximoEn: AHORA,
        estado: 'pendiente',
        iniciadoEn: AHORA,
        escaladosA: ['andres-vargas'],
      });
      // Así quedaba una base de antes: sin las columnas ni las tablas nuevas.
      await c.ejecutarSql(`
        DROP TABLE buzones; DROP TABLE evidencias; DROP TABLE mensajes_leidos; DROP TABLE revisiones;
        ALTER TABLE trabajos DROP COLUMN confirmacion; ALTER TABLE trabajos DROP COLUMN dueno_propuesta_id;
        ALTER TABLE trabajos DROP COLUMN confirmado_por_id; ALTER TABLE trabajos DROP COLUMN entrega;
        ALTER TABLE seguimientos DROP COLUMN tipo;`);
      const columnas = async (tabla: string) =>
        ((await c.db.execute(sql`select column_name from information_schema.columns where table_name = ${tabla}`)) as { rows: { column_name: string }[] }).rows.map(
          (f) => f.column_name,
        );
      expect(await columnas('trabajos')).not.toContain('confirmacion');

      await c.ejecutarSql(DDL_CREAR);

      expect(await columnas('trabajos')).toEqual(expect.arrayContaining(['confirmacion', 'dueno_propuesta_id', 'confirmado_por_id', 'entrega']));
      expect(await columnas('seguimientos')).toContain('tipo');
      const inst = await cargarInstantanea(c.db);
      expect(inst.trabajos).toHaveLength(30);
      expect(inst.trabajos.every((t) => t.confirmacion === 'confirmado' && t.duenoPropuestaId === null && t.entrega === null)).toBe(true);
      expect(inst.seguimientos).toEqual([expect.objectContaining({ id: 'S9', nivel: 1, escaladosA: ['andres-vargas'], tipo: 'estado' })]);
      expect(inst.evidencias).toEqual([]);
      expect(inst.descartados).toEqual([]);
      expect(await cargarBuzones(c.db)).toEqual([]); // «Ningún buzón conectado: reinicia la demo»
      expect(await cargarMensajesLeidos(c.db)).toEqual([]);
      expect(await cargarRevisiones(c.db)).toEqual([]);

      // Las tablas nuevas funcionan y repetir el DDL no cambia nada.
      await persistirEfectos(c.db, efectosM01());
      await c.ejecutarSql(DDL_CREAR);
      const otra = await cargarInstantanea(c.db);
      expect(otra.trabajos).toHaveLength(31);
      expect(otra.evidencias).toHaveLength(1);
    } finally {
      await c.cerrar();
    }
  });
});

describe('persistencia de los efectos nuevos', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  it('un trabajo del correo propuesto con entrega se guarda y se relee igual (entrega con fechas como Date)', async () => {
    const entrega = { en: enCR('2026-11-24', '16:30'), porId: 'diego-rojas', nota: 'Te adjunto las guías firmadas', enlace: null, fuente: 'correo' as const };
    await persistirEfectos(demo.ctx.db, [{ tipo: 'crear_trabajo', trabajo: m01({ entrega }), necesidades: [], actorId: null }]);
    const t = (await cargarInstantanea(demo.ctx.db)).trabajos.find((x) => x.id === 'M01');
    expect(t).toEqual(m01({ entrega }));
    expect(t?.entrega?.en).toBeInstanceOf(Date);
  });

  it('actualizar_trabajo cambia confirmación, confirmado_por, entrega, título, proyecto y número', async () => {
    const db = demo.ctx.db;
    await persistirEfectos(db, [{ tipo: 'crear_trabajo', trabajo: m01(), necesidades: [], actorId: null }]);
    const entrega = { en: AHORA, porId: 'diego-rojas', nota: null, enlace: 'https://drive.example/guias', fuente: 'interfaz' as const };
    await persistirEfectos(db, [
      {
        tipo: 'actualizar_trabajo',
        trabajoId: 'M01',
        cambios: { confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes', entrega, titulo: 'Guías 1041 y 1042', proyectoId: 'OD', numero: 1 },
        actorId: 'ricardo-brenes',
      },
    ]);
    expect((await cargarInstantanea(db)).trabajos.find((x) => x.id === 'M01')).toMatchObject({
      confirmacion: 'confirmado',
      confirmadoPorId: 'ricardo-brenes',
      entrega,
      titulo: 'Guías 1041 y 1042',
      proyectoId: 'OD',
      numero: 1,
    });
    await persistirEfectos(db, [{ tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { entrega: null }, actorId: 'ricardo-brenes' }]);
    expect((await cargarInstantanea(db)).trabajos.find((x) => x.id === 'M01')?.entrega).toBeNull();
  });

  it('crear_dependencia y agregar_evidencia derivan sus eventos; actualizar_evidencia usa el id provisional del mismo lote', async () => {
    const db = demo.ctx.db;
    await persistirEfectos(db, [
      ...efectosM01(),
      { tipo: 'agregar_evidencia', evidencia: pedidoM01({ tipo: 'entrega', fuente: 'interfaz', autorId: 'diego-rojas', compromisoClave: null, mensajeId: null, buzones: [], enlaces: {} }) },
      // Provisional 1 = la primera evidencia del lote (la base estaba vacía).
      { tipo: 'actualizar_evidencia', evidenciaId: 1, cambios: { buzones: ['ricardo-brenes', 'diego-rojas'] } },
    ]);
    const inst = await cargarInstantanea(db);
    expect(inst.evidencias.map((e) => [e.tipo, e.buzones])).toEqual([
      ['pedido', ['ricardo-brenes', 'diego-rojas']],
      ['entrega', []],
    ]);
    expect(inst.evidencias[0]?.en).toEqual(enCR('2026-11-23', '15:00'));
    expect(inst.dependencias).toContainEqual({ trabajoId: 'M01', dependeDeId: 'T29' });
    const evs = await db.select().from(eventos).where(eq(eventos.trabajoId, 'M01')).orderBy(asc(eventos.id));
    expect(evs.map((e) => [e.tipo, e.actorId])).toEqual([
      ['trabajo_creado', null],
      ['evidencia_agregada', null], // del correo: la agrega Nexo
      ['dependencia_creada', null],
      ['evidencia_agregada', 'diego-rojas'], // de la interfaz: actor = autor
    ]);
    expect(evs[2]?.datos).toEqual({ dependeDeId: 'T29' });
  });

  it('el id provisional de evidencia sigue a las ya guardadas aunque la secuencia de la base haya saltado', async () => {
    const db = demo.ctx.db;
    await persistirEfectos(db, efectosM01());
    // Un lote que falla consume valores de la secuencia sin dejar filas.
    await expect(
      db.transaction(async (tx) => {
        await persistirEfectos(tx, [
          { tipo: 'agregar_evidencia', evidencia: pedidoM01() },
          { tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'resuelto' }, actorId: null },
        ]);
      }),
    ).rejects.toThrow();
    const antes = await cargarInstantanea(db);
    const lote: Efecto[] = [
      { tipo: 'agregar_evidencia', evidencia: pedidoM01({ cita: 'nueva' }) },
      { tipo: 'actualizar_evidencia', evidenciaId: 2, cambios: { enlaces: { 'diego-rojas': 'https://x' } } }, // provisional: 1 + 1
    ];
    expect(aplicarEnMemoria(antes, lote).evidencias.at(-1)).toMatchObject({ id: 2, cita: 'nueva', enlaces: { 'diego-rojas': 'https://x' } });
    await persistirEfectos(db, lote);
    const filas = await db.select().from(evidencias).orderBy(asc(evidencias.id));
    expect(filas).toHaveLength(2);
    expect(filas[1]).toMatchObject({ cita: 'nueva', enlaces: { 'diego-rojas': 'https://x' } });
    expect(filas[1]!.id).toBeGreaterThan(2); // el real no coincide con el provisional, y aun así se actualizó
  });

  it('registrar_mensajes y registrar_revision guardan y se releen con fechas como Date', async () => {
    const db = demo.ctx.db;
    await persistirEfectos(db, [{ tipo: 'crear_trabajo', trabajo: m01(), necesidades: [], actorId: null }]);
    const revision: RevisionNueva = {
      en: AHORA,
      personaId: 'esteban-castro',
      origen: 'correo',
      trabajoId: 'M01',
      capturaId: null,
      resultado: 'corregida',
      campos: ['plazo'],
      propuesto: { titulo: 'Fotos', responsableId: 'daniela-quesada', plazo: enCR('2026-11-27', '17:00'), proyectoId: 'P2' },
      final: { titulo: 'Fotos', responsableId: 'daniela-quesada', plazo: enCR('2026-11-26', '17:00'), proyectoId: 'P2' },
      entrada: { asunto: 'Fotos mantenimiento', cita: '¿puedes enviarme las fotos…?', deId: 'esteban-castro', paraIds: ['daniela-quesada'], enviado: enCR('2026-11-24', '17:00') },
      motivo: null,
    };
    const captura: RevisionNueva = {
      ...revision,
      origen: 'captura',
      trabajoId: null,
      capturaId: 7,
      resultado: 'descartada',
      campos: [],
      final: null,
      entrada: { texto: 'Alguien tiene que revisar el camión' },
      motivo: 'No era trabajo',
    };
    await persistirEfectos(db, [
      {
        tipo: 'registrar_mensajes',
        mensajes: [
          { personaId: 'ricardo-brenes', idInternet: '<h3-m1@friodelvalle.cr>', enviado: enCR('2026-11-23', '15:00'), leidoEn: AHORA, clase: 'laboral', resultado: 'propuso', trabajoIds: ['M01'] },
          { personaId: 'karla-jimenez', idInternet: '<r-personal-karla@banco-personal.com>', enviado: enCR('2026-11-24', '06:00'), leidoEn: AHORA, clase: 'personal', resultado: 'descartado', trabajoIds: [] },
        ],
      },
      { tipo: 'registrar_revision', revision },
      { tipo: 'registrar_revision', revision: captura },
    ]);
    const leidos = await cargarMensajesLeidos(db);
    expect(leidos.map((m) => [m.personaId, m.resultado])).toEqual([
      ['ricardo-brenes', 'propuso'],
      ['karla-jimenez', 'descartado'],
    ]);
    expect(await cargarClavesLeidas(db)).toEqual(new Set([claveLeido('ricardo-brenes', '<h3-m1@friodelvalle.cr>'), 'karla-jimenez|<r-personal-karla@banco-personal.com>']));
    const revs = await cargarRevisiones(db);
    expect(revs).toEqual([
      { ...revision, id: revs[0]!.id },
      { ...captura, id: revs[1]!.id },
    ]);
    // Una copia ya leída no se vuelve a registrar: es un error (Nexo nunca lee dos veces).
    await expect(
      persistirEfectos(db, [{ tipo: 'registrar_mensajes', mensajes: [leidos[0]!] }]),
    ).rejects.toThrow();
    expect(await db.select().from(mensajesLeidos)).toHaveLength(2);
  });

  it('descartar: sale de trabajos (con sus dependencias y seguimientos), su número sigue ocupado y sus evidencias quedan', async () => {
    const db = demo.ctx.db;
    await persistirEfectos(db, efectosM01());
    const antes = await cargarInstantanea(db);
    const descartar: Efecto[] = [{ tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'descartado' }, actorId: 'ricardo-brenes' }];
    await persistirEfectos(db, descartar);
    const inst = await cargarInstantanea(db);
    expect(inst.trabajos.map((t) => t.id)).not.toContain('M01');
    expect(inst.trabajos).toHaveLength(30);
    expect(inst.descartados).toEqual([{ id: 'M01', proyectoId: 'P4', numero: 13 }]);
    expect(inst.dependencias.some((d) => d.trabajoId === 'M01' || d.dependeDeId === 'M01')).toBe(false);
    expect(inst.seguimientos).toEqual([]);
    expect(inst.evidencias.map((e) => e.trabajoId)).toEqual(['M01']);
    // Las filas siguen en la base: solo no se cargan.
    expect(await db.select().from(dependencias).where(eq(dependencias.trabajoId, 'M01'))).toHaveLength(1);
    expect(await db.select().from(trabajos).where(eq(trabajos.id, 'M01'))).toHaveLength(1);
    // Número e id ocupados: el siguiente de P4 es el 14 y el siguiente del correo es M02.
    expect(siguienteNumeroTrabajo(inst, 'P4')).toBe(14);
    expect(siguienteIdTrabajoCorreo(inst)).toBe('M02');
    expect(siguienteIdTrabajo(inst)).toBe('T31');
    // Coherente con aplicarEnMemoria.
    const enMemoria = aplicarEnMemoria(antes, descartar);
    expect(enMemoria.trabajos).toEqual(inst.trabajos);
    expect(enMemoria.descartados).toEqual(inst.descartados);
    expect(enMemoria.dependencias).toEqual(inst.dependencias);
    expect(enMemoria.seguimientos).toEqual(inst.seguimientos);
    expect(enMemoria.evidencias).toEqual(inst.evidencias);
  });

  it('coherencia con aplicarEnMemoria para los efectos nuevos', async () => {
    const db = demo.ctx.db;
    const antes = await cargarInstantanea(db);
    const efectos: Efecto[] = [
      ...efectosM01(),
      { tipo: 'actualizar_evidencia', evidenciaId: 1, cambios: { enlaces: { 'ricardo-brenes': 'https://otro' } } },
      { tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes' }, actorId: 'ricardo-brenes' },
      { tipo: 'actualizar_seguimiento', seguimientoId: 'S1', cambios: { estado: 'respondido' } },
    ];
    await persistirEfectos(db, efectos);
    const recargada = await cargarInstantanea(db);
    const enMemoria = aplicarEnMemoria(antes, efectos);
    const ordenar = <T>(xs: T[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    // cargarInstantanea ordena por id natural (M01 antes que T01); aplicarEnMemoria añade al final.
    expect(ordenar(recargada.trabajos)).toEqual(ordenar(enMemoria.trabajos));
    expect(recargada.seguimientos).toEqual(enMemoria.seguimientos);
    expect(recargada.evidencias).toEqual(enMemoria.evidencias);
    expect(ordenar(recargada.dependencias)).toEqual(ordenar(enMemoria.dependencias));
  });
});

describe('instantánea visible (regla 18)', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
    await persistirEfectos(demo.ctx.db, efectosM01());
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  it('la vista general no tiene el propuesto ni lo que cuelga de él; su dueño sí lo ve; otra persona no', async () => {
    const db = demo.ctx.db;
    const general = await cargarInstantaneaVisible(db, null);
    expect(general.trabajos).toHaveLength(30);
    expect(general.trabajos.some((t) => t.id === 'M01')).toBe(false);
    expect(general.seguimientos).toEqual([]);
    expect(general.evidencias).toEqual([]);
    expect(general.dependencias.some((d) => d.trabajoId === 'M01')).toBe(false);
    expect(general.dependencias).toHaveLength(19); // las de la semilla siguen

    const ricardo = await cargarInstantaneaVisible(db, 'ricardo-brenes');
    expect(ricardo.trabajos).toHaveLength(31);
    expect(ricardo.evidencias).toHaveLength(1);
    expect(ricardo.seguimientos.map((s) => s.tipo)).toEqual(['propuesta']);

    // Diego es el responsable, pero la propuesta es de Ricardo: no la ve hasta que se confirme.
    const diego = await cargarInstantaneaVisible(db, 'diego-rojas');
    expect(diego.trabajos.some((t) => t.id === 'M01')).toBe(false);
  });

  it('listados, detalle y proyectos usan la visible: el propuesto no aparece; con verComo del dueño, sí', async () => {
    const { ctx } = demo;
    expect(await listarTrabajos(ctx)).toHaveLength(30);
    expect(await obtenerTrabajo(ctx, 'M01')).toBeNull();
    expect(await obtenerTrabajo(ctx, 'M01', 'diego-rojas')).toBeNull();
    const vista = await obtenerTrabajo(ctx, 'M01', 'ricardo-brenes');
    expect(vista).toMatchObject({
      referencia: 'PEDIDOS-13',
      origen: 'correo',
      confirmacion: 'propuesto',
      dueno: { id: 'ricardo-brenes', nombre: 'Ricardo Brenes' },
      confirmadoPor: null,
      entrega: null,
    });
    expect(await listarTrabajos(ctx, { verComo: 'ricardo-brenes' })).toHaveLength(31);
    const p4 = (await listarProyectos(ctx)).find((p) => p.id === 'P4');
    expect(p4?.total).toBe(12);
    const { inst } = await cargarVistasTrabajos(ctx.db);
    expect(inst.trabajos).toHaveLength(30);
  });

  it('al confirmarse, lo ven todos', async () => {
    const { ctx } = demo;
    await persistirEfectos(ctx.db, [
      { tipo: 'actualizar_trabajo', trabajoId: 'M01', cambios: { confirmacion: 'confirmado', confirmadoPorId: 'ricardo-brenes' }, actorId: 'ricardo-brenes' },
    ]);
    expect(await listarTrabajos(ctx)).toHaveLength(31);
    expect((await obtenerTrabajo(ctx, 'M01', 'diego-rojas'))?.confirmadoPor?.id).toBe('ricardo-brenes');
  });
});

describe('prepararDemo y los buzones', () => {
  it('por defecto sin buzones conectados (las pruebas existentes no leen correo); con correo: true, los 8 de la demo', async () => {
    const sin = await prepararDemo();
    const con = await prepararDemo({ correo: true });
    try {
      expect(await sin.ctx.db.select().from(buzones)).toHaveLength(0);
      const conectados = await cargarBuzones(con.ctx.db);
      expect(conectados).toHaveLength(8);
      expect(conectados.map((b) => b.personaId)).not.toContain('diego-rojas');
      expect(conectados[0]).toEqual({
        personaId: 'marcela-solis',
        direccion: 'marcela.solis@friodelvalle.cr',
        proveedor: 'gmail',
        conectadoEn: enCR('2026-11-23', '07:00'),
      });
    } finally {
      await sin.cerrar();
      await con.cerrar();
    }
  });
});
