// E1 · Seguimiento que se cierra solo (R1). Servicios reales contra PGlite en memoria. Tarea 3.4.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, eventos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { capturar } from '@/servicios/captura';
import { avanzarReloj, obtenerAhora } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '11:59' });
});
afterEach(async () => {
  await demo.cerrar();
});

const accionesSobre = async (trabajoId: string) =>
  (await demo.ctx.db.select().from(acciones)).filter((a) => a.trabajoIds.includes(trabajoId));

describe('E1 · seguimiento que se cierra solo', () => {
  it('12:00 vence T28 y se pide el estado a Paola; 12:10 ella responde «ya la envié» y todo queda cerrado sin jefes', async () => {
    const r = await avanzarReloj(demo.ctx, 1);
    expect(await obtenerAhora(demo.ctx)).toEqual(enCR('2026-11-25', '12:00'));
    const pedidos = r.acciones.filter((a) => a.trabajoIds.includes('T28'));
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ tipo: 'pedir_estado', trabajoIds: ['T28'], destinatario: { id: 'paola-herrera' } });

    await avanzarReloj(demo.ctx, 10);
    const res = await capturar(demo.ctx, 'paola-herrera', 'Ya la envié');
    expect(res.estado).toBe('aplicada');
    if (res.estado === 'aplicada') expect(res.trabajosActualizados).toContain('T28');

    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T28')).toMatchObject({ estado: 'resuelto', resueltoEn: enCR('2026-11-25', '12:10') });
    expect(inst.seguimientos.filter((s) => s.trabajoId === 'T28')).toEqual([expect.objectContaining({ estado: 'respondido' })]);

    // La acción queda registrada (R10), ligada a la captura de Paola.
    const sobreT28 = await accionesSobre('T28');
    expect(sobreT28.map((a) => a.tipo)).toEqual(['pedir_estado', 'actualizar_trabajo']);
    expect(sobreT28[1]?.capturaId).toBe(res.capturaId);

    // La respuesta quedó como evento de Paola; ningún jefe aparece ni recibe nada.
    const evs = await demo.ctx.db.select().from(eventos);
    expect(evs.some((e) => e.tipo === 'respuesta_seguimiento' && e.trabajoId === 'T28' && e.actorId === 'paola-herrera')).toBe(true);
    expect(evs.filter((e) => e.en >= enCR('2026-11-25', '07:00') && (e.actorId === 'andres-vargas' || e.actorId === 'marcela-solis'))).toEqual([]);

    // Pasa el tiempo (más allá de todos los niveles): ni recordatorio ni escalamiento sobre T28.
    await avanzarReloj(demo.ctx, 24 * 60);
    const finales = await accionesSobre('T28');
    expect(finales.filter((a) => a.tipo === 'recordatorio' || a.tipo === 'escalamiento')).toEqual([]);
    expect(finales.filter((a) => a.destinatarioId === 'andres-vargas' || a.destinatarioId === 'marcela-solis')).toEqual([]);
  });
});
