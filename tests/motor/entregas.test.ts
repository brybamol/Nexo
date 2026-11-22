// Entrega y resolución con evidencia (docs/08 reglas 19–20, y efectosActualizacion con evidencia). Puro. Tarea R4.
// No depende de motor/marcas ni de tick (R3): solo de los efectos y de aplicarEnMemoria.
import { describe, expect, it } from 'vitest';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type PlanActualizacion, type Seguimiento, type Trabajo } from '@/dominio/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { efectosEntrega, efectosRecepcion, efectosRechazoEntrega, modoResolucion } from '@/motor/entregas';
import type { Instantanea } from '@/motor/instantanea';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const JOSE = 'jose-alfaro';
const LUCIA = 'lucia-mora';
const ANDRES = 'andres-vargas';
const PAOLA = 'paola-herrera';
const MARIO = 'mario-chaves';

/** Como tras C01 (7:05): T31 «Conseguir compresor de 2 HP» de Lucía, pedido por José, bloquea T04 de José. */
function trasC01(hora = '07:05'): Instantanea {
  const base = instantaneaDesdeSemilla();
  const t04 = base.trabajos.find((t) => t.id === 'T04') as Trabajo;
  const t31: Trabajo = {
    ...t04,
    id: 'T31',
    numero: 8, // COLINA-8
    titulo: 'Conseguir compresor de 2 HP',
    responsableId: LUCIA,
    solicitadoPorId: JOSE,
    plazo: enCR('2026-11-25', '12:00'),
    estado: 'abierto',
    urgente: true,
    conCostoProbable: true,
    repuestoId: 'compresor-2hp',
    cantidadRepuesto: 1,
    origen: 'captura',
    creadoEn: enCR('2026-11-25', '07:05'),
  };
  return aplicarEnMemoria({ ...base, ahora: enCR('2026-11-25', hora) }, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: JOSE },
    {
      tipo: 'actualizar_trabajo',
      trabajoId: 'T04',
      cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor de 2 HP' },
      actorId: JOSE,
    },
  ]);
}

/** Con T31 no urgente (intervalo normal: 4 horas laborales). */
const noUrgente = (inst: Instantanea): Instantanea => ({
  ...inst,
  trabajos: inst.trabajos.map((t) => (t.id === 'T31' ? { ...t, urgente: false } : t)),
});

const seguimiento = (p: Partial<Seguimiento> & Pick<Seguimiento, 'id' | 'trabajoId'>): Seguimiento => ({
  plazoReferencia: enCR('2026-11-25', '07:05'),
  nivel: 0,
  destinatarioId: LUCIA,
  urgente: true,
  proximoEn: enCR('2026-11-25', '07:35'),
  estado: 'pendiente',
  iniciadoEn: enCR('2026-11-25', '07:05'),
  escaladosA: [],
  tipo: 'estado',
  ...p,
});

const plan = (p: Partial<PlanActualizacion> & { trabajoId: string }): PlanActualizacion => ({
  tipo: 'actualizacion',
  nuevoEstado: null,
  nota: null,
  hayProblema: false,
  reprogramar: [],
  notasRelacionadas: [],
  ...p,
});

const trabajo = (inst: Instantanea, id: string) => inst.trabajos.find((t) => t.id === id) as Trabajo;
const avisosDe = (efs: Efecto[]) =>
  efs.flatMap((e) => (e.tipo === 'accion' && e.aviso ? [{ a: e.aviso.personaId, ids: e.aviso.trabajoIds, titulo: e.aviso.titulo, cuerpo: e.aviso.cuerpo }] : []));
const accionesDe = (efs: Efecto[]) => efs.flatMap((e) => (e.tipo === 'accion' ? [e.accion] : []));
const eventosDe = (efs: Efecto[]) => efs.flatMap((e) => (e.tipo === 'evento' ? [e.evento] : []));
/** Todo texto visible que generan los efectos (motivos, hechos, avisos, notas, citas). */
const textosDe = (efs: Efecto[]) =>
  efs.flatMap((e) => {
    if (e.tipo === 'accion') return [e.accion.motivo, e.accion.hechoOrigen, e.aviso?.titulo ?? '', e.aviso?.cuerpo ?? ''];
    if (e.tipo === 'agregar_nota') return [e.texto];
    if (e.tipo === 'agregar_evidencia') return [e.evidencia.cita];
    return [];
  });
const sinEvidencias = (efs: Efecto[]) => efs.filter((e) => e.tipo !== 'agregar_evidencia');

