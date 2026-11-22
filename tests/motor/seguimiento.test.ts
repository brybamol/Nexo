// Seguimiento y escalamiento (R1, R2, R3): motor puro sobre la instantánea de la semilla. Tarea 3.1.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Seguimiento, Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { iniciarSeguimientoUrgente, registrarRespuesta, siguienteEvento, tick } from '@/motor/seguimiento';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const JUE = '2026-11-26';

type Accion = Extract<Efecto, { tipo: 'accion' }>;

const enHora = (inst: Instantanea, ahora: Date): Instantanea => ({ ...inst, ahora });

/** Mueve el reloj a `ahora`, ejecuta tick y aplica sus efectos (lo que hace servicios/reloj.ts sin base). */
function mover(inst: Instantanea, ahora: Date): { inst: Instantanea; efectos: Efecto[] } {
  const enAhora = enHora(inst, ahora);
  const efectos = tick(enAhora);
  return { inst: aplicarEnMemoria(enAhora, efectos), efectos };
}

/** Como el botón «Siguiente evento», repetido mientras el siguiente evento no pase de `hasta`; al final va a `hasta`. */
function pasoAPaso(inicio: Instantanea, hasta: Date): { inst: Instantanea; efectos: Efecto[] } {
  const primero = mover(inicio, inicio.ahora); // lo ya vencido a la hora de partida
  let inst = primero.inst;
  const efectos: Efecto[] = [...primero.efectos];
  for (;;) {
    const sig = siguienteEvento(inst);
    if (!sig || sig.getTime() > hasta.getTime()) break;
    const r = mover(inst, sig);
    inst = r.inst;
    efectos.push(...r.efectos);
  }
  const r = mover(inst, hasta);
  efectos.push(...r.efectos);
  return { inst: r.inst, efectos };
}

const acciones = (efectos: Efecto[]): Accion[] => efectos.filter((e): e is Accion => e.tipo === 'accion');
const sobre = (efectos: Efecto[], trabajoId: string) => acciones(efectos).filter((a) => a.accion.trabajoIds.includes(trabajoId));
const resumen = (a: Accion) => ({ tipo: a.accion.tipo, a: a.accion.destinatarioId, trabajos: a.accion.trabajoIds });
const seguimientoDe = (inst: Instantanea, trabajoId: string): Seguimiento[] => inst.seguimientos.filter((s) => s.trabajoId === trabajoId);

/** Estado de la semilla tras el tick de las 7:05 (pide T15 y T21) y la captura C01: T31 urgente de Lucía, T04 bloqueado. */
function trasC01(): Instantanea {
  const base = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05')).inst;
  const t04 = base.trabajos.find((t) => t.id === 'T04') as Trabajo;
  const t31: Trabajo = {
    ...t04,
    id: 'T31',
    numero: 8, // siguiente número de P1: COLINA-8
    titulo: 'Conseguir un compresor de 2 HP para la cámara de La Colina',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR(MIE, '12:00'),
    estado: 'abierto',
    urgente: true,
    repuestoId: 'compresor-2hp',
    cantidadRepuesto: 1,
    origen: 'captura',
    capturaId: 1,
    creadoEn: enCR(MIE, '07:05'),
    resueltoEn: null,
  };
  const conT31 = aplicarEnMemoria(base, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: 'jose-alfaro' },
    { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor' }, actorId: 'jose-alfaro' },
  ]);
  return aplicarEnMemoria(conT31, iniciarSeguimientoUrgente(conT31, 'T31'));
}

