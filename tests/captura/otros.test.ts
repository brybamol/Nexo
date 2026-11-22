// Frases de control C04 (duplicado), C06 (pregunta de cantidad) y C07 (no es trabajo); validación y contexto (puros);
// y el cableado de captura con decisiones (3.3) y preguntas (4.3). Tarea 2.3.
// C11 y la respuesta de C06 se prueban en tests/captura/decisiones.test.ts (3.3); C13 en tests/preguntar (4.3).
// Aquí efectosDecisionNueva, registrarRespuesta y preguntar se envuelven con vi.fn que llama a la implementación real:
// solo se simulan en las pruebas de cableado, así el resto vale con los esqueletos y con las piezas completas.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acciones, capturas, decisiones, eventos, trabajos } from '@/db/esquema';
import { enCR } from '@/dominio/tiempo';
import type { Decision } from '@/dominio/tipos';
import { construirContextoCaptura } from '@/ia/contexto';
import type { Interpretacion } from '@/ia/interprete';
import { efectosDecisionNueva } from '@/motor/decision';
import { registrarRespuesta } from '@/motor/seguimiento';
import { capturar, responderCaptura } from '@/servicios/captura';
import { preguntar } from '@/servicios/preguntar';
import { validarInterpretacion } from '@/servicios/validacion';
import { instantaneaDesdeSemilla, prepararDemo, type Demo } from '../ayudantes/preparar';

vi.mock('@/motor/decision', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/decision')>();
  return { ...real, efectosDecisionNueva: vi.fn(real.efectosDecisionNueva) };
});
vi.mock('@/motor/seguimiento', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/motor/seguimiento')>();
  return { ...real, registrarRespuesta: vi.fn(real.registrarRespuesta) };
});
vi.mock('@/servicios/preguntar', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/servicios/preguntar')>();
  return { ...real, preguntar: vi.fn(real.preguntar) };
});

const C01 = 'No puedo terminar la instalación en La Colina, falta el compresor de 2 HP';
const C04 = 'Hay que mandarle la cotización de la cámara fría al Hotel Mirador hoy';
const C06 = 'El proveedor subió el precio de los empaques un 12 %, ¿compramos igual?';
const C07 = 'Gracias a todos, buen trabajo ayer';
const C11 = 'No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local';
const C13 = '¿Cómo vamos con los pedidos de la semana?';