function errorDe(f: () => unknown): ErrorDominio {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorDominio) return e;
    throw e;
  }
  throw new Error('no lanzó ErrorDominio');
}

const entregaDeLucia = (inst: Instantanea) =>
  aplicarEnMemoria(inst, efectosEntrega(inst, 'T31', LUCIA, { nota: 'Lo traje del proveedor local', enlace: null, fuente: 'interfaz' }));

// ─── Regla 19 ─────────────────────────────────────────────────────────────────

describe('modoResolucion (regla 19)', () => {
  it('trabajo sin solicitante (semilla): su responsable lo resuelve; nadie más', () => {
    const t28 = trabajo(instantaneaDesdeSemilla(), 'T28');
    expect(modoResolucion(t28, PAOLA)).toBe('resolver');
    expect(modoResolucion(t28, ANDRES)).toBe('prohibido');
  });

  it('con otro solicitante: quien lo pidió resuelve, el responsable entrega, un jefe no puede', () => {
    const t31 = trabajo(trasC01(), 'T31');
    expect(modoResolucion(t31, JOSE)).toBe('resolver');
    expect(modoResolucion(t31, LUCIA)).toBe('entregar');
    expect(modoResolucion(t31, ANDRES)).toBe('prohibido');
    expect(modoResolucion(t31, 'marcela-solis')).toBe('prohibido');
  });

  it('el que se lo pidió a sí mismo lo resuelve', () => {
    const t31 = { ...trabajo(trasC01(), 'T31'), solicitadoPorId: LUCIA };
    expect(modoResolucion(t31, LUCIA)).toBe('resolver');
    expect(modoResolucion(t31, JOSE)).toBe('prohibido');
  });
});

// ─── Regla 20: entrega ────────────────────────────────────────────────────────

