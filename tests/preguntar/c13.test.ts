// C13 y preguntas sobre el estado de la empresa (tarea 4.3).
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { preguntas, trabajos } from '@/db/esquema';
import { clasificarPregunta } from '@/ia/local/preguntas-local';
import { capturar } from '@/servicios/captura';
import { obtenerCifras } from '@/servicios/cifras';
import { listarTrabajos } from '@/servicios/consultas-trabajos';
import { preguntar } from '@/servicios/preguntar';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C13 = '¿Cómo vamos con los pedidos de la semana?';
const MARCELA = 'marcela-solis';
let demo: Demo;

afterEach(async () => {
  await demo?.cerrar();
});

describe('C13 · pedidos de la semana', () => {
  it('con el estado inicial: 2 entregados, 1 en ruta, 1 atrasado, 3 pendientes y siete fuentes', async () => {
    demo = await prepararDemo();
    const r = await preguntar(demo.ctx, MARCELA, C13);
    expect(r.tema).toBe('pedidos_semana');
    expect(r.ia).toMatchObject({ implementacion: 'local', respaldo: false });
    expect(r.datos).toMatchObject({
      total: 7,
      entregados: [1041, 1042],
      enRutaHoy: [1044],
      atrasados: [1043],
      pendientes: [1045, 1046, 1047],
    });
    expect(r.fuentes.map((f) => f.trabajoId)).toEqual(['T19', 'T20', 'T21', 'T23', 'T24', 'T25', 'T26']);
    expect(r.texto).toContain('7 pedidos');
    expect(r.texto).toContain('Sofía Navarro');
    expect(r.texto).toMatch(/pago/);
    expect(r.texto).toMatch(/cliente estaba cerrado/i); // nota de T21 en la semilla (04): motivo del atraso de 1043
    for (const n of [1041, 1042, 1043, 1044, 1045, 1046, 1047]) expect(r.texto).toContain(String(n));
  });

  it('refleja el estado actual: al resolver T23 hay 3 entregados y 0 en ruta', async () => {
    demo = await prepararDemo();
    await demo.ctx.db.update(trabajos).set({ estado: 'resuelto', resueltoEn: new Date('2026-11-25T14:30:00-06:00') }).where(eq(trabajos.id, 'T23'));
    const r = await preguntar(demo.ctx, MARCELA, C13);
    expect(r.datos).toMatchObject({ entregados: [1041, 1042, 1044], enRutaHoy: [], atrasados: [1043], pendientes: [1045, 1046, 1047] });
    expect(r.texto).toContain('3 entregados');
    expect(r.texto).toContain('0 en ruta hoy');
  });

  it('a través de capturar devuelve la respuesta y no crea trabajos', async () => {
    demo = await prepararDemo();
    const antes = (await listarTrabajos(demo.ctx)).length;
    const r = await capturar(demo.ctx, MARCELA, C13);
    expect(r.estado).toBe('respuesta');
    if (r.estado !== 'respuesta') return;
    expect(r.respuesta.tema).toBe('pedidos_semana');
    expect(r.respuesta.fuentes).toHaveLength(7);
    expect((await listarTrabajos(demo.ctx)).length).toBe(antes);
  });

  it('la pregunta respondida queda guardada y cuenta para las horas ahorradas', async () => {
    demo = await prepararDemo();
    await preguntar(demo.ctx, MARCELA, C13);
    const filas = await demo.ctx.db.select().from(preguntas);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ personaId: MARCELA, texto: C13, tema: 'pedidos_semana', implementacion: 'local' });
    expect(filas[0]?.fuentes).toHaveLength(7);
    const cifras = await obtenerCifras(demo.ctx);
    expect(cifras.preguntasRespondidas).toBe(1);
    expect(cifras.minutosAhorrados).toBe(15);
  });
});

describe('otras preguntas', () => {
  it('sin datos: «no lo sé», sin fuentes y sin guardar', async () => {
    demo = await prepararDemo();
    const r = await preguntar(demo.ctx, MARCELA, '¿Cuánto vendimos en marzo?');
    expect(r.tema).toBe('desconocido');
    expect(r.texto).toMatch(/^No lo sé/);
    expect(r.fuentes).toEqual([]);
    expect(r.datos).toEqual({});
    expect(await demo.ctx.db.select().from(preguntas)).toHaveLength(0);
  });

  it('atrasados: T15 y T21 atrasados, T16-T18 en riesgo', async () => {
    demo = await prepararDemo();
    const r = await preguntar(demo.ctx, MARCELA, '¿Qué está atrasado o en riesgo?');
    expect(r.tema).toBe('atrasados');
    const ids = (k: string) => ((r.datos[k] as { trabajoId: string }[]) ?? []).map((i) => i.trabajoId).sort();
    expect(ids('atrasados')).toEqual(['T15', 'T21']);
    expect(ids('enRiesgo')).toEqual(['T16', 'T17', 'T18']);
    expect(r.fuentes.map((f) => f.trabajoId).sort()).toEqual(['T15', 'T16', 'T17', 'T18', 'T21']);
  });

  it('estado de los proyectos, todos o uno nombrado', async () => {
    demo = await prepararDemo();
    const todos = await preguntar(demo.ctx, MARCELA, '¿Cómo van los proyectos?');
    expect(todos.tema).toBe('estado_proyectos');
    expect((todos.datos.proyectos as unknown[]).length).toBe(5);
    const uno = await preguntar(demo.ctx, MARCELA, '¿Cómo va el proyecto Cámara fría La Colina?');
    expect(uno.tema).toBe('estado_proyectos');
    expect((uno.datos.proyectos as unknown[]).length).toBe(1);
    expect(uno.texto).toContain('Cámara fría La Colina');
  });

  it('mis pendientes: solo trabajos no resueltos de la persona', async () => {
    demo = await prepararDemo();
    const r = await preguntar(demo.ctx, 'diego-rojas', '¿Qué tengo pendiente?');
    expect(r.tema).toBe('mis_pendientes');
    const ids = r.fuentes.map((f) => f.trabajoId);
    expect(ids).toContain('T21');
    expect(ids).not.toContain('T19');
    expect(r.texto).toContain('Diego Rojas');
  });

  it('el clasificador local: temas y desconocido', async () => {
    demo = await prepararDemo();
    const ctxIa = { ahora: '', autor: { id: 'x', nombre: 'x', rol: 'x', area: 'operaciones' }, personas: [], proyectos: [], trabajosAbiertos: [], repuestos: [], seguimientosPendientesDelAutor: [] } as unknown as Parameters<typeof clasificarPregunta>[1];
    expect(clasificarPregunta(C13, ctxIa)).toBe('pedidos_semana');
    expect(clasificarPregunta('que esta atrasado?', ctxIa)).toBe('atrasados');
    expect(clasificarPregunta('¿Qué me toca hoy?', ctxIa)).toBe('mis_pendientes');
    expect(clasificarPregunta('¿Cuál es la capital de Francia?', ctxIa)).toBe('desconocido');
  });

  it('pregunta vacía o persona inexistente: error de dominio', async () => {
    demo = await prepararDemo();
    await expect(preguntar(demo.ctx, MARCELA, '   ')).rejects.toThrow();
    await expect(preguntar(demo.ctx, 'nadie', C13)).rejects.toThrow();
  });
});