describe('R1 · solicitud de estado al vencer el plazo', () => {
  it('el primer avance desde las 7:00 pide el estado de T15 y T21 (ya atrasados) una sola vez', () => {
    const inicio = instantaneaDesdeSemilla();
    expect(tick(inicio).filter((e) => e.tipo === 'accion').map((e) => resumen(e as Accion))).toEqual([
      { tipo: 'pedir_estado', a: 'lucia-mora', trabajos: ['T15'] },
      { tipo: 'pedir_estado', a: 'diego-rojas', trabajos: ['T21'] },
    ]);
    const r = mover(inicio, enCR(MIE, '07:05'));
    expect(acciones(r.efectos).map(resumen)).toEqual([
      { tipo: 'pedir_estado', a: 'lucia-mora', trabajos: ['T15'] },
      { tipo: 'pedir_estado', a: 'diego-rojas', trabajos: ['T21'] },
    ]);
    expect(r.inst.seguimientos).toEqual([
      {
        id: 'S1',
        trabajoId: 'T15',
        plazoReferencia: enCR('2026-11-24', '17:00'),
        nivel: 0,
        destinatarioId: 'lucia-mora',
        urgente: false,
        proximoEn: enCR(MIE, '11:00'), // mar 17:00 + 4 h laborales = mié 11:00
        estado: 'pendiente',
        iniciadoEn: enCR(MIE, '07:05'),
        escaladosA: [],
        tipo: 'estado',
      },
      expect.objectContaining({ id: 'S2', trabajoId: 'T21', nivel: 0, proximoEn: enCR(MIE, '11:00') }),
    ]);
    const [pedido] = acciones(r.efectos);
    expect(pedido?.accion.en).toEqual(enCR(MIE, '07:05'));
    expect(pedido?.aviso).toMatchObject({ personaId: 'lucia-mora', trabajoIds: ['T15'], titulo: '¿Cómo va «Conciliar el conteo con el sistema»?' });
    expect(pedido?.accion.motivo).toContain('«Conciliar el conteo con el sistema» (REPUESTOS-2)'); // T15
    expect(pedido?.accion.hechoOrigen).toContain('mar 24 nov, 17:00');
    // Repetir el avance no vuelve a pedir nada.
    expect(acciones(mover(r.inst, enCR(MIE, '07:06')).efectos)).toEqual([]);
  });

  it('E1: al vencer T28 (mié 12:00) se pide el estado a Paola Herrera una sola vez; el tick es idempotente', () => {
    const a1159 = mover(instantaneaDesdeSemilla(), enCR(MIE, '11:59')).inst;
    expect(sobre(tick(a1159), 'T28')).toEqual([]);
    const r = mover(a1159, enCR(MIE, '12:00'));
    expect(sobre(r.efectos, 'T28').map(resumen)).toEqual([{ tipo: 'pedir_estado', a: 'paola-herrera', trabajos: ['T28'] }]);
    expect(seguimientoDe(r.inst, 'T28')).toEqual([
      expect.objectContaining({ nivel: 0, estado: 'pendiente', destinatarioId: 'paola-herrera', proximoEn: enCR(MIE, '16:00') }),
    ]);
    expect(tick(r.inst)).toEqual([]); // misma hora, ya aplicado: nada nuevo
    expect(sobre(mover(r.inst, enCR(MIE, '12:10')).efectos, 'T28')).toEqual([]);
  });

  it('un plazo vence en el minuto exacto (ahora ≥ plazo)', () => {
    const r = mover(instantaneaDesdeSemilla(), enCR(MIE, '10:00'));
    expect(sobre(r.efectos, 'T22').map(resumen)).toEqual([{ tipo: 'pedir_estado', a: 'sofia-navarro', trabajos: ['T22'] }]);
  });

  it('no pide el estado de trabajos resueltos ni de los que aún no vencen', () => {
    const r = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05'));
    const pedidos = acciones(r.efectos).flatMap((a) => a.accion.trabajoIds);
    expect(pedidos).not.toContain('T01');
    expect(pedidos).not.toContain('T28');
  });
});

