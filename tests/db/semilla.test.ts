// Semilla de Frío del Valle (docs/04 y §3.3 de docs/05) contra PGlite en memoria. Tarea 1.4.
// Los valores esperados están escritos a mano desde docs/04, no tomados de datos.ts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearConexion, type Conexion } from '@/db/conexion';
import {
  dependencias,
  eventos,
  necesidadesRepuesto,
  notas,
  personas,
  proyectos,
  repuestos,
  reloj,
  trabajos,
  type Db,
} from '@/db/esquema';
import { cargarSemilla } from '@/db/semilla/cargar';

let conexion: Conexion;
let db: Db;

beforeEach(async () => {
  conexion = await crearConexion({ tipo: 'pglite', dir: null });
  db = conexion.db;
  await cargarSemilla(db);
});

afterEach(async () => {
  await conexion.cerrar();
});

// Persona → jefe directo (docs/04 §1, tabla «Personas»).
const JEFES: Record<string, string | null> = {
  'marcela-solis': null,
  'andres-vargas': 'marcela-solis',
  'ricardo-brenes': 'marcela-solis',
  'paola-herrera': 'andres-vargas',
  'sofia-navarro': 'andres-vargas',
  'karla-jimenez': 'andres-vargas',
  'lucia-mora': 'andres-vargas',
  'diego-rojas': 'lucia-mora',
  'esteban-castro': 'andres-vargas',
  'jose-alfaro': 'esteban-castro',
  'daniela-quesada': 'esteban-castro',
  'mario-chaves': 'esteban-castro',
};

// Dependencias de docs/04 §3, «trabajo>depende de».
const DEPENDENCIAS_ESPERADAS = [
  'T02>T01',
  'T03>T02',
  'T04>T03',
  'T05>T04',
  'T06>T05',
  'T07>T06',
  'T09>T08',
  'T10>T08',
  'T11>T08',
  'T12>T08',
  'T13>T10',
  'T13>T11',
  'T13>T12',
  'T15>T14',
  'T16>T15',
  'T17>T16',
  'T18>T17',
  'T21>T22',
  'T26>T27',
];

const RESUELTOS = ['T01', 'T02', 'T03', 'T08', 'T09', 'T14', 'T19', 'T20'];
const EN_CURSO = ['T04', 'T23'];

const hora = (iso: string) => new Date(iso).getTime();