describe('frases de control (captura a las 7:05)', () => {
  let demo: Demo;
  beforeEach(async () => {
    demo = await prepararDemo();
  });
  afterEach(async () => {
    await demo.cerrar();
    vi.mocked(efectosDecisionNueva).mockClear();
    vi.mocked(registrarRespuesta).mockClear();
    vi.mocked(preguntar).mockClear();
  });
  const contar = async () => ({
    trabajos: (await demo.ctx.db.select().from(trabajos)).length,
    decisiones: (await demo.ctx.db.select().from(decisiones)).length,
    acciones: (await demo.ctx.db.select().from(acciones)).length,
    eventos: (await demo.ctx.db.select().from(eventos)).length,
  });

  it('C04 · Paola: duplicado de T28; no crea nada y lo muestra', async () => {
    const antes = await contar();
    const r = await capturar(demo.ctx, 'paola-herrera', C04);
    expect(r).toMatchObject({ estado: 'duplicado', trabajoId: 'T28', titulo: 'Enviar cotización de cámara fría a Hotel Mirador' });
    expect(await contar()).toEqual(antes);
    expect(antes.trabajos).toBe(30);
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, r.capturaId));
    expect(c?.estado).toBe('duplicado');
  });

  it('C06 · Karla: pregunta cuántos metros; 0 trabajos y 0 decisiones', async () => {
    const r = await capturar(demo.ctx, 'karla-jimenez', C06);
    expect(r.estado).toBe('pregunta');
    if (r.estado !== 'pregunta') return;
    expect(r.pregunta).toContain('metros');
    expect(await contar()).toEqual({ trabajos: 30, decisiones: 0, acciones: 0, eventos: 3 }); // los 3 de la semilla
    expect(vi.mocked(efectosDecisionNueva)).not.toHaveBeenCalled();
  });

  it('C07 · Esteban: ignorada; 30 trabajos y 0 acciones', async () => {
    const r = await capturar(demo.ctx, 'esteban-castro', C07);
    expect(r.estado).toBe('ignorada');
    if (r.estado !== 'ignorada') return;
    expect(r.motivo).toBeTruthy();
    expect(await contar()).toEqual({ trabajos: 30, decisiones: 0, acciones: 0, eventos: 3 }); // los 3 de la semilla
  });

  it('un texto vacío o un autor inexistente no cambian nada', async () => {
    expect((await capturar(demo.ctx, 'jose-alfaro', '   ')).estado).toBe('error');
    await expect(capturar(demo.ctx, 'nadie', C01)).rejects.toThrow('nadie');
    expect((await contar()).trabajos).toBe(30);
  });

  it('cableado C06 → respuesta: la cantidad completa la propuesta y la decisión la prepara motor/decision', async () => {
    const p = await capturar(demo.ctx, 'karla-jimenez', C06);
    expect((await responderCaptura(demo.ctx, p.capturaId, 'tres')).estado).toBe('error'); // sin número: sigue la pregunta
    vi.mocked(efectosDecisionNueva).mockImplementationOnce((inst, prop, proponenteId, proyectoId, capturaId) => {
      const decision: Decision = {
        id: 'D01',
        creadaEn: inst.ahora,
        proyectoId,
        numero: 1,
        proponenteId,
        decisorId: 'andres-vargas',
        capturaId,
        repuestoId: prop.repuestoId,
        cantidad: prop.cantidad,
        contexto: 'prueba',
        afectados: { trabajoIds: [], personaIds: [] },
        opcionPropuesta: null,
        estado: 'pendiente',
        opcionElegida: null,
        decididaEn: null,
        motivoRechazo: null,
        opciones: [],
      };
      return [{ tipo: 'crear_decision', decision }];
    });
    const r = await responderCaptura(demo.ctx, p.capturaId, '20');
    expect(vi.mocked(efectosDecisionNueva)).toHaveBeenCalledWith(
      expect.anything(),
      { repuestoId: 'empaque-puerta', cantidad: 20, proveedor: null, ajustePrecioPct: 12, existenciaReal: null },
      'karla-jimenez',
      'P3',
      p.capturaId,
    );
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01', trabajosCreados: [] });
    const [d] = await demo.ctx.db.select().from(decisiones);
    expect(d).toMatchObject({ id: 'D01', proyectoId: 'P3', capturaId: p.capturaId });
  });

  it('cableado: si motor/decision no prepara la decisión, se dice y no se cambia nada', async () => {
    const p = await capturar(demo.ctx, 'karla-jimenez', C06);
    vi.mocked(efectosDecisionNueva).mockReturnValueOnce([]);
    const r = await responderCaptura(demo.ctx, p.capturaId, '20');
    expect(r.estado).toBe('error');
    expect(await contar()).toEqual({ trabajos: 30, decisiones: 0, acciones: 0, eventos: 3 }); // los 3 de la semilla
    const [c] = await demo.ctx.db.select().from(capturas).where(eq(capturas.id, p.capturaId));
    expect(c?.estado).toBe('pregunta');
  });

  it('cableado C11 tras C01: la decisión relacionada con T31 responde a su seguimiento', async () => {
    await capturar(demo.ctx, 'jose-alfaro', C01);
    vi.mocked(efectosDecisionNueva).mockImplementationOnce((inst, prop, proponenteId, proyectoId, capturaId) => [
      {
        tipo: 'crear_decision',
        decision: {
          id: 'D01',
          creadaEn: inst.ahora,
          proyectoId,
          numero: 1,
          proponenteId,
          decisorId: 'marcela-solis',
          capturaId,
          repuestoId: prop.repuestoId,
          cantidad: prop.cantidad,
          contexto: 'prueba',
          afectados: { trabajoIds: [], personaIds: [] },
          opcionPropuesta: 'A',
          estado: 'pendiente',
          opcionElegida: null,
          decididaEn: null,
          motivoRechazo: null,
          opciones: [],
        },
      },
    ]);
    const r = await capturar(demo.ctx, 'lucia-mora', C11);
    expect(vi.mocked(efectosDecisionNueva).mock.calls[0]?.[1]).toEqual({
      repuestoId: 'compresor-2hp',
      cantidad: 3,
      proveedor: 'local',
      ajustePrecioPct: null,
      existenciaReal: 0,
    });
    expect(vi.mocked(registrarRespuesta)).toHaveBeenCalledWith(expect.anything(), 'T31', 'lucia-mora');
    expect(r).toMatchObject({ estado: 'aplicada', decisionId: 'D01' });
  });

  it('cableado C13: una pregunta va a servicios/preguntar y no crea trabajos', async () => {
    const respuesta = {
      texto: 'De 7 pedidos…',
      tema: 'pedidos_semana' as const,
      fuentes: [],
      datos: {},
      ia: { implementacion: 'local' as const, modelo: null, respaldo: false },
    };
    vi.mocked(preguntar).mockResolvedValueOnce(respuesta);
    const r = await capturar(demo.ctx, 'marcela-solis', C13);
    expect(vi.mocked(preguntar)).toHaveBeenCalledWith(demo.ctx, 'marcela-solis', C13);
    expect(r).toMatchObject({ estado: 'respuesta', respuesta });
    expect((await contar()).trabajos).toBe(30);
  });
});

