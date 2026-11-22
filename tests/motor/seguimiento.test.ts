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
  it('T29 vence mié 16:00 → recordatorio jue 10:00 (cruza el fin de jornada) → Marcela jue 14:00 y se agota', () => {
    let { inst } = mover(instantaneaDesdeSemilla(), enCR(MIE, '16:00'));
    expect(seguimientoDe(inst, 'T29')[0]?.proximoEn).toEqual(enCR(JUE, '10:00'));
    expect(sobre(mover(inst, enCR(JUE, '09:59')).efectos, 'T29')).toEqual([]);

    const r1 = mover(inst, enCR(JUE, '10:00'));
    expect(sobre(r1.efectos, 'T29').map(resumen)).toEqual([{ tipo: 'recordatorio', a: 'andres-vargas', trabajos: ['T29'] }]);
    inst = r1.inst;
    expect(seguimientoDe(inst, 'T29')[0]).toMatchObject({ nivel: 1, proximoEn: enCR(JUE, '14:00'), estado: 'pendiente' });

    // Andrés solo tiene un jefe (Marcela): un escalamiento y se agota.
    const r2 = mover(inst, enCR(JUE, '14:00'));
    expect(sobre(r2.efectos, 'T29').map(resumen)).toEqual([{ tipo: 'escalamiento', a: 'marcela-solis', trabajos: ['T29'] }]);
    expect(seguimientoDe(r2.inst, 'T29')[0]).toMatchObject({ nivel: 2, destinatarioId: 'marcela-solis', estado: 'agotado' });
  });

  it('T15 (vencido el mar 17:00) recuerda el mié 11:00 y escala a Andrés a las 15:00 y a Marcela el jue 9:00', () => {
    const r = pasoAPaso(instantaneaDesdeSemilla(), enCR(JUE, '09:00'));
    expect(sobre(r.efectos, 'T15').map((a) => [a.accion.tipo, a.accion.destinatarioId, a.accion.en])).toEqual([
      ['pedir_estado', 'lucia-mora', enCR(MIE, '07:00')],
      ['recordatorio', 'lucia-mora', enCR(MIE, '11:00')],
      ['escalamiento', 'andres-vargas', enCR(MIE, '15:00')],
      ['escalamiento', 'marcela-solis', enCR(JUE, '09:00')],
    ]);
    expect(seguimientoDe(r.inst, 'T15')[0]).toMatchObject({ nivel: 3, estado: 'agotado' });
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
      },
    ]);
    expect(iniciarSeguimientoUrgente(inst, 'T31')).toEqual([]); // ya tiene uno pendiente
    expect(iniciarSeguimientoUrgente(inst, 'T28')).toEqual([]); // no es urgente
    expect(() => iniciarSeguimientoUrgente(inst, 'T99')).toThrow('No existe el trabajo');
    expect(tick(inst)).toEqual([]);
  });

  it('7:35 recordatorio a Lucía → 8:05 escalamiento a Andrés con quién, qué bloquea y desde cuándo → 8:35 Marcela → agotado', () => {
    let inst = trasC01();
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '07:35'));

    let r = mover(inst, enCR(MIE, '07:35'));
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'recordatorio', a: 'lucia-mora', trabajos: ['T31'] }]);
    inst = r.inst;
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '08:05'));

    r = mover(inst, enCR(MIE, '08:05'));
    const [esc] = acciones(r.efectos);
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'escalamiento', a: 'andres-vargas', trabajos: ['T31'] }]);
    // Bloquea T04, T05, T06 y T07: citados por título y referencia.
    for (const texto of [...['José Alfaro', '«Instalar unidad condensadora y compresor» (COLINA-4)', '«Cableado y tablero de control» (COLINA-5)', '«Prueba de frío y entrega al cliente» (COLINA-6)', '«Facturar la instalación» (COLINA-7)', '7:05'], 'Lucía Mora']) expect(esc?.aviso?.cuerpo).toContain(texto);
    expect(esc?.aviso).toMatchObject({ personaId: 'andres-vargas', trabajoIds: ['T31'], en: enCR(MIE, '08:05') });
    expect(esc?.accion.motivo).toContain('Andrés Vargas');
    expect(esc?.accion.hechoOrigen).toContain('7:05');
    inst = r.inst;
    expect(seguimientoDe(inst, 'T31')[0]).toMatchObject({ nivel: 2, destinatarioId: 'andres-vargas', estado: 'pendiente' });
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '08:35'));

    r = mover(inst, enCR(MIE, '08:35'));
    expect(acciones(r.efectos).map(resumen)).toEqual([{ tipo: 'escalamiento', a: 'marcela-solis', trabajos: ['T31'] }]);
    expect(acciones(r.efectos)[0]?.aviso?.cuerpo).toContain('Ya se escaló a Andrés Vargas');
    inst = r.inst;
    expect(seguimientoDe(inst, 'T31')[0]).toMatchObject({ nivel: 3, destinatarioId: 'marcela-solis', estado: 'agotado' });

    // No hay más niveles: una hora después, nada nuevo sobre T31.
    expect(sobre(mover(inst, enCR(MIE, '09:35')).efectos, 'T31')).toEqual([]);
  });

  it('el siguiente nivel se programa desde el anterior programado, no desde la hora del tick', () => {
    const r = mover(trasC01(), enCR(MIE, '07:50'));
    expect(seguimientoDe(r.inst, 'T31')[0]).toMatchObject({ nivel: 1, proximoEn: enCR(MIE, '08:05') });
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

  it('solo cierra quien está en la cadena ya alcanzada (responsable, o el jefe tras escalarle)', () => {
    const inst = trasC01();
    expect(registrarRespuesta(inst, 'T31', 'andres-vargas')).toEqual([]); // aún no se le escaló
    expect(registrarRespuesta(inst, 'T31', 'jose-alfaro')).toEqual([]);
    const a0805 = mover(mover(inst, enCR(MIE, '07:35')).inst, enCR(MIE, '08:05')).inst;
    expect(registrarRespuesta(a0805, 'T31', 'andres-vargas')).toHaveLength(2);
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
      ['escalamiento', 'andres-vargas'],
      ['escalamiento', 'marcela-solis'],
      ['pedir_estado', 'lucia-mora'], // vence su plazo de las 12:00 y vuelve a empezar
      ['recordatorio', 'lucia-mora'],
      ['escalamiento', 'andres-vargas'],
      ['escalamiento', 'marcela-solis'],
    ]);
    // Nunca más de un escalamiento por nivel y seguimiento, y como máximo dos niveles de jefes.
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
