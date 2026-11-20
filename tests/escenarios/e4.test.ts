// E4 · Decisión con costo (R6, R7, R8): tras E3 (C01 a las 7:05), C11 a las 8:10 y la decisión a las 8:12. Tarea 3.3.
// El reloj se mueve directamente en la tabla (sin tick) para aislar la decisión del seguimiento (3.1, 3.4).
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos, eventos, reloj } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio } from '@/dominio/tipos';
import { calcularMarcas } from '@/motor/marcas';
import { capturar } from '@/servicios/captura';
import { aprobarDecision, listarDecisiones, obtenerDecision, rechazarDecision } from '@/servicios/decisiones';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';
const SEIS = ['T05', 'T06', 'T07', 'T10', 'T11', 'T13'];

describe('E4 · decisión con costo', () => {
  let demo: Demo;
  const fijar = (hora: string) => demo.ctx.db.update(reloj).set({ ahora: enCR('2026-11-25', hora) }).where(eq(reloj.id, 1));

  beforeEach(async () => {
    demo = await prepararDemo();
    await capturar(demo.ctx, 'jose-alfaro', C01);
    await fijar('08:10');
    const r = await capturar(demo.ctx, 'lucia-mora', C11);
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
    await fijar('08:12');
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  const estado = async () => {
    const inst = await cargarInstantanea(demo.ctx.db);
    const marcas = calcularMarcas(inst);
    return {
      inst,
      t: (id: string) => inst.trabajos.find((x) => x.id === id)!,
      enRiesgo: [...marcas].filter(([, m]) => m.enRiesgo).map(([id]) => id).sort(),
    };
  };

  it('D01 para Marcela con A/B/C; existencia 0; la bandeja de Marcela la lista', async () => {
    const lista = await listarDecisiones(demo.ctx, { decisorId: 'marcela-solis' });
    expect(lista.map((d) => d.id)).toEqual(['D01']);
    expect(lista[0]?.opciones.map((o) => o.costo)).toEqual([1_380_000, 1_140_000, 1_220_000]);
    expect(lista[0]?.proponente.id).toBe('lucia-mora');
    const { inst } = await estado();
    expect(inst.repuestos.find((r) => r.id === 'compresor-2hp')?.existencia).toBe(0);
    expect(await listarDecisiones(demo.ctx, { decisorId: 'andres-vargas' })).toEqual([]);
  });

  it('A · 8:12 Marcela aprueba: T32 para Karla 15:00, riesgo retirado, T04 con fecha de solución, 8 avisos', async () => {
    const res = await aprobarDecision(demo.ctx, 'D01', 'A', 'marcela-solis');
    expect(res.trabajosCreados).toEqual(['T32']);
    expect(new Set(res.avisosA)).toEqual(
      new Set(['jose-alfaro', 'mario-chaves', 'esteban-castro', 'ricardo-brenes', 'daniela-quesada', 'sofia-navarro', 'lucia-mora', 'karla-jimenez']),
    );
    expect(res.avisosA).toHaveLength(8);

    const { t, enRiesgo } = await estado();
    expect(t('T32')).toMatchObject({
      titulo: 'Comprar 3 compresores de 2 HP al proveedor local',
      responsableId: 'karla-jimenez',
      plazo: enCR('2026-11-25', '15:00'),
      origen: 'decision',
      decisionId: 'D01',
      repuestoId: 'compresor-2hp',
    });
    expect(enRiesgo).toEqual(['T16', 'T17', 'T18']);
    expect(t('T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31', fechaSolucion: enCR('2026-11-25', '15:00') });
    expect(t('T31')).toMatchObject({ estado: 'en_curso', plazo: enCR('2026-11-25', '15:00') });
    expect([t('T04').plazo, t('T05').plazo, t('T13').plazo]).toEqual([
      enCR('2026-11-25', '17:00'),
      enCR('2026-11-26', '17:00'),
      enCR('2026-11-30', '17:00'),
    ]);

    const evs = await demo.ctx.db.select().from(eventos);
    expect(evs.find((e) => e.tipo === 'decision_aprobada')).toMatchObject({ actorId: 'marcela-solis', decisionId: 'D01' });
    const mario = (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === 'mario-chaves' && a.titulo.startsWith('D01'));
    expect(mario).toHaveLength(1);
    expect(mario[0]?.trabajoIds).toEqual(['T05', 'T11']);
    const d = await obtenerDecision(demo.ctx, 'D01');
    expect(d).toMatchObject({ estado: 'aprobada', opcionElegida: 'A', decididaEn: enCR('2026-11-25', '08:12') });
    // Ningún trabajo para servicio al cliente: A no cambia fechas.
    expect((await estado()).inst.trabajos.filter((x) => x.decisionId === 'D01').map((x) => x.id)).toEqual(['T32']);
  });

  it('variante B: fechas de la contradicción resuelta 1 y trabajo para Sofía de avisar a los clientes', async () => {
    const res = await aprobarDecision(demo.ctx, 'D01', 'B', 'marcela-solis');
    const { t, enRiesgo } = await estado();
    expect(t('T04')).toMatchObject({ estado: 'bloqueado', plazo: enCR('2026-12-01', '17:00'), fechaSolucion: enCR('2026-12-01', '07:00') });
    expect(t('T05').plazo).toEqual(enCR('2026-12-02', '17:00'));
    expect(t('T06').plazo).toEqual(enCR('2026-12-03', '17:00'));
    expect(t('T07').plazo).toEqual(enCR('2026-12-03', '17:00'));
    expect(t('T10').plazo).toEqual(enCR('2026-12-01', '17:00'));
    expect(t('T11').plazo).toEqual(enCR('2026-12-01', '17:00'));
    expect(t('T13').plazo).toEqual(enCR('2026-12-03', '17:00'));
    for (const id of SEIS) expect(enRiesgo).not.toContain(id);

    const sofia = res.trabajosCreados.map(t).find((x) => x.responsableId === 'sofia-navarro');
    expect(sofia).toMatchObject({
      titulo: 'Avisar del atraso a Supermercado La Colina y Panadería Trigal',
      plazo: enCR('2026-11-25', '17:00'),
      origen: 'decision',
    });
    expect(t(res.trabajosCreados[0]!)).toMatchObject({ titulo: 'Comprar 3 compresores de 2 HP al proveedor habitual', plazo: enCR('2026-12-01', '07:00') });
    const plazos = (await demo.ctx.db.select().from(eventos)).filter((e) => e.tipo === 'plazo_cambiado' && SEIS.includes(e.trabajoId ?? ''));
    expect(plazos.every((e) => e.actorId === 'marcela-solis')).toBe(true);
    expect(plazos).toHaveLength(6);
  });

  it('variante C: La Colina a tiempo (T04 solución hoy 15:00); Cartago y Curridabat al 1-dic', async () => {
    await aprobarDecision(demo.ctx, 'D01', 'C', 'marcela-solis');
    const { t } = await estado();
    expect(t('T04')).toMatchObject({ plazo: enCR('2026-11-25', '17:00'), fechaSolucion: enCR('2026-11-25', '15:00') });
    expect(t('T10').plazo).toEqual(enCR('2026-12-01', '17:00'));
    expect(t('T13').plazo).toEqual(enCR('2026-12-03', '17:00'));
    expect(t('T05').plazo).toEqual(enCR('2026-11-26', '17:00'));
  });

  it('rechazo: aviso a Lucía con el motivo; nada se ejecuta y las marcas no cambian', async () => {
    const antes = await estado();
    const accionesAntes = (await demo.ctx.db.select().from(acciones)).length;
    const res = await rechazarDecision(demo.ctx, 'D01', 'marcela-solis', 'Esperemos el conteo real');
    expect(res.avisosA).toEqual(['lucia-mora']);
    const despues = await estado();
    expect(despues.enRiesgo).toEqual(antes.enRiesgo);
    expect(despues.inst.trabajos).toEqual(antes.inst.trabajos);
    expect(despues.inst.necesidades).toEqual(antes.inst.necesidades);
    expect((await demo.ctx.db.select().from(acciones)).length).toBe(accionesAntes + 1);
    const aviso = (await demo.ctx.db.select().from(avisos)).find((a) => a.personaId === 'lucia-mora' && a.titulo.includes('rechazada'));
    expect(aviso?.cuerpo).toContain('Esperemos el conteo real');
    expect(await obtenerDecision(demo.ctx, 'D01')).toMatchObject({ estado: 'rechazada', motivoRechazo: 'Esperemos el conteo real' });
    expect((await demo.ctx.db.select().from(eventos)).find((e) => e.tipo === 'decision_rechazada')?.actorId).toBe('marcela-solis');
  });

  it('solo el decisor y solo si está pendiente; rechazar exige motivo', async () => {
    await expect(aprobarDecision(demo.ctx, 'D01', 'A', 'andres-vargas')).rejects.toBeInstanceOf(ErrorDominio);
    await expect(rechazarDecision(demo.ctx, 'D01', 'marcela-solis', '  ')).rejects.toBeInstanceOf(ErrorDominio);
    await aprobarDecision(demo.ctx, 'D01', 'A', 'marcela-solis');
    await expect(aprobarDecision(demo.ctx, 'D01', 'B', 'marcela-solis')).rejects.toBeInstanceOf(ErrorDominio);
    await expect(aprobarDecision(demo.ctx, 'D09', 'A', 'marcela-solis')).rejects.toBeInstanceOf(ErrorDominio);
    expect((await estado()).inst.trabajos.filter((x) => x.decisionId === 'D01')).toHaveLength(1);
  });
});
