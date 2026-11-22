// E2 · Recordatorio y escalamiento (R2 y R3). Servicios reales contra PGlite en memoria. Tarea 3.4.
// Solo se comprueba lo que es de captura y seguimiento: acciones sobre T31 (la propagación del bloqueo es de E3).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { capturar } from '@/servicios/captura';
import { avanzarReloj, fijarReloj, irAlSiguienteEvento, obtenerAhora } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo();
});
afterEach(async () => {
  await demo.cerrar();
});

const MIE = '2026-11-25';
const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const deT31 = (r: { acciones: { trabajoIds: string[]; tipo: string }[] }) =>
  r.acciones.filter((a) => a.trabajoIds.includes('T31') && (a.tipo === 'recordatorio' || a.tipo === 'escalamiento'));

describe('E2 · recordatorio y escalamiento', () => {
  it('7:05 aviso a Lucía; 7:35 recordatorio; 8:05 escalamiento a Esteban (responsable de La Colina) con quién, qué bloquea, desde cuándo y qué puede hacer; 8:35 Andrés (responsable de la operación); agotado', async () => {
    // prepararDemo fija las 7:05 sin tick; en la demo se llega con «+5 min», que pide el estado de T15 y T21.
    await fijarReloj(demo.ctx, enCR(MIE, '07:05'));
    const res = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(res.estado).toBe('aplicada');
    if (res.estado === 'aplicada') expect(res.trabajosCreados).toEqual(['T31']);

    // 7:05: aviso de asignación a Lucía y seguimiento urgente abierto.
    const avisosLucia = (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === 'lucia-mora' && a.trabajoIds.includes('T31'));
    expect(avisosLucia).toHaveLength(1);
    expect(avisosLucia[0]?.en).toEqual(enCR(MIE, '07:05'));
    const abierto = (await cargarInstantanea(demo.ctx.db)).seguimientos.find((s) => s.trabajoId === 'T31');
    expect(abierto).toMatchObject({ nivel: 0, estado: 'pendiente', destinatarioId: 'lucia-mora', urgente: true });

    // 7:35: recordatorio a Lucía.
    let r = await irAlSiguienteEvento(demo.ctx);
    expect(await obtenerAhora(demo.ctx)).toEqual(enCR(MIE, '07:35'));
    expect(deT31(r)).toHaveLength(1);
    expect(deT31(r)[0]).toMatchObject({ tipo: 'recordatorio', destinatario: { id: 'lucia-mora' }, trabajoIds: ['T31'] });

    // 8:05: escalamiento a Esteban Castro, responsable del proyecto (no al jefe de Lucía), con José Alfaro, la cadena
    // de T04, desde cuándo (7:05) y las tres acciones que puede hacer.
    r = await irAlSiguienteEvento(demo.ctx);
    expect(await obtenerAhora(demo.ctx)).toEqual(enCR(MIE, '08:05'));
    expect(deT31(r)).toHaveLength(1);
    expect(deT31(r)[0]).toMatchObject({ tipo: 'escalamiento', destinatario: { id: 'esteban-castro' } });
    const aviso = (await demo.ctx.db.select().from(avisos)).find((a) => a.personaId === 'esteban-castro' && a.trabajoIds.includes('T31'));
    // Bloquea T04, T05, T06 y T07: citados por título y referencia.
    for (const texto of ['José Alfaro', '«Instalar unidad condensadora y compresor» (COLINA-4)', '«Cableado y tablero de control» (COLINA-5)', '«Prueba de frío y entrega al cliente» (COLINA-6)', '«Facturar la instalación» (COLINA-7)', '7:05']) expect(aviso?.cuerpo).toContain(texto);
    for (const texto of ['reasignarlo', 'mover el plazo', 'declararlo bloqueado']) expect(aviso?.cuerpo).toContain(texto);
    expect((await demo.ctx.db.select().from(avisos)).some((a) => a.personaId === 'andres-vargas' && a.trabajoIds.includes('T31'))).toBe(false);

    // 8:35: nadie de otro proyecto sale perjudicado (la cadena es de La Colina): responsable de la operación; luego nada más.
    r = await irAlSiguienteEvento(demo.ctx);
    expect(await obtenerAhora(demo.ctx)).toEqual(enCR(MIE, '08:35'));
    expect(deT31(r)).toHaveLength(1);
    expect(deT31(r)[0]).toMatchObject({ tipo: 'escalamiento', destinatario: { id: 'andres-vargas' } });
    expect((await cargarInstantanea(demo.ctx.db)).seguimientos.find((s) => s.trabajoId === 'T31')).toMatchObject({
      nivel: 3,
      estado: 'agotado',
      escaladosA: ['esteban-castro', 'andres-vargas'],
    });

    r = await avanzarReloj(demo.ctx, 60);
    expect(deT31(r)).toEqual([]);
    const todas = (await demo.ctx.db.select().from(acciones)).filter((a) => a.trabajoIds.includes('T31'));
    expect(todas.filter((a) => a.tipo === 'recordatorio' || a.tipo === 'escalamiento').map((a) => [a.tipo, a.destinatarioId])).toEqual([
      ['recordatorio', 'lucia-mora'],
      ['escalamiento', 'esteban-castro'],
      ['escalamiento', 'andres-vargas'],
    ]);
    // La gerente no aparece en el seguimiento.
    expect((await demo.ctx.db.select().from(acciones)).some((a) => a.destinatarioId === 'marcela-solis' && a.tipo === 'escalamiento')).toBe(false);
  });
});
