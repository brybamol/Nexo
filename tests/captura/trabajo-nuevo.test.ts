// Frases de control de trabajo nuevo (§6.1 de docs/05): C01, C05, C08, C10, C12, C15. Tarea 2.3.
// Captura a las 7:05 sobre el estado inicial, cada una aislada. Se comprueba lo que es responsabilidad de captura;
// la propagación (3.2) y el seguimiento (3.1) se comprueban por su CABLEADO: las funciones del motor se envuelven
// con vi.fn que llaman a la implementación real, así las aserciones valen con los esqueletos y con el motor completo.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acciones, avisos, capturas, eventos, repuestos, seguimientos, trabajos } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import { efectosBloqueo } from '@/motor/propagacion';
import { iniciarSeguimientoUrgente } from '@/motor/seguimiento';
import { capturar, responderCaptura } from '@/servicios/captura';
import { prepararDemo, type Demo } from '../ayudantes/preparar';

vi.mock('@/motor/propagacion', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/propagacion')>();
  return { ...real, efectosBloqueo: vi.fn(real.efectosBloqueo) };
});
vi.mock('@/motor/seguimiento', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/seguimiento')>();
  return { ...real, iniciarSeguimientoUrgente: vi.fn(real.iniciarSeguimientoUrgente) };
});

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C05 = 'La Colina pregunta si se puede adelantar la entrega de las vitrinas al jueves';
const C08 = 'Ocupo una escalera de 6 metros para el jueves en Curridabat';
const C10 = 'Alguien tiene que revisar el camión, hace un ruido raro';
const C12 = 'En Cartago el cliente quiere que también le revisemos el aire acondicionado';
const C15 = 'Se cayó una vitrina del pedido 1045 en bodega, quedó con el vidrio quebrado';

const MIE = '2026-11-25';
let demo: Demo;

beforeEach(async () => {
  demo = await prepararDemo();
});
afterEach(async () => {
  await demo.cerrar();
  vi.mocked(efectosBloqueo).mockClear();
  vi.mocked(iniciarSeguimientoUrgente).mockClear();
});

async function trabajo(id: string) {
  const [t] = await demo.ctx.db.select().from(trabajos).where(eq(trabajos.id, id));
  if (!t) throw new Error(`no existe ${id}`);
  return t;
}
const contarTrabajos = async () => (await demo.ctx.db.select().from(trabajos)).length;