describe('R2 · recordatorio a las 4 horas laborales (trabajo normal)', () => {
  it('T29 vence mié 16:00 → recordatorio jue 10:00 (cruza el fin de jornada) y se agota: Andrés es responsable de P4 y de la operación', () => {
    let { inst } = mover(instantaneaDesdeSemilla(), enCR(MIE, '16:00'));
    expect(seguimientoDe(inst, 'T29')[0]?.proximoEn).toEqual(enCR(JUE, '10:00'));
    expect(sobre(mover(inst, enCR(JUE, '09:59')).efectos, 'T29')).toEqual([]);

    const r1 = mover(inst, enCR(JUE, '10:00'));
    expect(sobre(r1.efectos, 'T29').map(resumen)).toEqual([{ tipo: 'recordatorio', a: 'andres-vargas', trabajos: ['T29'] }]);
    inst = r1.inst;
    // Andrés es el responsable del trabajo, de su proyecto (P4) y de la operación, y T29 no deja a nadie en riesgo:
    // no queda a quién escalar (nunca al propio responsable, ni a la gerente por jerarquía): se agota tras el recordatorio.
    expect(seguimientoDe(inst, 'T29')[0]).toMatchObject({ nivel: 1, estado: 'agotado', escaladosA: [] });
    expect(sobre(mover(inst, enCR(JUE, '14:00')).efectos, 'T29')).toEqual([]);
  });

  it('T15 (vencido el mar 17:00) recuerda el mié 11:00 y escala a las 15:00 directo a Andrés: Lucía es la responsable de P3 y nadie de otro proyecto sale perjudicado', () => {
    const r = pasoAPaso(instantaneaDesdeSemilla(), enCR(JUE, '09:00'));
    expect(sobre(r.efectos, 'T15').map((a) => [a.accion.tipo, a.accion.destinatarioId, a.accion.en])).toEqual([
      ['pedir_estado', 'lucia-mora', enCR(MIE, '07:00')],
      ['recordatorio', 'lucia-mora', enCR(MIE, '11:00')],
      ['escalamiento', 'andres-vargas', enCR(MIE, '15:00')],
    ]);
    expect(seguimientoDe(r.inst, 'T15')[0]).toMatchObject({ nivel: 2, destinatarioId: 'andres-vargas', estado: 'agotado', escaladosA: ['andres-vargas'] });
    const esc = sobre(r.efectos, 'T15').find((a) => a.accion.tipo === 'escalamiento');
    expect(esc?.aviso?.cuerpo).toContain('responsable de la operación');
    expect(esc?.accion.motivo).toContain('responsable de la operación');
  });
});