describe('efectosEntrega (regla 20)', () => {
  it('pone la entrega y su evidencia; no cambia el estado ni libera lo que bloquea', () => {
    const inst = trasC01('08:20');
    const efs = efectosEntrega(inst, 'T31', LUCIA, { nota: '  Lo traje del proveedor local ', enlace: null, fuente: 'interfaz' });
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31')).toMatchObject({
      estado: 'abierto',
      resueltoEn: null,
      entrega: { en: enCR('2026-11-25', '08:20'), porId: LUCIA, nota: 'Lo traje del proveedor local', enlace: null, fuente: 'interfaz' },
    });
    expect(trabajo(despues, 'T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    expect(despues.evidencias).toEqual([
      {
        id: 1,
        trabajoId: 'T31',
        tipo: 'entrega',
        fuente: 'interfaz',
        compromisoClave: null,
        mensajeId: null,
        buzones: [],
        enlaces: {},
        autorId: LUCIA,
        en: enCR('2026-11-25', '08:20'),
        cita: 'Lo traje del proveedor local',
      },
    ]);
    expect(efs.some((e) => e.tipo === 'actualizar_necesidad')).toBe(false);
  });

  it('registra la acción y el evento, y avisa solo a quien lo pidió: «… entregó «…». ¿Lo recibiste?»', () => {
    const inst = trasC01('08:20');
    const efs = efectosEntrega(inst, 'T31', LUCIA, { nota: 'Lo traje del proveedor local', enlace: null, fuente: 'interfaz' });
    const registro = accionesDe(efs).find((a) => a.tipo === 'registrar_entrega');
    expect(registro).toMatchObject({ destinatarioId: null, trabajoIds: ['T31'], capturaId: null, en: inst.ahora });
    expect(registro?.motivo).toContain('Lucía Mora');
    expect(eventosDe(efs)).toContainEqual({
      en: inst.ahora,
      actorId: LUCIA,
      tipo: 'entrega_registrada',
      trabajoId: 'T31',
      decisionId: null,
      datos: { fuente: 'interfaz', nota: 'Lo traje del proveedor local', enlace: null },
    });
    const avisos = avisosDe(efs);
    expect(avisos.map((a) => [a.a, a.ids])).toEqual([[JOSE, ['T31']]]);
    expect(avisos[0]?.titulo).toBe('Lucía Mora entregó «Conseguir compresor de 2 HP». ¿Lo recibiste?');
    expect(avisos[0]?.cuerpo).toContain('Lo traje del proveedor local');
    expect(accionesDe(efs).find((a) => a.destinatarioId === JOSE)?.tipo).toBe('aviso');
    for (const t of textosDe(efs)) expect(idsInternosEn(t)).toEqual([]);
  });

  it('abre el seguimiento de recepción para quien lo pidió (nivel 0 = el aviso), con el intervalo de R2', () => {
    const urgente = aplicarEnMemoria(trasC01('08:20'), []);
    const s1 = aplicarEnMemoria(urgente, efectosEntrega(urgente, 'T31', LUCIA, { nota: 'Listo', enlace: null, fuente: 'interfaz' })).seguimientos;
    expect(s1).toEqual([
      {
        id: 'S1',
        trabajoId: 'T31',
        plazoReferencia: enCR('2026-11-25', '08:20'),
        nivel: 0,
        destinatarioId: JOSE,
        urgente: true,
        proximoEn: enCR('2026-11-25', '08:50'),
        estado: 'pendiente',
        iniciadoEn: enCR('2026-11-25', '08:20'),
        escaladosA: [],
        tipo: 'recepcion',
      },
    ]);
    // Normal (V11): 8:20 + 4 horas laborales = 12:20.
    const normal = noUrgente(trasC01('08:20'));
    const s2 = aplicarEnMemoria(normal, efectosEntrega(normal, 'T31', LUCIA, { nota: 'Listo', enlace: null, fuente: 'interfaz' })).seguimientos;
    expect(s2[0]).toMatchObject({ tipo: 'recepcion', urgente: false, proximoEn: enCR('2026-11-25', '12:20') });
  });

  it('cierra los seguimientos de estado pendientes como respuesta; no toca los de otro tipo', () => {
    const base = trasC01('08:20');
    const inst: Instantanea = {
      ...base,
      seguimientos: [
        seguimiento({ id: 'S1', trabajoId: 'T31', nivel: 1 }),
        seguimiento({ id: 'S2', trabajoId: 'T31', tipo: 'propuesta', destinatarioId: JOSE }),
        seguimiento({ id: 'S3', trabajoId: 'T15', destinatarioId: LUCIA }),
      ],
    };
    const efs = efectosEntrega(inst, 'T31', LUCIA, { nota: 'Listo', enlace: null, fuente: 'captura' });
    const despues = aplicarEnMemoria(inst, efs);
    expect(despues.seguimientos.map((s) => [s.id, s.tipo, s.estado])).toEqual([
      ['S1', 'estado', 'respondido'],
      ['S2', 'propuesta', 'pendiente'],
      ['S3', 'estado', 'pendiente'],
      ['S4', 'recepcion', 'pendiente'],
    ]);
    expect(eventosDe(efs)).toContainEqual({
      en: inst.ahora,
      actorId: LUCIA,
      tipo: 'respuesta_seguimiento',
      trabajoId: 'T31',
      decisionId: null,
      datos: { seguimientoId: 'S1', nivel: 1, via: 'entrega' },
    });
  });

  it('basta un enlace; sin nota ni enlace → «Escribe qué entregaste o pega el enlace»', () => {
    const inst = trasC01('08:20');
    const efs = efectosEntrega(inst, 'T31', LUCIA, { nota: '   ', enlace: ' https://drive.example/guia.pdf ', fuente: 'interfaz' });
    const t31 = trabajo(aplicarEnMemoria(inst, efs), 'T31');
    expect(t31.entrega).toMatchObject({ nota: null, enlace: 'https://drive.example/guia.pdf' });
    expect(aplicarEnMemoria(inst, efs).evidencias[0]?.cita).toBe('https://drive.example/guia.pdf');
    const e = errorDe(() => efectosEntrega(inst, 'T31', LUCIA, { nota: ' ', enlace: null, fuente: 'interfaz' }));
    expect(e.message).toBe('Escribe qué entregaste o pega el enlace.');
  });

  it('solo el responsable con otro solicitante entrega; ni quien lo pidió ni un jefe', () => {
    const inst = trasC01('08:20');
    const e = { nota: 'Listo', enlace: null, fuente: 'interfaz' } as const;
    expect(errorDe(() => efectosEntrega(inst, 'T31', JOSE, e)).message).toContain('puede declararlo entregado');
    expect(errorDe(() => efectosEntrega(inst, 'T31', ANDRES, e)).message).toContain('Solo Lucía Mora');
    // Sin solicitante no hay a quién entregar: se resuelve con nota.
    expect(errorDe(() => efectosEntrega(inst, 'T28', PAOLA, e)).message).toContain('nadie más lo pidió');
    expect(() => efectosEntrega(inst, 'T99', LUCIA, e)).toThrow(ErrorDominio);
  });

  it('no se entrega lo resuelto, lo ya entregado ni lo bloqueado por otro sin resolver', () => {
    const e = { nota: 'Listo', enlace: null, fuente: 'interfaz' } as const;
    const resuelto = trasC01();
    resuelto.trabajos = resuelto.trabajos.map((t) => (t.id === 'T31' ? { ...t, estado: 'resuelto', resueltoEn: resuelto.ahora } : t));
    expect(errorDe(() => efectosEntrega(resuelto, 'T31', LUCIA, e)).message).toContain('ya está resuelto');

    const entregado = entregaDeLucia(trasC01());
    expect(errorDe(() => efectosEntrega(entregado, 'T31', LUCIA, e)).message).toContain('ya está entregado');

    // T04 (de José) pedido por Marcela y bloqueado por T31 sin resolver.
    const bloqueado = trasC01();
    bloqueado.trabajos = bloqueado.trabajos.map((t) => (t.id === 'T04' ? { ...t, solicitadoPorId: 'marcela-solis' } : t));
    expect(errorDe(() => efectosEntrega(bloqueado, 'T04', JOSE, e)).message).toBe(
      '«Instalar unidad condensadora y compresor» (COLINA-4) está bloqueado por «Conseguir compresor de 2 HP» (COLINA-8): no puede declararse entregado.',
    );
  });

  it('en un propuesto: entrega, evidencia, acción y evento, pero sin aviso ni seguimiento de recepción', () => {
    const base = trasC01('08:20');
    const inst: Instantanea = {
      ...base,
      trabajos: base.trabajos.map((t) => (t.id === 'T31' ? { ...t, confirmacion: 'propuesto', duenoPropuestaId: JOSE } : t)),
    };
    const efs = efectosEntrega(inst, 'T31', LUCIA, { nota: 'Te adjunto el compresor', enlace: null, fuente: 'correo' });
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31').entrega).toMatchObject({ porId: LUCIA, fuente: 'correo' });
    expect(despues.evidencias).toHaveLength(1);
    expect(avisosDe(efs)).toEqual([]);
    expect(despues.seguimientos).toEqual([]);
    expect(accionesDe(efs).map((a) => a.tipo)).toEqual(['registrar_entrega']);
    expect(eventosDe(efs).map((e) => e.tipo)).toEqual(['entrega_registrada']);
  });
});