describe('semilla de Frío del Valle', () => {
  it('carga 12 personas, 5 proyectos, 5 repuestos y 30 trabajos', async () => {
    expect(await db.select().from(personas)).toHaveLength(12);
    expect(await db.select().from(proyectos)).toHaveLength(5);
    expect(await db.select().from(repuestos)).toHaveLength(5);
    expect(await db.select().from(trabajos)).toHaveLength(30);
  });

  it('tiene 8 resueltos, 2 en curso y 20 abiertos, con los ids de docs/04', async () => {
    const filas = await db.select({ id: trabajos.id, estado: trabajos.estado }).from(trabajos);
    const ids = (estado: string) =>
      filas
        .filter((f) => f.estado === estado)
        .map((f) => f.id)
        .sort();

    expect(ids('resuelto')).toEqual([...RESUELTOS].sort());
    expect(ids('en_curso')).toEqual([...EN_CURSO].sort());
    expect(ids('abierto')).toHaveLength(20);
    expect(ids('bloqueado')).toEqual([]);
  });

  it('cada persona tiene el jefe directo de docs/04', async () => {
    const filas = await db.select({ id: personas.id, jefeId: personas.jefeId }).from(personas);
    const real = Object.fromEntries(filas.map((f) => [f.id, f.jefeId]));
    expect(real).toEqual(JEFES);
  });

  it('tiene exactamente las dependencias de docs/04', async () => {
    const filas = await db.select().from(dependencias);
    const reales = filas.map((f) => `${f.trabajoId}>${f.dependeDeId}`).sort();
    expect(reales).toEqual([...DEPENDENCIAS_ESPERADAS].sort());
    expect(filas).toHaveLength(19);
  });

  it('necesidades de repuesto: T04, T10 y T11 un compresor; T25 cuatro termostatos y diez metros de empaque', async () => {
    const filas = await db.select().from(necesidadesRepuesto);
    const reales = filas.map((f) => `${f.trabajoId}|${f.repuestoId}|${f.cantidad}`).sort();
    expect(reales).toEqual(
      [
        'T04|compresor-2hp|1',
        'T10|compresor-2hp|1',
        'T11|compresor-2hp|1',
        'T25|termostato|4',
        'T25|empaque-puerta|10',
      ].sort(),
    );
    expect(filas.every((f) => f.fechaDisponible === null && f.atendida === false)).toBe(true);
  });

  it('repuestos con existencia y precios de docs/04 (compresor: 3 en sistema, ₡380.000 habitual, ₡460.000 local)', async () => {
    const filas = await db.select().from(repuestos);
    const real = Object.fromEntries(
      filas.map((f) => [
        f.id,
        [f.existencia, f.precioHabitual, f.diasHabitual, f.precioLocal],
      ]),
    );
    expect(real).toEqual({
      'compresor-2hp': [3, 380_000, 6, 460_000],
      termostato: [12, 18_000, 3, 24_000],
      'empaque-puerta': [40, 3_500, 3, 4_200],
      'gas-refrigerante': [4, 95_000, 3, 110_000],
      'motor-ventilador': [6, 42_000, 6, 55_000],
    });
  });

  it('plazos con hora: T04 mié 25 17:00, T22 10:00, T23 14:00, T28 12:00, T29 16:00 (hora de Costa Rica)', async () => {
    const filas = await db.select({ id: trabajos.id, plazo: trabajos.plazo }).from(trabajos);
    const plazo = Object.fromEntries(filas.map((f) => [f.id, f.plazo.getTime()]));
    expect(plazo.T04).toBe(hora('2026-11-25T17:00:00-06:00'));
    expect(plazo.T22).toBe(hora('2026-11-25T10:00:00-06:00'));
    expect(plazo.T23).toBe(hora('2026-11-25T14:00:00-06:00'));
    expect(plazo.T28).toBe(hora('2026-11-25T12:00:00-06:00'));
    expect(plazo.T29).toBe(hora('2026-11-25T16:00:00-06:00'));
  });

  it('plazos sin hora son a las 17:00 de su día (T01 lun 23, T13 lun 30, T06 vie 27)', async () => {
    const filas = await db.select({ id: trabajos.id, plazo: trabajos.plazo }).from(trabajos);
    const plazo = Object.fromEntries(filas.map((f) => [f.id, f.plazo.getTime()]));
    expect(plazo.T01).toBe(hora('2026-11-23T17:00:00-06:00'));
    expect(plazo.T13).toBe(hora('2026-11-30T17:00:00-06:00'));
    expect(plazo.T06).toBe(hora('2026-11-27T17:00:00-06:00'));
  });

  it('los resueltos tienen resuelto_en igual al plazo; los demás no', async () => {
    const filas = await db.select().from(trabajos);
    for (const t of filas) {
      if (RESUELTOS.includes(t.id)) expect(t.resueltoEn?.getTime()).toBe(t.plazo.getTime());
      else expect(t.resueltoEn).toBeNull();
    }
  });

  it('T15 lleva la etiqueta conciliacion_inventario y es la única', async () => {
    const etiquetados = (await db.select().from(trabajos)).filter((t) => t.etiqueta !== null);
    expect(etiquetados.map((t) => [t.id, t.etiqueta])).toEqual([['T15', 'conciliacion_inventario']]);
  });

  it('el historial: notas y eventos nota_agregada de la gerente en T19 y T20 y de Diego en T21', async () => {
    const notasReales = (await db.select().from(notas)).map((n) => [n.trabajoId, n.autorId, n.texto]).sort();
    expect(notasReales).toEqual(
      [
        ['T19', 'marcela-solis', 'Confirmé con Soda El Roble la hora de entrega'],
        ['T20', 'marcela-solis', 'Pedí priorizar al Hotel Mirador'],
        ['T21', 'diego-rojas', 'El cliente estaba cerrado el martes; los congeladores volvieron a bodega'],
      ].sort(),
    );

    const todos = await db.select().from(eventos);
    expect(todos).toHaveLength(3);
    expect(todos.map((e) => [e.tipo, e.actorId, e.trabajoId]).sort()).toEqual(
      [
        ['nota_agregada', 'marcela-solis', 'T19'],
        ['nota_agregada', 'marcela-solis', 'T20'],
        ['nota_agregada', 'diego-rojas', 'T21'],
      ].sort(),
    );
  });

  it('fija el reloj en mié 25-nov 7:00 de Costa Rica, sin acciones ni seguimientos iniciales', async () => {
    const [r] = await db.select().from(reloj);
    expect(r?.id).toBe(1);
    expect(r?.ahora.getTime()).toBe(hora('2026-11-25T07:00:00-06:00'));
  });

  it('cargar la semilla por segunda vez no duplica nada', async () => {
    await cargarSemilla(db);
    expect(await db.select().from(personas)).toHaveLength(12);
    expect(await db.select().from(proyectos)).toHaveLength(5);
    expect(await db.select().from(repuestos)).toHaveLength(5);
    expect(await db.select().from(trabajos)).toHaveLength(30);
    expect(await db.select().from(dependencias)).toHaveLength(19);
    expect(await db.select().from(necesidadesRepuesto)).toHaveLength(5);
    expect(await db.select().from(notas)).toHaveLength(3);
    expect(await db.select().from(eventos)).toHaveLength(3);
    expect(await db.select().from(reloj)).toHaveLength(1);
  });
});