describe('E2 · trabajo urgente creado por captura: recordatorio y escalamiento (R2, R3)', () => {
  it('iniciarSeguimientoUrgente abre el nivel 0 al crearse, sin acción (el aviso de asignación es la solicitud)', () => {
    const inst = trasC01();
    expect(seguimientoDe(inst, 'T31')).toEqual([
      {
        id: 'S3',
        trabajoId: 'T31',
        plazoReferencia: enCR(MIE, '07:05'),
        nivel: 0,
        destinatarioId: 'lucia-mora',
        urgente: true,
        proximoEn: enCR(MIE, '07:35'),
        estado: 'pendiente',
        iniciadoEn: enCR(MIE, '07:05'),
        escaladosA: [],
        tipo: 'estado',
      },
    ]);
    expect(iniciarSeguimientoUrgente(inst, 'T31')).toEqual([]); // ya tiene uno pendiente
    expect(iniciarSeguimientoUrgente(inst, 'T28')).toEqual([]); // no es urgente
    expect(() => iniciarSeguimientoUrgente(inst, 'T99')).toThrow('No existe el trabajo');
    expect(tick(inst)).toEqual([]);
  });

  it('7:35 recordatorio a Lucía → 8:05 Esteban (responsable de La Colina) con quién, qué bloquea, desde cuándo y qué puede hacer → 8:35 Andrés (responsable de la operación) → agotado', () => {
    let inst = trasC01();
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '07:35'));

    let r = mover(inst, enCR(MIE, '07:35'));
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'recordatorio', a: 'lucia-mora', trabajos: ['T31'] }]);
    inst = r.inst;
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '08:05'));

    r = mover(inst, enCR(MIE, '08:05'));
    const [esc] = acciones(r.efectos);
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'escalamiento', a: 'esteban-castro', trabajos: ['T31'] }]);
    // Bloquea T04, T05, T06 y T07: citados por título y referencia.
    for (const texto of [...['José Alfaro', '«Instalar unidad condensadora y compresor» (COLINA-4)', '«Cableado y tablero de control» (COLINA-5)', '«Prueba de frío y entrega al cliente» (COLINA-6)', '«Facturar la instalación» (COLINA-7)', '7:05'], 'Lucía Mora']) expect(esc?.aviso?.cuerpo).toContain(texto);
    // Dice por qué le llega (es el dueño del resultado) y ofrece las tres acciones de la regla 2.
    for (const texto of ['Cámara fría La Colina', 'reasignarlo', 'mover el plazo', 'declararlo bloqueado']) expect(esc?.aviso?.cuerpo).toContain(texto);
    expect(esc?.aviso?.cuerpo).not.toContain('Andrés');
    expect(esc?.aviso).toMatchObject({ personaId: 'esteban-castro', trabajoIds: ['T31'], en: enCR(MIE, '08:05') });
    expect(esc?.accion.motivo).toContain('Esteban Castro');
    expect(esc?.accion.motivo).toContain('responsable del proyecto');
    expect(esc?.accion.hechoOrigen).toContain('7:05');
    inst = r.inst;
    expect(seguimientoDe(inst, 'T31')[0]).toMatchObject({ nivel: 2, destinatarioId: 'esteban-castro', estado: 'pendiente', escaladosA: ['esteban-castro'] });
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '08:35'));

    // Nadie de OTRO proyecto tiene trabajos en riesgo o bloqueados por T31 (su cadena es de La Colina): el último
    // recurso es el responsable de la operación.
    r = mover(inst, enCR(MIE, '08:35'));
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'escalamiento', a: 'andres-vargas', trabajos: ['T31'] }]);
    expect(acciones(r.efectos)[0]?.aviso?.cuerpo).toContain('Ya se escaló a Esteban Castro');
    expect(acciones(r.efectos)[0]?.aviso?.cuerpo).toContain('responsable de la operación');
    inst = r.inst;
    expect(seguimientoDe(inst, 'T31')[0]).toMatchObject({
      nivel: 3,
      destinatarioId: 'andres-vargas',
      estado: 'agotado',
      escaladosA: ['esteban-castro', 'andres-vargas'],
    });

    // No hay más niveles: una hora después, nada nuevo sobre T31.
    expect(sobre(mover(inst, enCR(MIE, '09:35')).efectos, 'T31')).toEqual([]);
  });

  it('el siguiente nivel se programa desde el anterior programado, no desde la hora del tick', () => {
    const r = mover(trasC01(), enCR(MIE, '07:50'));
    expect(seguimientoDe(r.inst, 'T31')[0]).toMatchObject({ nivel: 1, proximoEn: enCR(MIE, '08:05') });
  });
});

/**
 * Como trasC01, pero el trabajo urgente T31 (creado a las 7:05) se pone en `proyectoId` a cargo de `responsableId` y
 * bloquea los trabajos de `bloquea`. Sirve para recorrer el camino del escalamiento con otros dueños y perjudicados.
 */
function conBloqueante(o: { proyectoId: string; responsableId: string; bloquea: string[] }): Instantanea {
  const base = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05')).inst;
  const numero = Math.max(...base.trabajos.filter((t) => t.proyectoId === o.proyectoId).map((t) => t.numero), 0) + 1;
  const t31: Trabajo = {
    ...(base.trabajos.find((t) => t.id === 'T04') as Trabajo),
    id: 'T31',
    numero,
    proyectoId: o.proyectoId,
    titulo: 'Conseguir lo que falta',
    responsableId: o.responsableId,
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR(MIE, '12:00'),
    estado: 'abierto',
    urgente: true,
    repuestoId: null,
    cantidadRepuesto: null,
    origen: 'captura',
    capturaId: 1,
    creadoEn: enCR(MIE, '07:05'),
    resueltoEn: null,
  };
  const conT31 = aplicarEnMemoria(base, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: 'jose-alfaro' },
    ...o.bloquea.map(
      (id): Efecto => ({ tipo: 'actualizar_trabajo', trabajoId: id, cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta algo' }, actorId: 'jose-alfaro' }),
    ),
  ]);
  return aplicarEnMemoria(conT31, iniciarSeguimientoUrgente(conT31, 'T31'));
}