// ─── Regla 20: recepción ──────────────────────────────────────────────────────

describe('efectosRecepcion (regla 20)', () => {
  it('quien lo pidió confirma: resuelto, liberación (regla 5), cierre de seguimientos, evidencia, acción, evento y aviso al responsable', () => {
    const entregado = entregaDeLucia(trasC01('08:20'));
    const inst = { ...entregado, ahora: enCR('2026-11-25', '09:00') };
    const efs = efectosRecepcion(inst, 'T31', JOSE, 'Ya llegó el compresor', 'interfaz');
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31')).toMatchObject({ estado: 'resuelto', resueltoEn: inst.ahora });
    expect(trabajo(despues, 'T31').entrega).not.toBeNull(); // la entrega queda como historia
    expect(trabajo(despues, 'T04')).toMatchObject({ estado: 'en_curso', bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null });
    expect(despues.necesidades.find((n) => n.trabajoId === 'T04' && n.repuestoId === 'compresor-2hp')?.atendida).toBe(true);
    expect(despues.seguimientos.map((s) => [s.tipo, s.estado])).toEqual([['recepcion', 'respondido']]);
    expect(despues.evidencias.map((e) => [e.tipo, e.autorId, e.cita])).toEqual([
      ['entrega', LUCIA, 'Lo traje del proveedor local'],
      ['recepcion', JOSE, 'Ya llegó el compresor'],
    ]);
    expect(accionesDe(efs).map((a) => [a.tipo, a.destinatarioId])).toEqual([
      ['confirmar_recepcion', null],
      ['aviso', LUCIA],
      ['aviso', MARIO],
    ]);
    expect(eventosDe(efs)).toContainEqual({
      en: inst.ahora,
      actorId: JOSE,
      tipo: 'recepcion_confirmada',
      trabajoId: 'T31',
      decisionId: null,
      datos: { fuente: 'interfaz' },
    });
    const avisos = avisosDe(efs);
    expect(avisos.find((a) => a.a === LUCIA)).toMatchObject({
      ids: ['T31'],
      titulo: 'José Alfaro confirmó que recibió «Conseguir compresor de 2 HP»',
    });
    expect(avisos.find((a) => a.a === MARIO)).toMatchObject({ ids: ['T05'], titulo: 'José Alfaro confirmó que recibió «Conseguir compresor de 2 HP»' });
    for (const a of avisos) expect(a.titulo).not.toBe('');
    for (const t of textosDe(efs)) expect(idsInternosEn(t)).toEqual([]);
  });

  it('el responsable no puede confirmar su propia entrega; tampoco un tercero; ni sobre lo resuelto', () => {
    const inst = entregaDeLucia(trasC01('08:20'));
    expect(errorDe(() => efectosRecepcion(inst, 'T31', LUCIA, 'Listo', 'interfaz')).message).toBe(
      'Solo José Alfaro, que lo pidió, puede confirmar que recibió «Conseguir compresor de 2 HP» (COLINA-8).',
    );
    expect(() => efectosRecepcion(inst, 'T31', ANDRES, 'Listo', 'interfaz')).toThrow(ErrorDominio);
    expect(() => efectosRecepcion(inst, 'T28', PAOLA, 'Listo', 'interfaz')).toThrow(ErrorDominio); // sin solicitante
    const resuelto = aplicarEnMemoria(inst, efectosRecepcion(inst, 'T31', JOSE, 'Listo', 'interfaz'));
    expect(errorDe(() => efectosRecepcion(resuelto, 'T31', JOSE, 'Otra vez', 'interfaz')).message).toContain('ya está resuelto');
  });

  it('sin entrega previa también resuelve (quien lo pidió lo da por resuelto); sin cita, una por defecto', () => {
    const inst = trasC01('08:20');
    const efs = efectosRecepcion(inst, 'T31', JOSE, '  ', 'interfaz');
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31').estado).toBe('resuelto');
    expect(despues.evidencias[0]).toMatchObject({ tipo: 'recepcion', cita: 'José Alfaro confirmó que lo recibió.' });
  });

  it('en un propuesto resuelve sin avisar a nadie (regla 15)', () => {
    const base = trasC01('08:20');
    const prop: Instantanea = {
      ...base,
      trabajos: base.trabajos.map((t) => (t.id === 'T31' ? { ...t, confirmacion: 'propuesto', duenoPropuestaId: JOSE } : t)),
    };
    const inst = aplicarEnMemoria(prop, efectosEntrega(prop, 'T31', LUCIA, { nota: 'Listo', enlace: null, fuente: 'correo' }));
    const efs = efectosRecepcion(inst, 'T31', JOSE, 'Recibido, gracias', 'correo');
    expect(trabajo(aplicarEnMemoria(inst, efs), 'T31').estado).toBe('resuelto');
    expect(avisosDe(efs)).toEqual([]);
    expect(accionesDe(efs).map((a) => a.tipo)).toEqual(['confirmar_recepcion']);
  });
});

