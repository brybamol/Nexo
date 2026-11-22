// Frases de control C11 y C06 con respuesta (§6.1 de docs/05), con el servicio real de captura. Tarea 3.3.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos, eventos, trabajos } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import { enCR } from '@/dominio/tiempo';
import { capturar, responderCaptura } from '@/servicios/captura';
import { obtenerDecision } from '@/servicios/decisiones';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

const C06 = 'El proveedor subió el precio de los empaques un 12 %, ¿compramos igual?';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';

describe('decisiones desde la captura (7:05, estado inicial)', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  it('C11 · Lucía: D01 para Marcela, existencia del compresor 0, A/B/C; nada se ejecuta (R6)', async () => {
    const r = await capturar(demo.ctx, 'lucia-mora', C11);
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01', trabajosCreados: [] });
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.repuestos.find((x) => x.id === 'compresor-2hp')?.existencia).toBe(0);
    const d = inst.decisiones[0];
    expect(d).toMatchObject({ id: 'D01', proyectoId: 'P1', proponenteId: 'lucia-mora', decisorId: 'marcela-solis', estado: 'pendiente', opcionPropuesta: 'A' });
    expect(d?.opciones.map((o) => [o.letra, o.costo])).toEqual([
      ['A', 1_380_000],
      ['B', 1_140_000],
      ['C', 1_220_000],
    ]);
    expect(d?.opciones[1]?.cambiosFecha.length).toBeGreaterThan(0);
    expect(d?.contexto).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    expect(d?.afectados.trabajoIds).toEqual(expect.arrayContaining(['T04', 'T05', 'T06', 'T07', 'T10', 'T11', 'T13']));
    expect((await demo.ctx.db.select().from(trabajos)).length).toBe(30);
    if (r.estado === 'aplicada') expect(r.avisosA).toEqual(['marcela-solis']);

    const tipos = (await demo.ctx.db.select().from(acciones)).map((a) => a.tipo).sort();
    expect(tipos).toEqual(['aviso', 'corregir_existencia', 'crear_decision']);
    const evs = (await demo.ctx.db.select().from(eventos)).map((e) => e.tipo);
    expect(evs).toEqual(expect.arrayContaining(['existencia_corregida', 'decision_creada']));
    const [aviso] = await demo.ctx.db.select().from(avisos);
    expect(aviso?.personaId).toBe('marcela-solis');
    expect(aviso?.cuerpo).toContain('₡1.380.000');

    const vista = await obtenerDecision(demo.ctx, 'D01');
    expect(vista?.opciones.map((o) => o.costoTexto)).toEqual(['₡1.380.000', '₡1.140.000', '₡1.220.000']);
    expect(vista?.decisor.nombre).toBe('Marcela Solís');
  });

  it('C11 dos veces: una sola decisión pendiente y un solo aviso a la decisora; la segunda dice que ya está D01', async () => {
    const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
    expect((await capturar(demo.ctx, 'jose-alfaro', C01)).estado).toBe('aplicada');
    const avisosMarcela = async () => (await demo.ctx.db.select().from(avisos)).filter((a) => a.personaId === 'marcela-solis');
    expect(await capturar(demo.ctx, 'lucia-mora', C11)).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
    const accionesAntes = (await demo.ctx.db.select().from(acciones)).length;
    expect(await avisosMarcela()).toHaveLength(1);

    const r = await capturar(demo.ctx, 'lucia-mora', C11);
    expect(r.estado).toBe('error');
    if (r.estado === 'error') {
      expect(r.mensaje).toContain('«Compra de 3 compresores de 2 HP» (COLINA-D1)'); // D01
      expect(r.mensaje).toContain('No creé nada');
    }
    const inst = await cargarInstantanea(demo.ctx.db);
    expect(inst.decisiones.map((d) => [d.id, d.estado])).toEqual([['D01', 'pendiente']]);
    expect(await avisosMarcela()).toHaveLength(1);
    expect(await demo.ctx.db.select().from(acciones)).toHaveLength(accionesAntes);
  });

  it('C06 con respuesta «20» · Karla: D01 en P3 para Andrés; A ₡84.000 hoy 15:00, B ₡78.400 sáb 28 07:00; sin C ni cambios', async () => {
    const q = await capturar(demo.ctx, 'karla-jimenez', C06);
    expect(q.estado).toBe('pregunta');
    const r = await responderCaptura(demo.ctx, q.capturaId, '20');
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
    const d = (await cargarInstantanea(demo.ctx.db)).decisiones[0];
    expect(d).toMatchObject({ proyectoId: 'P3', decisorId: 'andres-vargas', cantidad: 20, opcionPropuesta: null });
    expect(d?.opciones).toHaveLength(2);
    expect(d?.opciones[0]).toMatchObject({ letra: 'A', costo: 84_000, cambiosFecha: [] });
    expect(d?.opciones[0]?.lineas[0]).toMatchObject({ proveedor: 'local', cantidad: 20, precioUnitario: 4_200, llegada: enCR('2026-11-25', '15:00') });
    expect(d?.opciones[1]).toMatchObject({ letra: 'B', costo: 78_400, cambiosFecha: [] });
    expect(d?.opciones[1]?.lineas[0]).toMatchObject({ proveedor: 'habitual', cantidad: 20, precioUnitario: 3_920, llegada: enCR('2026-11-28', '07:00') });
    expect(d?.opciones[0]?.descripcion).toContain('20 metros de empaque de puerta');
    if (r.estado === 'aplicada') expect(r.avisosA).toEqual(['andres-vargas']);
  });
});