/** Escalamientos sobre T31 de 7:35 a 9:35 («Siguiente evento» paso a paso), con el estado final de su seguimiento. */
function escalamientosDe(inst: Instantanea) {
  const r = pasoAPaso(inst, enCR(MIE, '09:35'));
  const escs = sobre(r.efectos, 'T31').filter((a) => a.accion.tipo === 'escalamiento');
  return { escs, a: escs.map((a) => a.accion.destinatarioId), seguimiento: seguimientoDe(r.inst, 'T31')[0], inst: r.inst };
}

describe('reforma · el escalamiento sigue al trabajo, no a los cargos', () => {
  it('nivel 1 al responsable del proyecto; nivel 2 a los responsables de OTROS proyectos perjudicados, uno por persona', () => {
    // T31 de Repuestos críticos (P3, Lucía) a cargo de Diego; bloquea COLINA-4 (P1) y TRIGAL-3 (P2).
    const { escs, a, seguimiento, inst } = escalamientosDe(conBloqueante({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] }));
    expect(a).toEqual(['lucia-mora', 'esteban-castro', 'daniela-quesada']);
    expect(escs.map((e) => e.accion.en)).toEqual([enCR(MIE, '08:05'), enCR(MIE, '08:35'), enCR(MIE, '08:35')]);
    expect(seguimiento).toMatchObject({ nivel: 3, estado: 'agotado', escaladosA: ['lucia-mora', 'esteban-castro', 'daniela-quesada'] });
    // Cada perjudicado recibe un solo aviso con SUS trabajos (R5); la acción es sobre T31.
    const aEsteban = escs.find((e) => e.accion.destinatarioId === 'esteban-castro');
    expect(aEsteban?.accion.trabajoIds).toEqual(['T31']);
    expect(aEsteban?.aviso?.trabajoIds).toEqual(['T31', 'T04', 'T05', 'T06', 'T07']);
    expect(aEsteban?.aviso?.cuerpo).toContain('Ya se escaló a Lucía Mora');
    expect(aEsteban?.aviso?.cuerpo).toContain('«Instalar unidad condensadora y compresor» (COLINA-4)');
    const aDaniela = escs.find((e) => e.accion.destinatarioId === 'daniela-quesada');
    expect(aDaniela?.aviso?.trabajoIds).toEqual(['T31', 'T10', 'T13']);
    expect(aDaniela?.accion.motivo).toContain('Mantenimiento Trigal');
    // Ni Andrés (jefe de Lucía y responsable de la operación: hay perjudicados) ni Marcela.
    expect(a).not.toContain('andres-vargas');
    expect(a).not.toContain('marcela-solis');
    // Mientras el seguimiento sigue pendiente, quien recibió el escalamiento puede responder y cerrarlo.
    const a0805 = pasoAPaso(conBloqueante({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] }), enCR(MIE, '08:05')).inst;
    expect(registrarRespuesta(a0805, 'T31', 'lucia-mora')).toHaveLength(2);
    expect(registrarRespuesta(a0805, 'T31', 'daniela-quesada')).toEqual([]); // aún no se le escaló
    expect(tick(inst)).toEqual([]);
  });

  it('los trabajos del MISMO proyecto no hacen perjudicado a su responsable: solo cuentan los otros proyectos', () => {
    // T31 de La Colina (Esteban) a cargo de Lucía; bloquea COLINA-4 y TRIGAL-3: nivel 1 Esteban, nivel 2 solo Daniela.
    const { a } = escalamientosDe(conBloqueante({ proyectoId: 'P1', responsableId: 'lucia-mora', bloquea: ['T04', 'T10'] }));
    expect(a).toEqual(['esteban-castro', 'daniela-quesada']);
  });

  it('si el responsable del proyecto es el del trabajo, el primer escalamiento salta a los perjudicados y no hay más niveles', () => {
    // T31 de P3 a cargo de Lucía, que también es la responsable de P3.
    const { escs, a, seguimiento } = escalamientosDe(conBloqueante({ proyectoId: 'P3', responsableId: 'lucia-mora', bloquea: ['T04', 'T10'] }));
    expect(a).toEqual(['esteban-castro', 'daniela-quesada']);
    expect(escs.every((e) => e.accion.en.getTime() === enCR(MIE, '08:05').getTime())).toBe(true);
    expect(seguimiento).toMatchObject({ nivel: 2, estado: 'agotado', escaladosA: ['esteban-castro', 'daniela-quesada'] });
  });

  it('sin perjudicados, el salto va al responsable de la operación', () => {
    const { a, seguimiento, escs } = escalamientosDe(conBloqueante({ proyectoId: 'P3', responsableId: 'lucia-mora', bloquea: [] }));
    expect(a).toEqual(['andres-vargas']);
    expect(escs[0]?.aviso?.cuerpo).toContain('responsable de la operación');
    expect(seguimiento).toMatchObject({ nivel: 2, estado: 'agotado', escaladosA: ['andres-vargas'] });
  });

  it('nunca al propio responsable del trabajo: si el perjudicado es él, se pasa al responsable de la operación', () => {
    // T31 de P3 (Lucía) a cargo de Esteban; bloquea COLINA-4, cuyo proyecto es de Esteban.
    const { a } = escalamientosDe(conBloqueante({ proyectoId: 'P3', responsableId: 'esteban-castro', bloquea: ['T04'] }));
    expect(a).toEqual(['lucia-mora', 'andres-vargas']);
  });

  it('nunca dos veces a la misma persona: en Operación diaria el responsable del proyecto es el de la operación', () => {
    // T31 de Operación diaria (Andrés) a cargo de Lucía, sin perjudicados: un solo escalamiento, a Andrés, y se agota.
    const { a, seguimiento } = escalamientosDe(conBloqueante({ proyectoId: 'OD', responsableId: 'lucia-mora', bloquea: [] }));
    expect(a).toEqual(['andres-vargas']);
    expect(seguimiento).toMatchObject({ nivel: 2, estado: 'agotado', escaladosA: ['andres-vargas'] });
  });

  it('el jefe directo no interviene: ningún escalamiento sigue `jefeId`', () => {
    // Mismo caso que el anterior con jefes inventados: el camino no cambia.
    const inst = conBloqueante({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] });
    const otrosJefes = { ...inst, personas: inst.personas.map((p) => ({ ...p, jefeId: p.id === 'marcela-solis' ? null : 'marcela-solis' })) };
    expect(escalamientosDe(otrosJefes).a).toEqual(escalamientosDe(inst).a);
  });
});

