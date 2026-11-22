// Frases de control de actualización (§6.1 de docs/05): C02, C03, C09, C14; y efectosActualizacion (puro). Tarea 2.3.
// Las aserciones no dependen de motor/seguimiento (3.1) ni de motor/propagacion (3.2): valen con sus esqueletos y completos.
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acciones, avisos, necesidadesRepuesto, notas, trabajos } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import type { PlanActualizacion, Seguimiento } from '@/dominio/tipos';
import type { Interpretacion } from '@/ia/interprete';
import { efectosActualizacion } from '@/motor/actualizacion';
import type { Efecto } from '@/motor/efectos';
import { capturar } from '@/servicios/captura';
import { aprobarDecision } from '@/servicios/decisiones';
import { cambiarEstado } from '@/servicios/estado-trabajos';
import { instantaneaDesdeSemilla, prepararDemo, type Demo } from '../ayudantes/preparar';

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C02 = 'Listo el mantenimiento de Escazú, Tibás queda para mañana';
const C03 = 'Mae, el cliente de Don Beto no estaba, me devolví con los congeladores';
const C09 = 'Todavía no entra el pago de La Colina por las vitrinas';
const C14 = 'Ya llegó el compresor, sigo con la instalación';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';

describe('frases de actualización (captura a las 7:05)', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });

  async function trabajo(id: string) {
    const [t] = await demo.ctx.db.select().from(trabajos).where(eq(trabajos.id, id));
    if (!t) throw new Error(`no existe ${id}`);
    return t;
  }
  const contarTrabajos = async () => (await demo.ctx.db.select().from(trabajos)).length;
  const notasDe = async (id: string) => demo.ctx.db.select().from(notas).where(eq(notas.trabajoId, id));
  async function avisoPara(capturaId: number, personaId: string) {
    const [a] = await demo.ctx.db
      .select()
      .from(acciones)
      .where(and(eq(acciones.capturaId, capturaId), eq(acciones.destinatarioId, personaId)));
    if (!a) return null;
    const [av] = await demo.ctx.db.select().from(avisos).where(eq(avisos.accionId, a.id));
    return { accion: a, aviso: av ?? null };
  }

  it('C02 · Daniela: T12 pasa a en curso con nota; no crea trabajo ni avisa', async () => {
    const r = await capturar(demo.ctx, 'daniela-quesada', C02);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual([]);
    expect(r.trabajosActualizados).toEqual(['T12']);
    expect(r.avisosA).toEqual([]);
    expect((await trabajo('T12')).estado).toBe('en_curso');
    const ns = await notasDe('T12');
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ autorId: 'daniela-quesada', en: enCR('2026-11-25', '07:05') });
    expect(await contarTrabajos()).toBe(30);
    // R10: la actualización queda registrada con su motivo.
    const registro = (await demo.ctx.db.select().from(acciones)).find((a) => a.tipo === 'actualizar_trabajo');
    expect(registro).toMatchObject({ capturaId: r.capturaId, destinatarioId: null, trabajoIds: ['T12'] });
    expect(registro?.motivo).toBeTruthy();
  });

  it('C03 · Diego: nota con problema en T21; avisa solo a Sofía (T21 depende de T22)', async () => {
    const r = await capturar(demo.ctx, 'diego-rojas', C03);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual([]);
    expect(r.avisosA).toEqual(['sofia-navarro']);
    expect(await notasDe('T21')).toHaveLength(2); // la de la semilla (Diego, mar 24) y la de C03
    expect((await trabajo('T21')).estado).toBe('abierto');
    expect(await contarTrabajos()).toBe(30);
    const a = await avisoPara(r.capturaId, 'sofia-navarro');
    expect(a?.accion.tipo).toBe('aviso');
    expect(a?.aviso?.trabajoIds).toEqual(expect.arrayContaining(['T21', 'T22']));
  });

  it('C09 · Ricardo: nota en T27; avisa solo a Andrés (responsable de P4) con T26 y T27', async () => {
    const r = await capturar(demo.ctx, 'ricardo-brenes', C09);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.avisosA).toEqual(['andres-vargas']);
    expect(await notasDe('T27')).toHaveLength(1);
    expect(await contarTrabajos()).toBe(30);
    const a = await avisoPara(r.capturaId, 'andres-vargas');
    expect([...(a?.aviso?.trabajoIds ?? [])].sort()).toEqual(['T26', 'T27']);
    expect(a?.aviso?.cuerpo).toContain('«Entregar pedido 1047 · 3 vitrinas · Supermercado La Colina» (PEDIDOS-8)'); // T26
  });

  it('C14 · José tras C01: T31 resuelto, T04 en curso sin bloqueante, necesidad atendida; avisa solo a Mario por T05', async () => {
    const c01 = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(c01.estado).toBe('aplicada');
    const r = await capturar(demo.ctx, 'jose-alfaro', C14);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual([]);
    expect(r.trabajosActualizados).toEqual(expect.arrayContaining(['T31', 'T04']));
    expect(r.avisosA).toEqual(['mario-chaves']);

    const t31 = await trabajo('T31');
    expect(t31.estado).toBe('resuelto');
    expect(t31.resueltoEn).toEqual(enCR('2026-11-25', '07:05'));
    const t04 = await trabajo('T04');
    expect(t04).toMatchObject({ estado: 'en_curso', bloqueadoPorId: null, fechaSolucion: null, motivoBloqueo: null });
    const [necesidad] = await demo.ctx.db
      .select()
      .from(necesidadesRepuesto)
      .where(and(eq(necesidadesRepuesto.trabajoId, 'T04'), eq(necesidadesRepuesto.repuestoId, 'compresor-2hp')));
    expect(necesidad?.atendida).toBe(true);
    const a = await avisoPara(r.capturaId, 'mario-chaves');
    expect(a?.aviso?.trabajoIds).toEqual(['T05']);
    expect(await contarTrabajos()).toBe(31);
  });

  it('tras C01, «sigo con T04» (en curso) no desbloquea T04: lo dice el resultado y al aprobar la compra T04 recibe su fecha de solución', async () => {
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const interp: Interpretacion = {
      tipo: 'actualizacion',
      trabajoId: 'T04',
      nuevoEstado: 'en_curso',
      nota: 'Sigo con lo que puedo.',
      hayProblema: false,
      reprogramar: [],
      notasRelacionadas: [],
    };
    // Un intérprete que propone esa actualización (como podría hacerlo Claude); el resto, el Local.
    const ia = Object.assign(Object.create(demo.ctx.ia) as typeof demo.ctx.ia, {
      interpretar: async () => ({ valor: interp, implementacion: 'local' as const, modelo: null, respaldo: false }),
    });
    const r = await capturar({ ...demo.ctx, ia }, 'jose-alfaro', 'sigo con T04');
    expect(r.estado).toBe('aplicada');
    if (r.estado === 'aplicada') {
      expect(r.resumen).toContain('«Instalar unidad condensadora y compresor» (COLINA-4) sigue bloqueado por «Conseguir compresor de 2 HP» (COLINA-8)'); // T04 por T31
      expect(r.avisosA).toEqual([]);
    }
    expect(await trabajo('T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    expect(await notasDe('T04')).toHaveLength(1);

    // Lo mismo desde la interfaz.
    await cambiarEstado(demo.ctx, 'T04', 'jose-alfaro', 'en_curso');
    expect(await trabajo('T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });

    await capturar(demo.ctx, 'lucia-mora', C11);
    await aprobarDecision(demo.ctx, 'D01', 'A', 'marcela-solis');
    expect(await trabajo('T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31', fechaSolucion: enCR('2026-11-25', '15:00') });
  });

  it('C14 sin C01 no inventa: no hay bloqueante del compresor y no cambia nada', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C14);
    expect(r.estado).not.toBe('aplicada');
    expect((await trabajo('T04')).estado).toBe('en_curso');
    expect(await contarTrabajos()).toBe(30);
  });
});

