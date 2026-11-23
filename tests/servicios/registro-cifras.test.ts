// Servicios de cifras y registro sobre la base demo (PGlite). Tarea 4.4.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { acciones, preguntas, trabajos } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import { listarAcciones } from '@/servicios/registro';
import { obtenerCifras } from '@/servicios/cifras';
import type { ContextoServicio } from '@/servicios/contexto';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
let ctx: ContextoServicio;

beforeEach(async () => {
  demo = await prepararDemo();
  ctx = demo.ctx;
});

afterEach(async () => {
  await demo.cerrar();
});

async function insertarAccion(tipo: typeof acciones.$inferInsert.tipo, en: Date, destinatarioId: string | null = null) {
  await ctx.db.insert(acciones).values({
    en,
    tipo,
    motivo: `Motivo ${tipo}`,
    hechoOrigen: 'Hecho de prueba',
    trabajoIds: ['T04'],
    decisionId: null,
    destinatarioId,
    capturaId: null,
  });
}

describe('obtenerCifras', () => {
  it('estado inicial de la semilla: 6 de 8 (75 %), 0 seguimientos, 0 horas', async () => {
    const c = await obtenerCifras(ctx);
    expect(c).toEqual({
      resueltosSinGerente: 6,
      resueltosTotal: 8,
      porcentaje: 75,
      seguimientos: 0,
      preguntasRespondidas: 0,
      minutosAhorrados: 0,
      horasAhorradas: 0,
    });
  });

  it('cuenta seguimientos y preguntas de la base: 19 y 1 dan 3,4 h', async () => {
    const en = enCR('2026-11-25', '08:00');
    for (let i = 0; i < 19; i++) await insertarAccion('pedir_estado', en);
    await insertarAccion('crear_trabajo', en); // no es seguimiento
    await ctx.db.insert(preguntas).values({
      personaId: 'marcela-solis',
      en,
      texto: '¿Qué pasó con T04?',
      tema: 'desconocido',
      respuesta: 'No lo sé',
      fuentes: [],
      implementacion: 'local',
      modelo: null,
    });
    const c = await obtenerCifras(ctx);
    expect(c.seguimientos).toBe(19);
    expect(c.preguntasRespondidas).toBe(1);
    expect(c.minutosAhorrados).toBe(205);
    expect(c.horasAhorradas).toBe(3.4);
  });
});

describe('listarAcciones', () => {
  it('devuelve las acciones más recientes primero', async () => {
    await insertarAccion('pedir_estado', enCR('2026-11-25', '10:00'));
    await insertarAccion('recordatorio', enCR('2026-11-25', '12:00'));
    await insertarAccion('escalamiento', enCR('2026-11-25', '11:00'));
    const lista = await listarAcciones(ctx);
    expect(lista.map((a) => a.tipo)).toEqual(['recordatorio', 'escalamiento', 'pedir_estado']);
    expect(lista.map((a) => a.en.getTime())).toEqual([...lista.map((a) => a.en.getTime())].sort((x, y) => y - x));
  });

  it('resuelve el destinatario como persona breve y respeta el límite', async () => {
    await insertarAccion('pedir_estado', enCR('2026-11-25', '10:00'), 'jose-alfaro');
    await insertarAccion('aviso', enCR('2026-11-25', '11:00'), null);
    await insertarAccion('aviso', enCR('2026-11-25', '12:00'), null);
    const todas = await listarAcciones(ctx);
    expect(todas).toHaveLength(3);
    const conDestino = todas.find((a) => a.tipo === 'pedir_estado');
    expect(conDestino?.destinatario).toEqual({ id: 'jose-alfaro', nombre: 'José Alfaro', rol: 'Técnico', area: 'Campo' });
    expect(todas.find((a) => a.tipo === 'aviso')?.destinatario).toBeNull();
    const dos = await listarAcciones(ctx, { limite: 2 });
    expect(dos).toHaveLength(2);
  });

  it('marca como descartado el trabajo que su dueño descartó (se nombra sin enlace: nadie lo ve)', async () => {
    await insertarAccion('aviso', enCR('2026-11-25', '10:00'));
    await ctx.db.update(trabajos).set({ confirmacion: 'descartado' }).where(eq(trabajos.id, 'T04'));
    const [accion] = await listarAcciones(ctx);
    expect(accion?.trabajos).toEqual([
      { id: 'T04', titulo: 'Instalar unidad condensadora y compresor', referencia: 'COLINA-4', descartado: true },
    ]);
  });

  it('un trabajo vivo no lleva la marca de descartado', async () => {
    await insertarAccion('aviso', enCR('2026-11-25', '10:00'));
    const [accion] = await listarAcciones(ctx);
    expect(accion?.trabajos).toEqual([{ id: 'T04', titulo: 'Instalar unidad condensadora y compresor', referencia: 'COLINA-4' }]);
  });
});