describe('C01 · José: falta el compresor de 2 HP', () => {
  it('crea T31 en P1 para Lucía, pedido por José, plazo hoy 12:00, urgente, del compresor', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.ia).toEqual({ implementacion: 'local', modelo: null, respaldo: false });
    expect(r.trabajosCreados).toEqual(['T31']);
    expect(r.decisionId).toBeNull();
    expect(r.avisosA).toContain('lucia-mora');
    expect(r.trabajosActualizados).toContain('T04');

    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({
      proyectoId: 'P1',
      responsableId: 'lucia-mora',
      solicitadoPorId: 'jose-alfaro',
      estado: 'abierto',
      urgente: true,
      repuestoId: 'compresor-2hp',
      cantidadRepuesto: 1,
      origen: 'captura',
      capturaId: r.capturaId,
    });
    expect(t31.plazo).toEqual(enCR(MIE, '12:00'));
    expect(t31.creadoEn).toEqual(enCR(MIE, '07:05'));
    expect(await contarTrabajos()).toBe(31);
  });

  it('T04 queda bloqueado por T31 y el compresor reportado como faltante por José', async () => {
    await capturar(demo.ctx, 'jose-alfaro', C01);
    const t04 = await trabajo('T04');
    expect(t04.estado).toBe('bloqueado');
    expect(t04.bloqueadoPorId).toBe('T31');
    expect(t04.motivoBloqueo).toBeTruthy();
    const [compresor] = await demo.ctx.db.select().from(repuestos).where(eq(repuestos.id, 'compresor-2hp'));
    expect(compresor?.faltanteReportadoPor).toBe('jose-alfaro');
    expect(compresor?.faltanteReportadoEn).toEqual(enCR(MIE, '07:05'));
    expect(compresor?.existencia).toBe(3); // captura no corrige la existencia (eso es C11)

    // La propagación (R4, R5) es de motor/propagacion.ts: captura le pasa el hecho con el bloqueante ya creado.
    expect(vi.mocked(efectosBloqueo)).toHaveBeenCalledTimes(1);
    const [inst, hecho] = vi.mocked(efectosBloqueo).mock.calls[0]!;
    expect(inst.trabajos.some((t) => t.id === 'T31')).toBe(true);
    expect(hecho).toMatchObject({
      trabajoBloqueadoId: 'T04',
      bloqueanteId: 'T31',
      repuestoFaltanteId: 'compresor-2hp',
      autorId: 'jose-alfaro',
    });

    // Eventos derivados, uno por hecho y con José como actor.
    const evs = await demo.ctx.db.select().from(eventos).where(eq(eventos.actorId, 'jose-alfaro'));
    const tipos = evs.map((e) => `${e.tipo}:${e.trabajoId ?? ''}`);
    expect(tipos).toContain('trabajo_creado:T31');
    expect(tipos.filter((t) => t === 'estado_cambiado:T04')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'faltante_reportado:')).toHaveLength(1);
  });

  it('registra la creación con su motivo y avisa a Lucía (R10)', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    const filas = await demo.ctx.db.select().from(acciones);
    const creacion = filas.find((a) => a.tipo === 'crear_trabajo');
    expect(creacion).toMatchObject({ capturaId: r.capturaId, destinatarioId: null });
    expect(creacion?.trabajoIds).toContain('T31');
    expect(creacion?.motivo).toMatch(/T31/);
    expect(creacion?.hechoOrigen).toContain(C01);
    for (const a of filas) expect(a.capturaId).toBe(r.capturaId);

    const asignacion = filas.find((a) => a.tipo === 'aviso' && a.destinatarioId === 'lucia-mora');
    expect(asignacion?.trabajoIds).toEqual(['T31']);
    const [aviso] = await demo.ctx.db.select().from(avisos).where(eq(avisos.accionId, asignacion!.id));
    expect(aviso).toMatchObject({ personaId: 'lucia-mora', trabajoIds: ['T31'] });
    expect(aviso?.cuerpo).toContain('José Alfaro');
  });

  it('abre el seguimiento urgente de T31 con motor/seguimiento y persiste lo que devuelve', async () => {
    await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(vi.mocked(iniciarSeguimientoUrgente)).toHaveBeenCalledTimes(1);
    const [inst, id] = vi.mocked(iniciarSeguimientoUrgente).mock.calls[0]!;
    expect(id).toBe('T31');
    expect(inst.trabajos.find((t) => t.id === 'T31')?.urgente).toBe(true);
    const devueltos = vi.mocked(iniciarSeguimientoUrgente).mock.results[0]!.value as { tipo: string }[];
    const creados = devueltos.filter((e) => e.tipo === 'crear_seguimiento').length;
    expect(await demo.ctx.db.select().from(seguimientos)).toHaveLength(creados);
  });

  it.todo('C01: seguimiento de T31 nivel 0 con proximo_en 7:35 (lo produce iniciarSeguimientoUrgente, tarea 3.1)');

  it('la captura queda guardada como aplicada con su interpretación', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, r.capturaId));
    expect(c).toMatchObject({ autorId: 'jose-alfaro', texto: C01, estado: 'aplicada', implementacion: 'local' });
    expect(c?.interpretacion).toMatchObject({ tipo: 'trabajo_nuevo', proyectoId: 'P1' });
    expect(c?.resultado).toMatchObject({ estado: 'aplicada', trabajosCreados: ['T31'] });
  });

  it('si algo falla al persistir no queda nada a medias: se deshace todo y la captura queda como error', async () => {
    vi.mocked(efectosBloqueo).mockReturnValueOnce([
      { tipo: 'actualizar_trabajo', trabajoId: 'T99', cambios: { estado: 'bloqueado' }, actorId: 'jose-alfaro' },
    ]);
    const r = await capturar(demo.ctx, 'jose-alfaro', C01);
    expect(r.estado).toBe('error');
    expect(await contarTrabajos()).toBe(30);
    expect((await trabajo('T04')).estado).toBe('en_curso');
    expect(await demo.ctx.db.select().from(acciones)).toHaveLength(0);
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, r.capturaId));
    expect(c?.estado).toBe('error');
  });
});

describe('C05 · Sofía: La Colina quiere adelantar las vitrinas', () => {
  it('crea T31 en P4 para Andrés, hoy 17:00, no urgente, relacionado con T26 y T27; avisa solo a Andrés', async () => {
    const r = await capturar(demo.ctx, 'sofia-navarro', C05);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual(['T31']);
    expect(r.avisosA).toEqual(['andres-vargas']);
    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({ proyectoId: 'P4', responsableId: 'andres-vargas', solicitadoPorId: 'sofia-navarro', urgente: false });
    expect(t31.relacionados).toEqual(['T26', 'T27']);
    expect(t31.plazo).toEqual(enCR(MIE, '17:00'));
    expect((await trabajo('T26')).estado).toBe('abierto');
    expect(vi.mocked(efectosBloqueo)).not.toHaveBeenCalled();
    expect(vi.mocked(iniciarSeguimientoUrgente)).not.toHaveBeenCalled();
  });
});