describe('efectosActualizacion (puro)', () => {
  const plan = (p: Partial<PlanActualizacion> & { trabajoId: string }): PlanActualizacion => ({
    tipo: 'actualizacion',
    nuevoEstado: null,
    nota: null,
    hayProblema: false,
    reprogramar: [],
    notasRelacionadas: [],
    ...p,
  });
  const avisosDe = (efs: Efecto[]) =>
    efs.flatMap((e) => (e.tipo === 'accion' && e.aviso ? [{ a: e.accion.destinatarioId, ids: e.aviso.trabajoIds }] : []));

  it('E5: Sofía resuelve T22 y mueve T21: un solo aviso a Diego; la nota en T29 no avisa', () => {
    const inst = instantaneaDesdeSemilla();
    inst.ahora = enCR('2026-11-25', '09:30');
    const jueves = enCR('2026-11-26', '12:00');
    const efs = efectosActualizacion(
      inst,
      plan({
        trabajoId: 'T22',
        nuevoEstado: 'resuelto',
        nota: 'Don Beto recibe mañana jueves en la mañana.',
        reprogramar: [{ trabajoId: 'T21', plazo: jueves }],
        notasRelacionadas: [{ trabajoId: 'T29', nota: 'Incluir a Don Beto en la ruta del jueves.' }],
      }),
      'sofia-navarro',
    );
    expect(efs).toContainEqual({
      tipo: 'actualizar_trabajo',
      trabajoId: 'T22',
      cambios: { estado: 'resuelto', resueltoEn: inst.ahora },
      actorId: 'sofia-navarro',
    });
    expect(efs).toContainEqual({ tipo: 'actualizar_trabajo', trabajoId: 'T21', cambios: { plazo: jueves }, actorId: 'sofia-navarro' });
    expect(efs.filter((e) => e.tipo === 'agregar_nota').map((e) => e.tipo === 'agregar_nota' && e.trabajoId)).toEqual(['T22', 'T29']);
    expect(avisosDe(efs)).toEqual([{ a: 'diego-rojas', ids: ['T21'] }]);
  });

  it('regla 7: el responsable que mueve su propio plazo no se avisa a sí mismo', () => {
    const inst = instantaneaDesdeSemilla();
    const efs = efectosActualizacion(
      inst,
      plan({ trabajoId: 'T21', nota: 'Paso el jueves.', reprogramar: [{ trabajoId: 'T21', plazo: enCR('2026-11-26', '12:00') }] }),
      'diego-rojas',
    );
    expect(avisosDe(efs)).toEqual([]);
  });

  it('resolver un trabajo cierra sus seguimientos pendientes', () => {
    const inst = instantaneaDesdeSemilla();
    const s: Seguimiento = {
      id: 'S1',
      trabajoId: 'T28',
      plazoReferencia: enCR('2026-11-25', '12:00'),
      nivel: 0,
      destinatarioId: 'paola-herrera',
      urgente: false,
      proximoEn: enCR('2026-11-25', '16:00'),
      estado: 'pendiente',
      iniciadoEn: enCR('2026-11-25', '12:00'),
      escaladosA: [],
    };
    inst.seguimientos = [s];
    const efs = efectosActualizacion(inst, plan({ trabajoId: 'T28', nuevoEstado: 'resuelto', nota: 'Ya la envié.' }), 'paola-herrera');
    const cierres = efs.filter((e) => e.tipo === 'actualizar_seguimiento' && e.seguimientoId === 'S1');
    expect(cierres.length).toBeGreaterThanOrEqual(1);
    expect(avisosDe(efs)).toEqual([]);
    // Ninguna acción de seguimiento sobre T28 (nadie escala).
    expect(efs.some((e) => e.tipo === 'accion' && ['recordatorio', 'escalamiento'].includes(e.accion.tipo))).toBe(false);
  });

  it('las acciones salen sin captura (aplicar la pone) y con hecho de origen', () => {
    const efs = efectosActualizacion(instantaneaDesdeSemilla(), plan({ trabajoId: 'T27', nota: 'Sin pago.', hayProblema: true }), 'ricardo-brenes');
    const accs = efs.flatMap((e) => (e.tipo === 'accion' ? [e.accion] : []));
    expect(accs.map((a) => a.tipo)).toEqual(['actualizar_trabajo', 'aviso']);
    for (const a of accs) {
      expect(a.capturaId).toBeNull();
      expect(a.hechoOrigen).toContain('Ricardo Brenes');
    }
  });
});

