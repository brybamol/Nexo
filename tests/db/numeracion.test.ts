// Numeración por proyecto (reforma de nombres): claves de proyecto, número de cada trabajo y decisión, y puesta al día
// de una base creada con el esquema anterior.
import { afterEach, describe, expect, it } from 'vitest';
import { DDL_CREAR } from '@/db/ddl';
import { crearConexion } from '@/db/conexion';
import { esquema } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { cargarSemilla } from '@/db/semilla/cargar';
import { PROYECTOS_SEMILLA, TRABAJOS_SEMILLA } from '@/db/semilla/datos';
import { CLAVES_PROYECTO } from '@/dominio/constantes';
import { crearNombrador } from '@/dominio/nombres';
import { capturar, responderCaptura } from '@/servicios/captura';
import { obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C10 = 'Alguien tiene que revisar el camión, hace un ruido raro';

let demo: Demo | undefined;
afterEach(async () => {
  await demo?.cerrar();
  demo = undefined;
});

/** Referencia de cada trabajo de la semilla, como la ven las personas. */
function referenciasSemilla(): Record<string, string> {
  const n = crearNombrador({ proyectos: PROYECTOS_SEMILLA, trabajos: TRABAJOS_SEMILLA });
  return Object.fromEntries(TRABAJOS_SEMILLA.map((t) => [t.id, n.referencia(t.id)]));
}

describe('semilla', () => {
  it('cada proyecto tiene su clave corta y estable', () => {
    expect(Object.fromEntries(PROYECTOS_SEMILLA.map((p) => [p.id, p.clave]))).toEqual({
      P1: 'COLINA',
      P2: 'TRIGAL',
      P3: 'REPUESTOS',
      P4: 'PEDIDOS',
      OD: 'DIARIA',
    });
    expect(CLAVES_PROYECTO).toEqual(Object.fromEntries(PROYECTOS_SEMILLA.map((p) => [p.id, p.clave])));
  });

  it('los 30 trabajos se numeran por proyecto en su orden: COLINA-1…7, TRIGAL-1…6, REPUESTOS-1…5, PEDIDOS-1…12', () => {
    const refs = referenciasSemilla();
    expect(Object.values(refs)).toEqual([
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `COLINA-${n}`),
      ...[1, 2, 3, 4, 5, 6].map((n) => `TRIGAL-${n}`),
      ...[1, 2, 3, 4, 5].map((n) => `REPUESTOS-${n}`),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `PEDIDOS-${n}`),
    ]);
    expect(refs).toMatchObject({ T04: 'COLINA-4', T05: 'COLINA-5', T11: 'TRIGAL-4', T15: 'REPUESTOS-2', T21: 'PEDIDOS-3', T28: 'PEDIDOS-10' });
    expect(new Set(Object.values(refs)).size).toBe(30);
  });
});

describe('trabajos y decisiones nuevos', () => {
  it('el trabajo que crea la captura del guion recibe el siguiente número de su proyecto y no cambia después', async () => {
    demo = await prepararDemo();
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(r).toMatchObject({ estado: 'aplicada', trabajosCreados: ['T31'] });
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T31')).toMatchObject({ proyectoId: 'P1', numero: 8 });
    expect((await obtenerTrabajo(demo.ctx, 'T31'))?.referencia).toBe('COLINA-8');
    // Los de la semilla conservan el suyo.
    expect((await obtenerTrabajo(demo.ctx, 'T04'))?.referencia).toBe('COLINA-4');
  });

  it('el primer trabajo de un proyecto sin trabajos es el 1; dos creados a la vez no repiten número', async () => {
    demo = await prepararDemo();
    const { ctx } = demo;
    const p1 = await capturar(ctx, 'andres-vargas', C10);
    const p2 = await capturar(ctx, 'andres-vargas', `${C10} otra vez`);
    expect([p1.estado, p2.estado]).toEqual(['pregunta', 'pregunta']);
    const [a, b] = await Promise.all([responderCaptura(ctx, p1.capturaId, 'lucia-mora'), responderCaptura(ctx, p2.capturaId, 'lucia-mora')]);
    expect([a.estado, b.estado]).toEqual(['aplicada', 'aplicada']);
    const inst = await cargarInstantanea(ctx.db);
    const diaria = inst.trabajos.filter((t) => t.proyectoId === 'OD').map((t) => t.numero).sort();
    expect(diaria).toEqual([1, 2]);
    const refs = await Promise.all(inst.trabajos.filter((t) => t.proyectoId === 'OD').map((t) => obtenerTrabajo(ctx, t.id)));
    expect(refs.map((t) => t?.referencia).sort()).toEqual(['DIARIA-1', 'DIARIA-2']);
  });

  it('la base no admite dos trabajos con el mismo número en un proyecto', async () => {
    demo = await prepararDemo();
    const t04 = TRABAJOS_SEMILLA.find((t) => t.id === 'T04')!;
    await expect(demo.ctx.db.insert(esquema.trabajos).values({ ...t04, id: 'T99' })).rejects.toThrow();
  });
});

describe('base creada con el esquema anterior', () => {
  it('DDL_CREAR añade las columnas que faltan y numera como la semilla, sin borrar datos', async () => {
    const c = await crearConexion({ tipo: 'pglite', dir: null });
    try {
      await cargarSemilla(c.db);
      // Así quedaba una base de antes de la reforma: sin clave de proyecto ni números.
      await c.ejecutarSql(
        'ALTER TABLE trabajos DROP COLUMN numero; ALTER TABLE proyectos DROP COLUMN clave; ALTER TABLE decisiones DROP COLUMN numero;',
      );
      await c.ejecutarSql(DDL_CREAR);
      const inst = await cargarInstantanea(c.db);
      expect(inst.trabajos).toHaveLength(30);
      expect(Object.fromEntries(inst.proyectos.map((p) => [p.id, p.clave]))).toEqual(CLAVES_PROYECTO);
      const n = crearNombrador(inst);
      expect(Object.fromEntries(inst.trabajos.map((t) => [t.id, n.referencia(t.id)]))).toEqual(referenciasSemilla());
      // Y repetirlo no cambia nada.
      await c.ejecutarSql(DDL_CREAR);
      expect((await cargarInstantanea(c.db)).trabajos.map((t) => t.numero)).toEqual(inst.trabajos.map((t) => t.numero));
    } finally {
      await c.cerrar();
    }
  });
});