describe('C08 · Mario: escalera de 6 metros para el jueves', () => {
  it('crea T31 en P2 para Lucía, plazo jue 26 07:00, relacionado con T11', async () => {
    const r = await capturar(demo.ctx, 'mario-chaves', C08);
    expect(r.estado).toBe('aplicada');
    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({ proyectoId: 'P2', responsableId: 'lucia-mora', relacionados: ['T11'], urgente: false });
    expect(t31.plazo).toEqual(enCR('2026-11-26', '07:00'));
  });
});

describe('C10 · Andrés: alguien tiene que revisar el camión', () => {
  it('pregunta primero quién (propone a Lucía) y no crea nada', async () => {
    const r = await capturar(demo.ctx, 'andres-vargas', C10);
    expect(r.estado).toBe('pregunta');
    if (r.estado !== 'pregunta') return;
    expect(r.opciones[0]?.valor).toBe('lucia-mora');
    expect(r.pregunta).toContain('Lucía Mora');
    expect(new Set(r.opciones.map((o) => o.valor)).size).toBe(r.opciones.length);
    expect(await contarTrabajos()).toBe(30);
    expect(await demo.ctx.db.select().from(acciones)).toHaveLength(0);
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, r.capturaId));
    expect(c).toMatchObject({ estado: 'pregunta', pregunta: r.pregunta });
  });

  it('con la respuesta lucia-mora crea T31 en OD para Lucía, plazo hoy 17:00, en la misma captura', async () => {
    const p = await capturar(demo.ctx, 'andres-vargas', C10);
    const r = await responderCaptura(demo.ctx, p.capturaId, 'lucia-mora');
    expect(r.capturaId).toBe(p.capturaId);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.trabajosCreados).toEqual(['T31']);
    expect(r.avisosA).toEqual(['lucia-mora']);
    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({ proyectoId: 'OD', responsableId: 'lucia-mora', solicitadoPorId: 'andres-vargas', capturaId: p.capturaId });
    expect(t31.plazo).toEqual(enCR(MIE, '17:00'));
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, p.capturaId));
    expect(c?.estado).toBe('aplicada');
  });

  it('una sola pregunta: una respuesta no válida no crea nada y la pregunta sigue abierta; responder dos veces falla', async () => {
    const p = await capturar(demo.ctx, 'andres-vargas', C10);
    const mala = await responderCaptura(demo.ctx, p.capturaId, 'nadie-conocido');
    expect(mala.estado).toBe('error');
    expect(await contarTrabajos()).toBe(30);
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, p.capturaId));
    expect(c?.estado).toBe('pregunta');

    expect((await responderCaptura(demo.ctx, p.capturaId, 'Lucía Mora')).estado).toBe('aplicada');
    expect((await responderCaptura(demo.ctx, p.capturaId, 'lucia-mora')).estado).toBe('error');
    expect(await contarTrabajos()).toBe(31);
  });
});

describe('C12 · Daniela: revisar el aire acondicionado en Cartago', () => {
  it('crea T31 en P2 para Paola, plazo vie 27 17:00', async () => {
    const r = await capturar(demo.ctx, 'daniela-quesada', C12);
    expect(r.estado).toBe('aplicada');
    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({ proyectoId: 'P2', responsableId: 'paola-herrera', urgente: false });
    expect(t31.plazo).toEqual(enCR('2026-11-27', '17:00'));
  });
});

describe('C15 · Diego: vitrina del pedido 1045 quebrada', () => {
  it('crea T31 urgente con costo probable en P4 para Lucía, plazo hoy 12:00; T24 bloqueado por T31', async () => {
    const r = await capturar(demo.ctx, 'diego-rojas', C15);
    expect(r.estado).toBe('aplicada');
    if (r.estado !== 'aplicada') return;
    expect(r.avisosA).toContain('lucia-mora');
    const t31 = await trabajo('T31');
    expect(t31).toMatchObject({ proyectoId: 'P4', responsableId: 'lucia-mora', urgente: true, conCostoProbable: true, repuestoId: null });
    expect(t31.plazo).toEqual(enCR(MIE, '12:00'));
    const t24 = await trabajo('T24');
    expect(t24).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    const sinFaltante = await demo.ctx.db.select().from(repuestos);
    expect(sinFaltante.every((x) => x.faltanteReportadoEn === null)).toBe(true);
  });
});

describe('R9 sin respuesta guardada', () => {
  it('una frase desconocida no crea un trabajo seguro: pregunta quién', async () => {
    const r = await capturar(demo.ctx, 'jose-alfaro', 'Hay una fuga de agua en el baño de la bodega');
    expect(r.estado).toBe('pregunta');
    if (r.estado !== 'pregunta') return;
    expect(r.opciones[0]?.valor).toBe('esteban-castro'); // el jefe del autor, que propuso la heurística
    expect(await contarTrabajos()).toBe(30);
  });
});
