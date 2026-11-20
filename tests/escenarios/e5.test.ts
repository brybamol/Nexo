// E5 · Cierre de ciclo sin jefes. Servicios reales contra PGlite en memoria. Tarea 3.4.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventos, notas } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { calcularMarcas } from '@/motor/marcas';
import { capturar } from '@/servicios/captura';
import { avanzarReloj, fijarReloj } from '@/servicios/reloj';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

let demo: Demo;
beforeEach(async () => {
  demo = await prepararDemo({ hora: '09:30' });
});
afterEach(async () => {
  await demo.cerrar();
});

const MIE = '2026-11-25';
const JUE = '2026-11-26';

describe('E5 · cierre de ciclo sin jefes', () => {
  it('9:30 Sofía escribe la frase: T22 resuelto, T21 al jueves 12:00 sin atraso, aviso a Diego, nota en T29 y seguimiento cerrado', async () => {
    // A las 9:30 el tick ya pidió el estado de T21 a Diego (atrasado desde el martes).
    await avanzarReloj(demo.ctx, 0);
    const antes = await cargarInstantanea(demo.ctx.db);
    expect(antes.seguimientos.find((s) => s.trabajoId === 'T21')).toMatchObject({ estado: 'pendiente', destinatarioId: 'diego-rojas' });
    expect(calcularMarcas(antes).get('T21')?.atrasado).toBe(true);

    const res = await capturar(demo.ctx, 'sofia-navarro', 'Don Beto recibe mañana jueves en la mañana');
    expect(res.estado).toBe('aplicada');
    if (res.estado === 'aplicada') {
      expect(res.avisosA).toEqual(['diego-rojas']);
      expect(res.trabajosActualizados).toEqual(expect.arrayContaining(['T22', 'T21', 'T29']));
    }

    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.trabajos.find((t) => t.id === 'T22')).toMatchObject({ estado: 'resuelto', resueltoEn: enCR(MIE, '09:30') });
    expect(inst.trabajos.find((t) => t.id === 'T21')?.plazo).toEqual(enCR(JUE, '12:00'));
    expect(calcularMarcas(inst).get('T21')?.atrasado).toBe(false);

    const notasT29 = (await demo.ctx.db.select().from(notas)).filter((n) => n.trabajoId === 'T29');
    expect(notasT29).toHaveLength(1);
    expect(notasT29[0]?.autorId).toBe('sofia-navarro');

    // Ningún jefe interviene (los eventos anteriores a hoy son de la semilla).
    const evs = await demo.ctx.db.select().from(eventos);
    expect(evs.filter((e) => e.en >= enCR('2026-11-25', '07:00') && (e.actorId === 'andres-vargas' || e.actorId === 'marcela-solis'))).toEqual([]);

    // El siguiente tick cierra el seguimiento de T21 (su plazo quedó en el futuro): Nexo no vuelve a perseguir a Diego.
    const cierre = await avanzarReloj(demo.ctx, 0);
    expect(cierre.acciones.filter((a) => a.trabajoIds.includes('T21'))).toEqual([]);
    const tras = await cargarInstantanea(demo.ctx.db);
    expect(tras.seguimientos.filter((s) => s.trabajoId === 'T21').map((s) => s.estado)).toEqual(['respondido']);
    expect(tras.seguimientos.filter((s) => s.trabajoId === 'T22').every((s) => s.estado !== 'pendiente')).toBe(true);

    // Todo el miércoles sin recordatorios ni escalamientos sobre T21; al vencer el plazo nuevo se vuelve a pedir el estado.
    const tarde = await fijarReloj(demo.ctx, enCR(MIE, '23:00'));
    expect(tarde.acciones.filter((a) => a.trabajoIds.includes('T21'))).toEqual([]);
    const jueves = await fijarReloj(demo.ctx, enCR(JUE, '12:00'));
    expect(jueves.acciones.filter((a) => a.trabajoIds.includes('T21')).map((a) => [a.tipo, a.destinatario?.id])).toEqual([
      ['pedir_estado', 'diego-rojas'],
    ]);
  });
});