describe('respuesta y resolución detienen el seguimiento', () => {
  it('con respuesta del responsable no hay recordatorio ni escalamiento', () => {
    const inst = trasC01();
    const resp = registrarRespuesta(enHora(inst, enCR(MIE, '07:20')), 'T31', 'lucia-mora');
    expect(resp).toEqual([
      { tipo: 'actualizar_seguimiento', seguimientoId: 'S3', cambios: { estado: 'respondido' } },
      {
        tipo: 'evento',
        evento: { en: enCR(MIE, '07:20'), actorId: 'lucia-mora', tipo: 'respuesta_seguimiento', trabajoId: 'T31', decisionId: null, datos: { seguimientoId: 'S3', nivel: 0 } },
      },
    ]);
    const despues = aplicarEnMemoria(inst, resp);
    expect(sobre(mover(despues, enCR(MIE, '11:59')).efectos, 'T31')).toEqual([]);
    expect(registrarRespuesta(despues, 'T31', 'lucia-mora')).toEqual([]); // ya no hay pendiente
  });

  it('solo cierra quien está en el camino ya alcanzado (responsable, o a quien ya se escaló)', () => {
    const inst = trasC01();
    expect(registrarRespuesta(inst, 'T31', 'esteban-castro')).toEqual([]); // aún no se le escaló
    expect(registrarRespuesta(inst, 'T31', 'andres-vargas')).toEqual([]);
    expect(registrarRespuesta(inst, 'T31', 'jose-alfaro')).toEqual([]);
    const a0805 = mover(mover(inst, enCR(MIE, '07:35')).inst, enCR(MIE, '08:05')).inst;
    expect(registrarRespuesta(a0805, 'T31', 'andres-vargas')).toEqual([]); // el jefe directo de Lucía ya no está en el camino
    expect(registrarRespuesta(a0805, 'T31', 'esteban-castro')).toHaveLength(2);
  });

  it('un trabajo resuelto no genera más seguimiento y su seguimiento pendiente se cierra', () => {
    const inst = aplicarEnMemoria(trasC01(), [
      { tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { estado: 'resuelto', resueltoEn: enCR(MIE, '07:20') }, actorId: 'lucia-mora' },
    ]);
    const r = mover(inst, enCR(MIE, '13:00'));
    expect(sobre(r.efectos, 'T31')).toEqual([]);
    expect(r.efectos).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S3', cambios: { estado: 'respondido' } });
    expect(seguimientoDe(r.inst, 'T31')).toEqual([expect.objectContaining({ estado: 'respondido' })]);
    expect(tick(r.inst)).toEqual([]);
  });

  it('si otra persona mueve el plazo al futuro, el seguimiento de R1 se cierra y no se persigue hasta el plazo nuevo (E5, T21)', () => {
    const a0705 = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05')).inst;
    expect(seguimientoDe(a0705, 'T21')[0]).toMatchObject({ estado: 'pendiente' });
    const movido = aplicarEnMemoria(enHora(a0705, enCR(MIE, '09:30')), [
      { tipo: 'actualizar_trabajo', trabajoId: 'T21', cambios: { plazo: enCR(JUE, '12:00') }, actorId: 'sofia-navarro' },
    ]);
    const r = mover(movido, enCR(MIE, '09:30'));
    expect(r.efectos).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S2', cambios: { estado: 'respondido' } });
    expect(sobre(r.efectos, 'T21')).toEqual([]);
    // Ni recordatorio a las 11:00 ni nada el miércoles; al vencer el plazo nuevo se vuelve a pedir el estado.
    expect(sobre(mover(r.inst, enCR(MIE, '17:00')).efectos, 'T21')).toEqual([]);
    const jue = mover(r.inst, enCR(JUE, '12:00'));
    expect(sobre(jue.efectos, 'T21').map(resumen)).toEqual([{ tipo: 'pedir_estado', a: 'diego-rojas', trabajos: ['T21'] }]);
  });

  it('mover el plazo no cierra el seguimiento urgente de captura (referencia = creación)', () => {
    const inst = aplicarEnMemoria(trasC01(), [
      { tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { plazo: enCR(JUE, '12:00') }, actorId: 'jose-alfaro' },
    ]);
    expect(mover(inst, enCR(MIE, '07:35')).efectos.filter((e) => e.tipo === 'actualizar_seguimiento' && e.cambios.estado === 'respondido')).toEqual([]);
  });

  it('un seguimiento respondido no impide pedir el estado cuando vence el plazo sin resolver', () => {
    const inst = trasC01();
    const respondido = aplicarEnMemoria(inst, registrarRespuesta(inst, 'T31', 'lucia-mora'));
    const r = mover(respondido, enCR(MIE, '12:00'));
    expect(sobre(r.efectos, 'T31').map(resumen)).toEqual([{ tipo: 'pedir_estado', a: 'lucia-mora', trabajos: ['T31'] }]);
    expect(seguimientoDe(r.inst, 'T31').at(-1)).toMatchObject({ plazoReferencia: enCR(MIE, '12:00'), urgente: true, proximoEn: enCR(MIE, '12:30') });
  });
});