describe('validarInterpretacion (puro)', () => {
  const inst = instantaneaDesdeSemilla();
  const nuevo = (p: Partial<Extract<Interpretacion, { tipo: 'trabajo_nuevo' }>> = {}): Interpretacion => ({
    tipo: 'trabajo_nuevo',
    titulo: 'Algo',
    proyectoId: 'P1',
    responsableId: 'lucia-mora',
    responsableSeguro: true,
    plazo: { dia: 'hoy' },
    urgente: false,
    conCostoProbable: false,
    relacionados: [],
    bloquea: [],
    repuestoFaltante: null,
    ...p,
  });

  it('resuelve el plazo con inst.ahora', () => {
    const v = validarInterpretacion(inst, nuevo({ urgente: true }), 'jose-alfaro');
    expect(v).toMatchObject({ tipo: 'plan', plan: { tipo: 'trabajo_nuevo', plazo: enCR('2026-11-25', '12:00') } });
  });

  it('ids inexistentes o trabajos resueltos son error, nunca se inventan', () => {
    expect(validarInterpretacion(inst, nuevo({ proyectoId: 'P9' }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ bloquea: ['T99'] }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ bloquea: ['T01'] }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ relacionados: ['T99'] }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ repuestoFaltante: { repuestoId: 'tornillo' } }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ plazo: { dia: '2026-02-31' } }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo({ plazo: { dia: 'pasado' } }), 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, nuevo(), 'nadie').tipo).toBe('error');
    const resuelto: Interpretacion = {
      tipo: 'actualizacion',
      trabajoId: 'T01',
      nuevoEstado: 'en_curso',
      nota: null,
      hayProblema: false,
      reprogramar: [],
      notasRelacionadas: [],
    };
    expect(validarInterpretacion(inst, resuelto, 'jose-alfaro').tipo).toBe('error');
    expect(validarInterpretacion(inst, { tipo: 'duplicado', trabajoId: 'T99' }, 'jose-alfaro').tipo).toBe('error');
  });

  it('R9: responsable inexistente → pregunta proponiendo al responsable del proyecto', () => {
    const v = validarInterpretacion(inst, nuevo({ responsableId: 'fantasma' }), 'jose-alfaro');
    expect(v.tipo).toBe('pregunta');
    if (v.tipo === 'pregunta') expect(v.opciones[0]?.valor).toBe('esteban-castro');
  });

  it('una sola pregunta por captura: la cantidad solo se pregunta en decisiones', () => {
    const d: Interpretacion = {
      tipo: 'decision',
      proyectoId: 'P3',
      resumen: 'x',
      compra: { repuestoId: 'termostato', cantidad: null, proveedor: null, ajustePrecioPct: null },
      existenciaReal: null,
      trabajoRelacionadoId: null,
    };
    const v = validarInterpretacion(inst, d, 'karla-jimenez');
    expect(v).toMatchObject({ tipo: 'pregunta', opciones: [] });
    if (v.tipo === 'pregunta') expect(v.texto).toContain('unidades');
  });
});

describe('construirContextoCaptura (puro)', () => {
  it('lleva los 22 trabajos no resueltos con bloqueante y repuesto, y fechas ISO de Costa Rica', () => {
    const inst = instantaneaDesdeSemilla();
    const ctx = construirContextoCaptura(inst, 'jose-alfaro');
    expect(ctx.ahora).toBe('2026-11-25T07:00:00-06:00');
    expect(ctx.autor).toEqual({ id: 'jose-alfaro', nombre: 'José Alfaro', rol: 'Técnico', area: 'Campo' });
    expect(ctx.personas).toHaveLength(12);
    expect(ctx.personas.find((p) => p.id === 'jose-alfaro')?.jefeId).toBe('esteban-castro');
    expect(ctx.proyectos.map((p) => p.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'OD']);
    expect(ctx.trabajosAbiertos).toHaveLength(22);
    const ids = ctx.trabajosAbiertos.map((t) => t.id);
    for (const id of ['T04', 'T12', 'T21', 'T22', 'T26', 'T27', 'T28', 'T29']) expect(ids).toContain(id);
    expect(ids).not.toContain('T01');
    expect(ctx.trabajosAbiertos.find((t) => t.id === 'T04')).toEqual({
      id: 'T04',
      referencia: 'COLINA-4',
      titulo: 'Instalar unidad condensadora y compresor',
      proyectoId: 'P1',
      responsableId: 'jose-alfaro',
      estado: 'en_curso',
      plazo: '2026-11-25T17:00:00-06:00',
      bloqueadoPorId: null,
      repuestoId: null,
    });
    expect(ctx.repuestos.find((r) => r.id === 'compresor-2hp')?.existencia).toBe(3);
    expect(ctx.seguimientosPendientesDelAutor).toEqual([]);
  });

  it('seguimientosPendientesDelAutor: solo los pendientes dirigidos al autor', () => {
    const inst = instantaneaDesdeSemilla();
    const base = {
      plazoReferencia: inst.ahora,
      nivel: 0 as const,
      urgente: false,
      proximoEn: inst.ahora,
      iniciadoEn: inst.ahora,
      escaladosA: [],
    };
    inst.seguimientos = [
      { ...base, id: 'S1', trabajoId: 'T28', destinatarioId: 'paola-herrera', estado: 'pendiente' },
      { ...base, id: 'S2', trabajoId: 'T24', destinatarioId: 'paola-herrera', estado: 'respondido' },
      { ...base, id: 'S3', trabajoId: 'T21', destinatarioId: 'diego-rojas', estado: 'pendiente' },
    ];
    expect(construirContextoCaptura(inst, 'paola-herrera').seguimientosPendientesDelAutor).toEqual(['T28']);
  });
});
