import path from 'node:path';
import { getTableName, sql } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DDL_BORRAR, DDL_CREAR } from '@/db/ddl';
import { crearConexion, modoDesdeEntorno, type Conexion } from '@/db/conexion';
import { esquema } from '@/db/esquema';

const tablas = Object.values(esquema) as PgTable[];

async function tablasEnBase(c: Conexion): Promise<string[]> {
  const r = await c.db.execute(
    sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  return ((r as { rows: { table_name: string }[] }).rows).map((f) => f.table_name);
}

describe('modoDesdeEntorno', () => {
  it('DATABASE_URL → pg', () => {
    expect(modoDesdeEntorno({ DATABASE_URL: 'postgres://u:p@h/db' })).toEqual({ tipo: 'pg', url: 'postgres://u:p@h/db' });
  });
  it('NEXO_DATA_DIR → pglite en ese directorio', () => {
    expect(modoDesdeEntorno({ NEXO_DATA_DIR: 'C:\\datos\\nexo' })).toEqual({ tipo: 'pglite', dir: 'C:\\datos\\nexo' });
  });
  it('por defecto → <cwd>/.data/pglite', () => {
    expect(modoDesdeEntorno({})).toEqual({ tipo: 'pglite', dir: path.join(process.cwd(), '.data', 'pglite') });
  });
  it('cadenas vacías se tratan como ausentes', () => {
    expect(modoDesdeEntorno({ DATABASE_URL: '', NEXO_DATA_DIR: '' })).toEqual({
      tipo: 'pglite',
      dir: path.join(process.cwd(), '.data', 'pglite'),
    });
  });
});

describe('DDL sobre PGlite en memoria', () => {
  let c: Conexion;
  beforeAll(async () => {
    c = await crearConexion({ tipo: 'pglite', dir: null });
  });
  afterAll(async () => {
    await c.cerrar();
  });

  it('crea todas las tablas de esquema.ts', async () => {
    const esperadas = tablas.map((t) => getTableName(t)).sort();
    // 17 del MVP + buzones, evidencias, mensajes_leidos y revisiones (reformas v2). R9 quita correcciones_correo → 20.
    expect(esperadas.length).toBe(21);
    const reales = await tablasEnBase(c);
    for (const t of esperadas) expect(reales).toContain(t);
  });

  it('cada tabla tiene las mismas columnas que esquema.ts', async () => {
    for (const t of tablas) {
      const nombre = getTableName(t);
      const r = await c.db.execute(
        sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${nombre}`,
      );
      const reales = ((r as { rows: { column_name: string }[] }).rows).map((f) => f.column_name).sort();
      const esperadas = getTableConfig(t)
        .columns.map((col) => col.name)
        .sort();
      expect(reales, nombre).toEqual(esperadas);
    }
  });

  it('ejecutar DDL_CREAR dos veces no falla ni borra datos', async () => {
    await c.ejecutarSql(DDL_CREAR);
    await c.db.insert(esquema.reloj).values({ id: 1, ahora: new Date('2026-11-25T13:00:00Z') });
    await c.ejecutarSql(DDL_CREAR);
    const filas = await c.db.select().from(esquema.reloj);
    expect(filas).toHaveLength(1);
  });

  it('inserta y lee cada tabla con Drizzle', async () => {
    const en = new Date('2026-11-25T13:00:00Z');
    const { db } = c;
    await db.insert(esquema.personas).values([
      { id: 'jefa', nombre: 'Jefa', rol: 'Gerente general', area: 'Gerencia', jefeId: null },
      { id: 'ana', nombre: 'Ana', rol: 'Técnica', area: 'Campo', jefeId: 'jefa' },
    ]);
    await db.insert(esquema.proyectos).values({ id: 'P1', clave: 'UNO', nombre: 'Proyecto', resultado: 'Listo', responsableId: 'jefa', fecha: en, cliente: 'X' });
    await db.insert(esquema.repuestos).values({
      id: 'termostato',
      nombre: 'Termostato',
      unidad: 'u',
      existencia: 3,
      precioHabitual: 1000,
      diasHabitual: 3,
      precioLocal: 1500,
      faltanteReportadoEn: en,
      faltanteReportadoPor: 'ana',
    });
    await db.insert(esquema.trabajos).values([
      { id: 'T01', proyectoId: 'P1', numero: 1, titulo: 'Uno', responsableId: 'ana', plazo: en, estado: 'abierto', origen: 'semilla', creadoEn: en },
      {
        id: 'T02',
        proyectoId: 'P1',
        numero: 2,
        titulo: 'Dos',
        responsableId: 'ana',
        solicitadoPorId: 'jefa',
        plazo: en,
        estado: 'bloqueado',
        urgente: true,
        conCostoProbable: true,
        bloqueadoPorId: 'T01',
        motivoBloqueo: 'falta',
        fechaSolucion: en,
        repuestoId: 'termostato',
        cantidadRepuesto: 2,
        etiqueta: 'e',
        relacionados: ['T01'],
        origen: 'captura',
        capturaId: 1,
        decisionId: 'D01',
        creadoEn: en,
        resueltoEn: en,
      },
    ]);
    await db.insert(esquema.dependencias).values({ trabajoId: 'T02', dependeDeId: 'T01' });
    await db.insert(esquema.necesidadesRepuesto).values({ trabajoId: 'T02', repuestoId: 'termostato', cantidad: 2, fechaDisponible: en });
    await db.insert(esquema.notas).values({ trabajoId: 'T01', autorId: null, en, texto: 'nota' });
    await db.insert(esquema.eventos).values({ en, actorId: null, tipo: 'trabajo_creado', trabajoId: 'T01', decisionId: null, datos: { a: 1 } });
    const [accion] = await db
      .insert(esquema.acciones)
      .values({ en, tipo: 'aviso', motivo: 'm', hechoOrigen: 'h', trabajoIds: ['T01'], destinatarioId: 'ana' })
      .returning();
    await db.insert(esquema.avisos).values({ personaId: 'ana', accionId: accion!.id, en, titulo: 't', cuerpo: 'c', trabajoIds: ['T01'] });
    await db.insert(esquema.seguimientos).values({
      id: 'S1',
      trabajoId: 'T01',
      plazoReferencia: en,
      nivel: 0,
      destinatarioId: 'ana',
      proximoEn: en,
      estado: 'pendiente',
      iniciadoEn: en,
    });
    await db.insert(esquema.decisiones).values({
      id: 'D01',
      creadaEn: en,
      proyectoId: 'P1',
      numero: 1,
      proponenteId: 'ana',
      decisorId: 'jefa',
      repuestoId: 'termostato',
      cantidad: 2,
      contexto: 'ctx',
      afectados: { trabajoIds: ['T01'], personaIds: ['ana'] },
      estado: 'pendiente',
    });
    await db.insert(esquema.opcionesDecision).values({
      decisionId: 'D01',
      letra: 'A',
      descripcion: 'd',
      costo: 100,
      lineas: [{ proveedor: 'local', cantidad: 2, precioUnitario: 50, llegada: en.toISOString(), trabajoIds: ['T01'] }],
      cambiosFecha: [],
      consecuencia: 'c',
    });
    await db.insert(esquema.capturas).values({
      autorId: 'ana',
      texto: 'hola',
      en,
      implementacion: 'local',
      interpretacion: { x: 1 },
      estado: 'aplicada',
    });
    await db.insert(esquema.preguntas).values({
      personaId: 'ana',
      en,
      texto: 'q',
      tema: 't',
      respuesta: 'r',
      fuentes: [{ trabajoId: 'T01', etiqueta: 'e' }],
      implementacion: 'local',
    });
    await db.insert(esquema.buzones).values({ personaId: 'ana', direccion: 'ana@friodelvalle.cr', proveedor: 'gmail', conectadoEn: en });
    await db.insert(esquema.evidencias).values({
      trabajoId: 'T02',
      tipo: 'pedido',
      fuente: 'correo',
      compromisoClave: 'c-h1-m1',
      mensajeId: '<h1-m1@friodelvalle.cr>',
      buzones: ['ana', 'jefa'],
      enlaces: { ana: 'https://mail.google.com/x' },
      autorId: 'jefa',
      en,
      cita: '¿Puedes…?',
    });
    await db.insert(esquema.mensajesLeidos).values({
      personaId: 'ana',
      idInternet: '<h1-m1@friodelvalle.cr>',
      enviado: en,
      leidoEn: en,
      clase: 'laboral',
      resultado: 'propuso',
      trabajoIds: ['T02'],
    });
    await db.insert(esquema.revisiones).values({
      en,
      personaId: 'ana',
      origen: 'correo',
      trabajoId: 'T02',
      resultado: 'corregida',
      campos: ['plazo'],
      propuesto: { titulo: 'Dos', responsableId: 'ana', plazo: en.toISOString(), proyectoId: 'P1' },
      final: { titulo: 'Dos', responsableId: 'ana', plazo: null, proyectoId: 'P1' },
      entrada: { cita: '¿Puedes…?', deId: 'jefa', paraIds: ['ana'], enviado: en.toISOString() },
    });
    await db.insert(esquema.correccionesCorreo).values({
      compromisoId: 'c-h1-m1',
      personaId: 'luis-mendez',
      en,
      tipo: 'corregir',
      cambios: { estado: 'en_curso' },
    });

    for (const t of tablas) {
      const filas = await db.select().from(t);
      expect(filas.length, getTableName(t)).toBeGreaterThan(0);
    }

    const [t2] = await db.select().from(esquema.trabajos).where(sql`${esquema.trabajos.id} = 'T02'`);
    expect(t2?.relacionados).toEqual(['T01']);
    expect(t2?.plazo).toEqual(en);
    expect(t2?.urgente).toBe(true);
    const [t1] = await db.select().from(esquema.trabajos).where(sql`${esquema.trabajos.id} = 'T01'`);
    expect(t1?.relacionados).toEqual([]);
    expect(t1?.urgente).toBe(false);
    // Valores por defecto de las columnas de las reformas v2.
    expect(t1).toMatchObject({ confirmacion: 'confirmado', duenoPropuestaId: null, confirmadoPorId: null, entrega: null });
    const [s1] = await db.select().from(esquema.seguimientos);
    expect(s1?.tipo).toBe('estado');
    const [ev] = await db.select().from(esquema.evidencias);
    expect(ev).toMatchObject({ buzones: ['ana', 'jefa'], enlaces: { ana: 'https://mail.google.com/x' }, en });
  });

  it('DDL_BORRAR + DDL_CREAR deja las tablas vacías', async () => {
    await c.ejecutarSql(DDL_BORRAR);
    expect((await tablasEnBase(c)).filter((n) => tablas.some((t) => getTableName(t) === n))).toHaveLength(0);
    await c.ejecutarSql(DDL_BORRAR); // idempotente
    await c.ejecutarSql(DDL_CREAR);
    for (const t of tablas) expect(await c.db.select().from(t), getTableName(t)).toHaveLength(0);
  });
});