describe('siguienteEvento', () => {
  it('devuelve el instante exacto del próximo vencimiento, recordatorio o escalamiento', () => {
    const inicio = instantaneaDesdeSemilla();
    // A las 7:00 sin tick: T15/T21 se procesan al instante; lo próximo futuro es T22 a las 10:00.
    expect(siguienteEvento(inicio)).toEqual(enCR(MIE, '10:00'));
    const a10 = mover(inicio, enCR(MIE, '10:00')).inst;
    expect(siguienteEvento(a10)).toEqual(enCR(MIE, '11:00')); // recordatorios de T15 y T21
    const a11 = mover(a10, enCR(MIE, '11:00')).inst;
    expect(siguienteEvento(a11)).toEqual(enCR(MIE, '12:00')); // vence T28
    expect(siguienteEvento(trasC01())).toEqual(enCR(MIE, '07:35'));
  });

  it('null cuando no queda nada programado', () => {
    const inst = instantaneaDesdeSemilla();
    const todoResuelto = { ...inst, trabajos: inst.trabajos.map((t) => ({ ...t, estado: 'resuelto' as const })) };
    expect(siguienteEvento(todoResuelto)).toBeNull();
  });
});

describe('saltar el reloj equivale a avanzar paso a paso', () => {
  /** Lo que no depende de cuándo corrió el tick: `en` de acciones/avisos e `iniciadoEn` son la hora real del tick. */
  const sinHoras = (r: { inst: Instantanea; efectos: Efecto[] }) => ({
    acciones: acciones(r.efectos).map((a) => ({ ...a.accion, en: null, aviso: a.aviso && { ...a.aviso, en: null } })),
    seguimientos: r.inst.seguimientos.map((s) => ({ ...s, iniciadoEn: null })),
  });

  it('de la captura C01 (7:05) al viernes 17:00: mismos niveles, sin perder ni duplicar', () => {
    const hasta = enCR('2026-11-27', '17:00');
    const salto = mover(trasC01(), hasta);
    const pasos = pasoAPaso(trasC01(), hasta);
    expect(sinHoras(salto)).toEqual(sinHoras(pasos));

    const t31 = sobre(salto.efectos, 'T31').map((a) => [a.accion.tipo, a.accion.destinatarioId]);
    expect(t31).toEqual([
      ['recordatorio', 'lucia-mora'],
      ['escalamiento', 'esteban-castro'],
      ['escalamiento', 'andres-vargas'],
      ['pedir_estado', 'lucia-mora'], // vence su plazo de las 12:00 y vuelve a empezar
      ['recordatorio', 'lucia-mora'],
      ['escalamiento', 'esteban-castro'],
      ['escalamiento', 'andres-vargas'],
    ]);
    // La gerente no aparece en el seguimiento: solo decide gastos por encima del tope.
    expect(acciones(salto.efectos).some((a) => a.accion.destinatarioId === 'marcela-solis')).toBe(false);
    // Nunca más de un escalamiento por nivel y seguimiento, y como máximo dos niveles tras el recordatorio.
    for (const s of salto.inst.seguimientos) expect(s.nivel).toBeLessThanOrEqual(3);
    expect(tick(salto.inst)).toEqual([]);
  });

  it('desde las 7:00 de la semilla hasta el jueves 12:00', () => {
    const hasta = enCR(JUE, '12:00');
    expect(sinHoras(mover(instantaneaDesdeSemilla(), hasta))).toEqual(sinHoras(pasoAPaso(instantaneaDesdeSemilla(), hasta)));
  });

  it('no modifica la instantánea de entrada', () => {
    const inst = trasC01();
    const copia = structuredClone(inst);
    tick(enHora(inst, enCR(JUE, '12:00')));
    siguienteEvento(inst);
    expect(inst).toEqual(copia);
  });
});
