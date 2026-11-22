// reiniciarDemo: devuelve la base exactamente al estado inicial. Tarea 1.5.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { esquema, trabajos, type Db } from '@/db/esquema';
import { cargarInstantanea, persistirEfectos } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { avanzarReloj, obtenerAhora } from '@/servicios/reloj';
import { reiniciarDemo } from '@/servicios/demo';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '07:00', correo: true }); // reiniciarDemo deja los 8 buzones conectados de la semilla
});
afterEach(async () => {
  await demo.cerrar();
});

/** Contenido completo de todas las tablas (ordenado de forma estable), para comparar bases. */
async function volcar(db: Db): Promise<Record<string, string[]>> {
  const res: Record<string, string[]> = {};
  for (const tabla of Object.values(esquema) as PgTable[]) {
    const filas = (await db.select().from(tabla)) as unknown[];
    res[getTableName(tabla)] = filas.map((f) => JSON.stringify(f)).sort();
  }
  return res;
}

describe('reiniciarDemo', () => {
  it('tras modificar la base, la deja exactamente como el estado inicial', async () => {
    const { ctx } = demo;
    const inicial = await volcar(ctx.db);
    expect(inicial.personas).toHaveLength(12);

    // Modificaciones de todo tipo: reloj, trabajo nuevo, cambios, nota, acción con aviso, decisión, repuesto…
    await avanzarReloj(ctx, 95);
    await persistirEfectos(ctx.db, [
      { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', motivoBloqueo: 'x' }, actorId: 'jose-alfaro' },
      { tipo: 'agregar_nota', trabajoId: 'T12', autorId: 'daniela-quesada', texto: 'nota de prueba' },
      { tipo: 'actualizar_repuesto', repuestoId: 'compresor-2hp', cambios: { existencia: 0 }, actorId: 'jose-alfaro' },
      {
        tipo: 'accion',
        accion: { en: enCR('2026-11-25', '08:00'), tipo: 'aviso', motivo: 'm', hechoOrigen: 'h', trabajoIds: ['T04'], decisionId: null, destinatarioId: 'lucia-mora', capturaId: null },
        aviso: { personaId: 'lucia-mora', en: enCR('2026-11-25', '08:00'), titulo: 't', cuerpo: 'c', trabajoIds: ['T04'] },
      },
    ]);
    expect(await volcar(ctx.db)).not.toEqual(inicial);

    await reiniciarDemo(ctx);

    expect(await volcar(ctx.db)).toEqual(inicial);
    expect(await obtenerAhora(ctx)).toEqual(enCR('2026-11-25', '07:00'));
  });

  it('es repetible y deja una base utilizable (ids de serie reiniciados, motor y reloj funcionan)', async () => {
    const { ctx } = demo;
    await reiniciarDemo(ctx);
    await reiniciarDemo(ctx);
    const inst = await cargarInstantanea(ctx.db);
    expect(inst.trabajos).toHaveLength(30);
    expect(inst.ahora).toEqual(enCR('2026-11-25', '07:00'));
    await persistirEfectos(ctx.db, [{ tipo: 'agregar_nota', trabajoId: 'T12', autorId: null, texto: 'x' }]);
    await avanzarReloj(ctx, 5);
    expect((await ctx.db.select().from(trabajos)).length).toBe(30);
  });
});