describe('referencias escritas en la captura (reforma de nombres)', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
  });
  const trabajo = async (id: string) => (await demo.ctx.db.select().from(trabajos).where(eq(trabajos.id, id)))[0];

  it('«sigo con COLINA-4» (intérprete Local) se resuelve como T04, igual que antes el id interno', async () => {
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const r = await capturar(demo.ctx, 'jose-alfaro', 'sigo con COLINA-4');
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosActualizados).toEqual(['T04']);
    expect(r.resumen).toContain('«Instalar unidad condensadora y compresor» (COLINA-4) sigue bloqueado por «Conseguir compresor de 2 HP» (COLINA-8)');
    expect(await trabajo('T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    const ns = await demo.ctx.db.select().from(notas).where(eq(notas.trabajoId, 'T04'));
    expect(ns.map((n) => n.texto)).toEqual(['Sigo con COLINA-4']);
  });

  it('en minúsculas y para cerrar: «ya quedó pedidos-10» resuelve T28', async () => {
    const r = await capturar(demo.ctx, 'paola-herrera', 'ya quedó pedidos-10');
    expect(r).toMatchObject({ estado: 'aplicada', trabajosActualizados: ['T28'] });
    expect(await trabajo('T28')).toMatchObject({ estado: 'resuelto' });
  });

  it('el id interno escrito también se entiende, pero la respuesta nunca lo muestra', async () => {
    const r = await capturar(demo.ctx, 'paola-herrera', 'ya quedó T28');
    expect(r).toMatchObject({ estado: 'aplicada', trabajosActualizados: ['T28'] });
    if (r.estado === 'aplicada') {
      expect(r.resumen).toContain('«Enviar cotización de cámara fría a Hotel Mirador» (PEDIDOS-10)');
      expect(r.resumen).not.toMatch(/T28/);
    }
  });

  it('si la IA propone la referencia en lugar del id, la validación la traduce al id interno', async () => {
    const interp: Interpretacion = {
      tipo: 'actualizacion',
      trabajoId: 'PEDIDOS-10',
      nuevoEstado: 'en_curso',
      nota: null,
      hayProblema: false,
      reprogramar: [],
      notasRelacionadas: [],
    };
    const ia = Object.assign(Object.create(demo.ctx.ia) as typeof demo.ctx.ia, {
      interpretar: async () => ({ valor: interp, implementacion: 'claude' as const, modelo: 'prueba', respaldo: false }),
    });
    const r = await capturar({ ...demo.ctx, ia }, 'paola-herrera', 'arranqué con la cotización');
    expect(r).toMatchObject({ estado: 'aplicada', trabajosActualizados: ['T28'] });
    expect(await trabajo('T28')).toMatchObject({ estado: 'en_curso' });
  });

  it('una referencia que no existe no se aplica a ningún trabajo', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', 'sigo con COLINA-99');
    expect(r.estado).not.toBe('aplicada');
    expect(await trabajo('T04')).toMatchObject({ estado: 'en_curso' });
  });
});