// ─── Regla 20: rechazo ────────────────────────────────────────────────────────

describe('efectosRechazoEntrega (regla 20)', () => {
  it('quita la entrega, deja nota con el motivo, cierra la recepción, avisa al responsable y registra', () => {
    const entregado = entregaDeLucia(trasC01('08:20'));
    const inst = { ...entregado, ahora: enCR('2026-11-25', '09:00') };
    const efs = efectosRechazoEntrega(inst, 'T31', JOSE, '  Es de 1 HP, no de 2 HP ');
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31')).toMatchObject({ estado: 'abierto', entrega: null });
    expect(trabajo(despues, 'T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    expect(efs).toContainEqual({ tipo: 'agregar_nota', trabajoId: 'T31', autorId: JOSE, texto: 'Entrega rechazada: Es de 1 HP, no de 2 HP' });
    expect(despues.seguimientos.map((s) => [s.tipo, s.estado])).toEqual([['recepcion', 'respondido']]);
    expect(accionesDe(efs).map((a) => [a.tipo, a.destinatarioId])).toEqual([
      ['rechazar_entrega', null],
      ['aviso', LUCIA],
    ]);
    expect(eventosDe(efs)).toContainEqual({
      en: inst.ahora,
      actorId: JOSE,
      tipo: 'entrega_rechazada',
      trabajoId: 'T31',
      decisionId: null,
      datos: { motivo: 'Es de 1 HP, no de 2 HP' },
    });
    const [aviso] = avisosDe(efs);
    expect(aviso?.titulo).toBe('José Alfaro rechazó la entrega de «Conseguir compresor de 2 HP»');
    expect(aviso?.cuerpo).toContain('Es de 1 HP, no de 2 HP');
    for (const t of textosDe(efs)) expect(idsInternosEn(t)).toEqual([]);
  });

  it('antes del plazo no abre seguimiento: R1 lo pedirá al vencer', () => {
    const inst = entregaDeLucia(trasC01('08:20'));
    const despues = aplicarEnMemoria(inst, efectosRechazoEntrega(inst, 'T31', JOSE, 'No sirve'));
    expect(despues.seguimientos.filter((s) => s.estado === 'pendiente')).toEqual([]);
  });

  it('con el plazo vencido, R1 vuelve a aplicar: seguimiento de estado nivel 0 para el responsable (el aviso es la solicitud)', () => {
    const entregado = entregaDeLucia(noUrgente(trasC01('08:20')));
    const inst = { ...entregado, ahora: enCR('2026-11-25', '13:00') }; // plazo de T31: 12:00
    const despues = aplicarEnMemoria(inst, efectosRechazoEntrega(inst, 'T31', JOSE, 'No sirve'));
    expect(despues.seguimientos.filter((s) => s.estado === 'pendiente')).toEqual([
      {
        id: 'S2',
        trabajoId: 'T31',
        plazoReferencia: enCR('2026-11-25', '12:00'),
        nivel: 0,
        destinatarioId: LUCIA,
        urgente: false,
        proximoEn: enCR('2026-11-25', '17:00'),
        estado: 'pendiente',
        iniciadoEn: enCR('2026-11-25', '13:00'),
        escaladosA: [],
        tipo: 'estado',
      },
    ]);
  });

  it('motivo obligatorio; solo quien lo pidió; solo con una entrega por confirmar', () => {
    const inst = entregaDeLucia(trasC01('08:20'));
    expect(errorDe(() => efectosRechazoEntrega(inst, 'T31', JOSE, '  ')).message).toBe('Escribe por qué la entrega no está bien.');
    expect(errorDe(() => efectosRechazoEntrega(inst, 'T31', LUCIA, 'No')).message).toContain('Solo José Alfaro');
    expect(errorDe(() => efectosRechazoEntrega(trasC01(), 'T31', JOSE, 'No')).message).toContain('no tiene una entrega por confirmar');
  });
});

// ─── efectosActualizacion con evidencia (regla 19) ────────────────────────────

describe('efectosActualizacion con evidencia (regla 19)', () => {
  const resolver = (trabajoId: string, nota: string | null = null) => plan({ trabajoId, nuevoEstado: 'resuelto', nota });

  it('C14: quien lo pidió lo resuelve directamente: los mismos efectos de siempre más la evidencia de recepción', () => {
    const inst = trasC01();
    const texto = 'Ya llegó el compresor, sigo con la instalación';
    const antes = efectosActualizacion(inst, resolver('T31', texto), JOSE);
    const efs = efectosActualizacion(inst, resolver('T31', texto), JOSE, { texto, fuente: 'captura' });
    expect(sinEvidencias(efs)).toEqual(antes);
    expect(avisosDe(efs).map((a) => [a.a, a.ids])).toEqual([[MARIO, ['T05']]]);
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31').estado).toBe('resuelto');
    expect(trabajo(despues, 'T04')).toMatchObject({ estado: 'en_curso', bloqueadoPorId: null });
    expect(despues.evidencias.map((e) => [e.tipo, e.fuente, e.autorId, e.cita])).toEqual([['recepcion', 'captura', JOSE, texto]]);
  });

  it('E1: trabajo sin solicitante resuelto por su responsable con la frase como nota (evidencia de entrega)', () => {
    const inst = instantaneaDesdeSemilla();
    const antes = efectosActualizacion(inst, resolver('T28', 'Ya la envié.'), PAOLA);
    const efs = efectosActualizacion(inst, resolver('T28', 'Ya la envié.'), PAOLA, { texto: 'Ya la envié.', fuente: 'captura' });
    expect(sinEvidencias(efs)).toEqual(antes);
    expect(aplicarEnMemoria(inst, efs).evidencias.map((e) => [e.trabajoId, e.tipo, e.cita])).toEqual([['T28', 'entrega', 'Ya la envié.']]);
  });

  it('E5: Sofía resuelve T22 y mueve T21 con evidencia: mismo resultado más la evidencia', () => {
    const inst = { ...instantaneaDesdeSemilla(), ahora: enCR('2026-11-25', '09:30') };
    const p = plan({
      trabajoId: 'T22',
      nuevoEstado: 'resuelto',
      nota: 'Don Beto recibe mañana jueves en la mañana.',
      reprogramar: [{ trabajoId: 'T21', plazo: enCR('2026-11-26', '12:00') }],
      notasRelacionadas: [{ trabajoId: 'T29', nota: 'Incluir a Don Beto en la ruta del jueves.' }],
    });
    const texto = 'Don Beto recibe mañana jueves en la mañana, muevo la entrega de 1043 al jueves';
    expect(sinEvidencias(efectosActualizacion(inst, p, 'sofia-navarro', { texto, fuente: 'captura' }))).toEqual(
      efectosActualizacion(inst, p, 'sofia-navarro'),
    );
  });

  it('desde el botón, resolver sin evidencia → «Escribe qué entregaste o pega el enlace» (V13); con ella, resuelto', () => {
    const inst = { ...instantaneaDesdeSemilla(), ahora: enCR('2026-11-25', '12:10') };
    expect(errorDe(() => efectosActualizacion(inst, resolver('T28'), PAOLA, { texto: '  ', fuente: 'interfaz' })).message).toBe(
      'Escribe qué entregaste o pega el enlace.',
    );
    const efs = efectosActualizacion(inst, resolver('T28'), PAOLA, { texto: 'Enviada al Hotel Mirador', fuente: 'interfaz' });
    expect(trabajo(aplicarEnMemoria(inst, efs), 'T28').estado).toBe('resuelto');
  });

  it('nadie más puede: desde el botón, ErrorDominio (V13); en la captura se aplica lo demás sin el cambio de estado y se dice', () => {
    const inst = instantaneaDesdeSemilla();
    const e = errorDe(() => efectosActualizacion(inst, resolver('T28'), ANDRES, { texto: 'x', fuente: 'interfaz' }));
    expect(e.message).toBe('Solo Paola Herrera, su responsable, puede darlo por resuelto.');

    const efs = efectosActualizacion(inst, resolver('T28', 'Ya la mandaron.'), ANDRES, { texto: 'Ya la mandaron', fuente: 'captura' });
    expect(efs.some((x) => x.tipo === 'actualizar_trabajo')).toBe(false);
    expect(efs).toContainEqual({ tipo: 'agregar_nota', trabajoId: 'T28', autorId: ANDRES, texto: 'Ya la mandaron.' });
    const registro = accionesDe(efs).find((a) => a.tipo === 'actualizar_trabajo');
    expect(registro?.motivo).toContain(
      '«Enviar cotización de cámara fría a Hotel Mirador» (PEDIDOS-10) no cambió de estado: solo Paola Herrera, su responsable, puede darlo por resuelto',
    );
    expect(aplicarEnMemoria(inst, efs).evidencias).toEqual([]);
  });

  it('el responsable con otro solicitante no resuelve: declara la entrega (V12); T04 sigue bloqueado y se avisa a quien lo pidió', () => {
    const inst = trasC01('08:20');
    const efs = efectosActualizacion(inst, resolver('T31'), LUCIA, { texto: 'Lo traje del proveedor local', fuente: 'interfaz' });
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31')).toMatchObject({
      estado: 'abierto',
      entrega: { porId: LUCIA, nota: 'Lo traje del proveedor local', enlace: null, fuente: 'interfaz' },
    });
    expect(trabajo(despues, 'T04')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31' });
    expect(avisosDe(efs).map((a) => [a.a, a.ids])).toEqual([[JOSE, ['T31']]]);
    expect(accionesDe(efs).map((a) => a.tipo)).toEqual(['registrar_entrega', 'actualizar_trabajo', 'aviso']);
    expect(accionesDe(efs).find((a) => a.tipo === 'actualizar_trabajo')?.motivo).toContain(
      '«Conseguir compresor de 2 HP» (COLINA-8) quedó entregado: falta que José Alfaro confirme que lo recibió',
    );
    expect(despues.seguimientos.map((s) => [s.tipo, s.destinatarioId])).toEqual([['recepcion', JOSE]]);
    expect(despues.evidencias.map((e) => e.tipo)).toEqual(['entrega']);
    // Sin evidencia desde el botón → ErrorDominio.
    expect(errorDe(() => efectosActualizacion(inst, resolver('T31'), LUCIA, { texto: '', fuente: 'interfaz' })).message).toBe(
      'Escribe qué entregaste o pega el enlace.',
    );
  });

  it('en la captura, la entrega cierra el seguimiento de estado una sola vez y la nota del plan también se guarda', () => {
    const base = trasC01('08:20');
    const inst: Instantanea = { ...base, seguimientos: [seguimiento({ id: 'S1', trabajoId: 'T31' })] };
    const efs = efectosActualizacion(inst, resolver('T31', 'Lo traje.'), LUCIA, { texto: 'Ya lo traje del proveedor local', fuente: 'captura' });
    expect(efs.filter((e) => e.tipo === 'actualizar_seguimiento' && e.seguimientoId === 'S1')).toHaveLength(1);
    expect(eventosDe(efs).filter((e) => e.tipo === 'respuesta_seguimiento')).toHaveLength(1);
    expect(trabajo(aplicarEnMemoria(inst, efs), 'T31').entrega?.nota).toBe('Ya lo traje del proveedor local');
    expect(efs).toContainEqual({ tipo: 'agregar_nota', trabajoId: 'T31', autorId: LUCIA, texto: 'Lo traje.' });
  });

  it('en la captura, el responsable de un trabajo bloqueado por otro no puede entregarlo: no cambia y se dice', () => {
    const base = trasC01();
    const inst: Instantanea = {
      ...base,
      trabajos: base.trabajos.map((t) => (t.id === 'T04' ? { ...t, solicitadoPorId: 'marcela-solis' } : t)),
    };
    const efs = efectosActualizacion(inst, resolver('T04'), JOSE, { texto: 'Terminé la instalación', fuente: 'captura' });
    expect(efs.some((e) => e.tipo === 'actualizar_trabajo')).toBe(false);
    expect(accionesDe(efs).find((a) => a.tipo === 'actualizar_trabajo')?.motivo).toContain('no puede declararse entregado');
    expect(() => efectosActualizacion(inst, resolver('T04'), JOSE, { texto: 'Terminé', fuente: 'interfaz' })).toThrow(ErrorDominio);
  });

  it('quien lo pidió, tras una entrega, lo da por resuelto en la captura: cuenta como recepción (aviso al responsable)', () => {
    const inst = entregaDeLucia(trasC01('08:20'));
    const texto = 'Ya llegó el compresor, sigo con la instalación';
    const efs = efectosActualizacion(inst, resolver('T31', texto), JOSE, { texto, fuente: 'captura' });
    const despues = aplicarEnMemoria(inst, efs);
    expect(trabajo(despues, 'T31').estado).toBe('resuelto');
    expect(trabajo(despues, 'T04').estado).toBe('en_curso');
    expect(despues.seguimientos.map((s) => [s.tipo, s.estado])).toEqual([['recepcion', 'respondido']]);
    expect(accionesDe(efs).map((a) => a.tipo)).toEqual(['confirmar_recepcion', 'actualizar_trabajo', 'aviso', 'aviso']);
    expect(eventosDe(efs).map((e) => e.tipo)).toContain('recepcion_confirmada');
    const lucia = avisosDe(efs).find((a) => a.a === LUCIA);
    expect(lucia?.cuerpo).toContain('José Alfaro confirmó que recibió «Conseguir compresor de 2 HP» (COLINA-8)');
    expect(despues.evidencias.map((e) => e.tipo)).toEqual(['entrega', 'recepcion']);
  });

  it('los cambios de estado que no son resolver no piden evidencia', () => {
    const inst = instantaneaDesdeSemilla();
    const efs = efectosActualizacion(inst, plan({ trabajoId: 'T28', nuevoEstado: 'en_curso' }), PAOLA, { texto: '', fuente: 'interfaz' });
    expect(trabajo(aplicarEnMemoria(inst, efs), 'T28').estado).toBe('en_curso');
    expect(aplicarEnMemoria(inst, efs).evidencias).toEqual([]);
  });

  it('sin evidencia (llamadas anteriores a R6b) el resultado es el de siempre: no se aplica la regla 19', () => {
    const inst = trasC01();
    const despues = aplicarEnMemoria(inst, efectosActualizacion(inst, resolver('T31'), LUCIA));
    expect(trabajo(despues, 'T31').estado).toBe('resuelto');
    expect(despues.evidencias).toEqual([]);
  });

  it('un propuesto no genera avisos (regla 15)', () => {
    const base = trasC01();
    const inst: Instantanea = {
      ...base,
      trabajos: base.trabajos.map((t) => (t.id === 'T31' ? { ...t, confirmacion: 'propuesto', duenoPropuestaId: JOSE } : t)),
    };
    const efs = efectosActualizacion(inst, resolver('T31', 'Llegó'), JOSE, { texto: 'Llegó', fuente: 'captura' });
    expect(trabajo(aplicarEnMemoria(inst, efs), 'T04').estado).toBe('en_curso');
    expect(avisosDe(efs)).toEqual([]);
  });
});
