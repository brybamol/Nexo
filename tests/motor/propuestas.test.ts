// Propuestas de Nexo: seguimiento, revisión y revisión de captura (docs/08 reglas 15–17; tarea R3). Puras.
import { describe, expect, it } from 'vitest';
import { idsInternosEn } from '@/dominio/nombres';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type EvidenciaTrabajo, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { efectosRevision, revisionDeCaptura, seguimientoDePropuesta } from '@/motor/propuestas';
import { siguienteEvento, tick } from '@/motor/seguimiento';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const LUN = '2026-11-23';
const MAR = '2026-11-24';
const MIE = '2026-11-25';
const JUE = '2026-11-26';
const VIE = '2026-11-27';

type Accion = Extract<Efecto, { tipo: 'accion' }>;
const acciones = (es: Efecto[]): Accion[] => es.filter((e): e is Accion => e.tipo === 'accion');
const deTipo = <T extends Efecto['tipo']>(es: Efecto[], tipo: T) => es.filter((e): e is Extract<Efecto, { tipo: T }> => e.tipo === tipo);

function nuevoTrabajo(inst: Instantanea, extra: Partial<Trabajo>): Trabajo {
  const base = inst.trabajos.find((t) => t.id === 'T28') as Trabajo;
  return {
    ...base,
    estado: 'abierto',
    urgente: false,
    conCostoProbable: false,
    origen: 'correo',
    capturaId: null,
    creadoEn: inst.ahora,
    resueltoEn: null,
    confirmacion: 'propuesto',
    confirmadoPorId: null,
    entrega: null,
    ...extra,
  } as Trabajo;
}

function evidencia(inst: Instantanea, e: Omit<EvidenciaTrabajo, 'id' | 'fuente' | 'enlaces' | 'compromisoClave' | 'mensajeId'>): EvidenciaTrabajo {
  return { id: inst.evidencias.length + 1, fuente: 'correo', enlaces: {}, compromisoClave: `c-${e.trabajoId}`, mensajeId: `<${e.trabajoId}-${e.tipo}@friodelvalle.cr>`, ...e };
}

const CITA_M01 = 'Diego, ¿puedes enviarme las guías de entrega firmadas de los pedidos 1041 y 1042? Las necesito antes del 27 de noviembre para facturar.';

/**
 * Como tras V1 (lectura de las 7:05): M01 propuesto de Ricardo (entregado por Diego), M02 propuesto de Esteban, M03
 * confirmado por dos fuentes (Andrés y Ricardo) que depende de T28, y los seguimientos `propuesta` de M01 y M02.
 */
function trasLectura(): Instantanea {
  const semilla = instantaneaDesdeSemilla();
  let inst: Instantanea = { ...semilla, ahora: enCR(MIE, '07:05') };
  const m01 = nuevoTrabajo(inst, {
    id: 'M01',
    proyectoId: 'P4',
    numero: 13,
    titulo: 'Enviar las guías de entrega firmadas de los pedidos 1041 y 1042',
    responsableId: 'diego-rojas',
    solicitadoPorId: 'ricardo-brenes',
    plazo: enCR(VIE, '17:00'),
    duenoPropuestaId: 'ricardo-brenes',
    entrega: { en: enCR(MAR, '16:30'), porId: 'diego-rojas', nota: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.', enlace: null, fuente: 'correo' },
  });
  const m02 = nuevoTrabajo(inst, {
    id: 'M02',
    proyectoId: 'P2',
    numero: 7,
    titulo: 'Enviar las fotos del mantenimiento de Heredia y Alajuela',
    responsableId: 'daniela-quesada',
    solicitadoPorId: 'esteban-castro',
    plazo: enCR(VIE, '17:00'),
    duenoPropuestaId: 'esteban-castro',
  });
  const m03 = nuevoTrabajo(inst, {
    id: 'M03',
    proyectoId: 'P4',
    numero: 14,
    titulo: 'Emitir la factura proforma de la cámara fría del Hotel Mirador',
    responsableId: 'ricardo-brenes',
    solicitadoPorId: 'andres-vargas',
    plazo: enCR(VIE, '17:00'),
    confirmacion: 'confirmado',
    duenoPropuestaId: null,
  });
  inst = aplicarEnMemoria(inst, [
    { tipo: 'crear_trabajo', trabajo: m01, necesidades: [], actorId: null },
    { tipo: 'crear_trabajo', trabajo: m02, necesidades: [], actorId: null },
    { tipo: 'crear_trabajo', trabajo: m03, necesidades: [], actorId: null },
    { tipo: 'crear_dependencia', dependencia: { trabajoId: 'M03', dependeDeId: 'T28' }, actorId: null },
  ]);
  inst.evidencias.push(
    evidencia(inst, { trabajoId: 'M01', tipo: 'pedido', buzones: ['ricardo-brenes'], autorId: 'ricardo-brenes', en: enCR(LUN, '15:00'), cita: CITA_M01 }),
  );
  inst.evidencias.push(
    evidencia(inst, { trabajoId: 'M01', tipo: 'entrega', buzones: ['ricardo-brenes'], autorId: 'diego-rojas', en: enCR(MAR, '16:30'), cita: 'Ricardo, te adjunto las guías firmadas de 1041 y 1042.' }),
  );
  inst.evidencias.push(
    evidencia(inst, { trabajoId: 'M02', tipo: 'pedido', buzones: ['esteban-castro'], autorId: 'esteban-castro', en: enCR(MAR, '17:00'), cita: 'Daniela, ¿puedes enviarme las fotos…?' }),
  );
  inst.evidencias.push(
    evidencia(inst, { trabajoId: 'M03', tipo: 'pedido', buzones: ['andres-vargas', 'ricardo-brenes'], autorId: 'andres-vargas', en: enCR(MIE, '08:20'), cita: 'Ricardo, ¿puedes emitir la factura proforma…?' }),
  );
  inst = aplicarEnMemoria(inst, seguimientoDePropuesta(inst, 'M01'));
  inst = aplicarEnMemoria(inst, seguimientoDePropuesta(inst, 'M02'));
  return inst;
}

const trabajoDe = (inst: Instantanea, id: string) => inst.trabajos.find((t) => t.id === id) as Trabajo;
const enHora = (inst: Instantanea, ahora: Date): Instantanea => ({ ...inst, ahora });

describe('seguimientoDePropuesta (regla 15)', () => {
  it('abre un seguimiento «propuesta» nivel 0 al dueño, que vence a las 4 horas laborales; sin acción ni aviso', () => {
    const inst = trasLectura();
    const s = inst.seguimientos.filter((x) => x.trabajoId === 'M01');
    expect(s).toEqual([
      {
        id: 'S1',
        trabajoId: 'M01',
        tipo: 'propuesta',
        nivel: 0,
        destinatarioId: 'ricardo-brenes',
        urgente: false,
        plazoReferencia: enCR(MIE, '07:05'),
        iniciadoEn: enCR(MIE, '07:05'),
        proximoEn: enCR(MIE, '11:05'),
        estado: 'pendiente',
        escaladosA: [],
      },
    ]);
    expect(inst.seguimientos.map((x) => x.id)).toEqual(['S1', 'S2']);
  });

  it('solo emite crear_seguimiento; nada si no es propuesto o ya tiene uno pendiente; error si no existe', () => {
    const inst = trasLectura();
    const base = { ...inst, seguimientos: [] };
    expect(seguimientoDePropuesta(base, 'M01').map((e) => e.tipo)).toEqual(['crear_seguimiento']);
    expect(seguimientoDePropuesta(inst, 'M01')).toEqual([]); // ya tiene uno pendiente
    expect(seguimientoDePropuesta(inst, 'M03')).toEqual([]); // confirmado
    expect(seguimientoDePropuesta(inst, 'T28')).toEqual([]);
    expect(() => seguimientoDePropuesta(inst, 'M99')).toThrow(ErrorDominio);
  });

  it('propuesta creada a las 15:00 vence al día hábil siguiente (horas laborales)', () => {
    const inst = trasLectura();
    const tarde = aplicarEnMemoria({ ...inst, ahora: enCR(MIE, '15:00') }, [
      { tipo: 'crear_trabajo', trabajo: nuevoTrabajo({ ...inst, ahora: enCR(MIE, '15:00') }, { id: 'M04', numero: 15, duenoPropuestaId: 'paola-herrera' }), necesidades: [], actorId: null },
    ]);
    const [e] = seguimientoDePropuesta(tarde, 'M04');
    expect(e?.tipo === 'crear_seguimiento' && e.seguimiento.proximoEn).toEqual(enCR(JUE, '09:00'));
  });
});

describe('recordatorio de la propuesta en el tick (regla 15, V4)', () => {
  it('a las 11:05: un recordatorio a cada dueño y el seguimiento queda agotado; nada a Diego ni a Daniela', () => {
    const inst = trasLectura();
    expect(siguienteEvento(inst)).toEqual(enCR(MIE, '10:00')); // T22 vence antes (semilla)
    const a1105 = enHora(inst, enCR(MIE, '11:05'));
    const efectos = tick(a1105);
    const sobreM = acciones(efectos).filter((a) => a.accion.trabajoIds.some((id) => id.startsWith('M')));
    expect(sobreM.map((a) => ({ tipo: a.accion.tipo, a: a.accion.destinatarioId, t: a.accion.trabajoIds }))).toEqual([
      { tipo: 'recordatorio', a: 'ricardo-brenes', t: ['M01'] },
      { tipo: 'recordatorio', a: 'esteban-castro', t: ['M02'] },
    ]);
    const r = sobreM[0]!;
    expect(r.aviso?.titulo).toBe('Tienes una propuesta de Nexo sin revisar: «Enviar las guías de entrega firmadas de los pedidos 1041 y 1042»');
    expect(r.aviso?.personaId).toBe('ricardo-brenes');
    expect(idsInternosEn(`${r.aviso?.titulo} ${r.aviso?.cuerpo} ${r.accion.motivo} ${r.accion.hechoOrigen}`)).toEqual([]);
    expect(acciones(efectos).some((a) => ['diego-rojas', 'daniela-quesada'].includes(a.accion.destinatarioId ?? '') && a.accion.trabajoIds.some((id) => id.startsWith('M')))).toBe(false);

    const despues = aplicarEnMemoria(a1105, efectos);
    expect(despues.seguimientos.filter((s) => s.tipo === 'propuesta').map((s) => [s.trabajoId, s.nivel, s.estado])).toEqual([
      ['M01', 1, 'agotado'],
      ['M02', 1, 'agotado'],
    ]);
    // A las 15:05, nada más sobre M01/M02.
    const tarde = tick(enHora(despues, enCR(MIE, '15:05')));
    expect(acciones(tarde).filter((a) => a.accion.trabajoIds.some((id) => id.startsWith('M')))).toEqual([]);
  });

  it('siguienteEvento ve el recordatorio de la propuesta (11:05) y, tras él, ya nada de las propuestas', () => {
    const completa = trasLectura();
    const solo = {
      ...completa,
      ahora: enCR(MIE, '10:30'),
      trabajos: completa.trabajos.filter((t) => t.id.startsWith('M')),
      dependencias: [],
      necesidades: [],
    };
    expect(siguienteEvento(solo)).toEqual(enCR(MIE, '11:05'));
    const tras = aplicarEnMemoria(enHora(solo, enCR(MIE, '11:05')), tick(enHora(solo, enCR(MIE, '11:05'))));
    expect(siguienteEvento(tras)).toEqual(enCR(VIE, '17:00')); // solo el plazo de M03 (confirmado)
  });

  it('un propuesto vencido no recibe pedir_estado (R1 lo omite)', () => {
    const inst = trasLectura();
    const viernes = tick(enHora(inst, enCR(VIE, '17:30')));
    const sobreM01 = acciones(viernes).filter((a) => a.accion.trabajoIds.includes('M01') || a.accion.trabajoIds.includes('M02'));
    expect(sobreM01.map((a) => a.accion.tipo)).toEqual(['recordatorio', 'recordatorio']);
  });
});

describe('efectosRevision · quién puede revisar (regla 16, V10)', () => {
  it('solo el dueño revisa un propuesto: Daniela no puede confirmar M02', () => {
    const inst = trasLectura();
    expect(() => efectosRevision(inst, 'M02', 'daniela-quesada', { tipo: 'confirmar' })).toThrow(ErrorDominio);
    expect(() => efectosRevision(inst, 'M02', 'daniela-quesada', { tipo: 'confirmar' })).toThrow(
      'Solo Esteban Castro puede revisar «Enviar las fotos del mantenimiento de Heredia y Alajuela» (TRIGAL-7).',
    );
  });

  it('confirmado por dos fuentes y sin revisión humana: cualquiera de las dos partes, nadie más', () => {
    const inst = trasLectura();
    expect(() => efectosRevision(inst, 'M03', 'andres-vargas', { tipo: 'confirmar' })).not.toThrow();
    expect(() => efectosRevision(inst, 'M03', 'ricardo-brenes', { tipo: 'confirmar' })).not.toThrow();
    expect(() => efectosRevision(inst, 'M03', 'marcela-solis', { tipo: 'confirmar' })).toThrow(
      'Solo Andrés Vargas o Ricardo Brenes puede revisar «Emitir la factura proforma de la cámara fría del Hotel Mirador» (PEDIDOS-14).',
    );
  });

  it('nadie revisa lo ya afirmado por una persona, ni lo que no es del correo, ni lo descartado', () => {
    const inst = trasLectura();
    const confirmado = aplicarEnMemoria(inst, efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'confirmar' }));
    expect(() => efectosRevision(confirmado, 'M01', 'ricardo-brenes', { tipo: 'confirmar' })).toThrow(ErrorDominio);
    expect(() => efectosRevision(inst, 'T28', 'paola-herrera', { tipo: 'confirmar' })).toThrow(ErrorDominio);
    const descartado = aplicarEnMemoria(inst, efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'descartar', motivo: null }));
    expect(() => efectosRevision(descartado, 'M01', 'ricardo-brenes', { tipo: 'confirmar' })).toThrow(ErrorDominio);
    expect(() => efectosRevision(inst, 'M99', 'ricardo-brenes', { tipo: 'confirmar' })).toThrow(ErrorDominio);
  });
});

describe('efectosRevision · confirmar (V7)', () => {
  it('Ricardo confirma M01: confirmado por él, revisión confirmada [], seguimiento respondido, sin aviso (tiene entrega)', () => {
    const inst = { ...trasLectura(), ahora: enCR(MIE, '08:21') };
    const efectos = efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'confirmar' });
    const despues = aplicarEnMemoria(inst, efectos);
    const m01 = trabajoDe(despues, 'M01');
    expect([m01.confirmacion, m01.confirmadoPorId, m01.duenoPropuestaId]).toEqual(['confirmado', 'ricardo-brenes', 'ricardo-brenes']);

    const [rev] = deTipo(efectos, 'registrar_revision');
    expect(rev?.revision).toEqual({
      en: enCR(MIE, '08:21'),
      personaId: 'ricardo-brenes',
      origen: 'correo',
      trabajoId: 'M01',
      capturaId: null,
      resultado: 'confirmada',
      campos: [],
      propuesto: { titulo: m01.titulo, responsableId: 'diego-rojas', plazo: enCR(VIE, '17:00'), proyectoId: 'P4' },
      final: { titulo: m01.titulo, responsableId: 'diego-rojas', plazo: enCR(VIE, '17:00'), proyectoId: 'P4' },
      entrada: { cita: CITA_M01, deId: 'ricardo-brenes', enviado: enCR(LUN, '15:00') },
      motivo: null,
    });

    const as = acciones(efectos);
    expect(as.map((a) => [a.accion.tipo, a.accion.destinatarioId, a.aviso])).toEqual([['revisar_propuesta', null, null]]);
    expect(idsInternosEn(`${as[0]!.accion.motivo} ${as[0]!.accion.hechoOrigen}`)).toEqual([]);
    expect(deTipo(efectos, 'evento').map((e) => e.evento)).toEqual([
      { en: enCR(MIE, '08:21'), actorId: 'ricardo-brenes', tipo: 'propuesta_revisada', trabajoId: 'M01', decisionId: null, datos: { resultado: 'confirmada', campos: [] } },
    ]);
    expect(despues.seguimientos.find((s) => s.trabajoId === 'M01' && s.tipo === 'propuesta')?.estado).toBe('respondido');
  });

  it('con entrega y revisa el solicitante: abre en silencio el seguimiento «recepcion» (regla 16 → 20)', () => {
    const inst = { ...trasLectura(), ahora: enCR(MIE, '08:21') };
    const despues = aplicarEnMemoria(inst, efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'confirmar' }));
    const rec = despues.seguimientos.filter((s) => s.trabajoId === 'M01' && s.tipo === 'recepcion');
    expect(rec).toEqual([
      {
        id: 'S3',
        trabajoId: 'M01',
        tipo: 'recepcion',
        nivel: 0,
        destinatarioId: 'ricardo-brenes',
        urgente: false,
        plazoReferencia: enCR(MAR, '16:30'),
        iniciadoEn: enCR(MIE, '08:21'),
        proximoEn: enCR(MIE, '12:21'),
        estado: 'pendiente',
        escaladosA: [],
      },
    ]);
    // Tras confirmar no hay pedir_estado (entregado) ni nada antes del recordatorio de recepción.
    expect(acciones(tick(enHora(despues, enCR(MIE, '12:00')))).filter((a) => a.accion.trabajoIds.includes('M01'))).toEqual([]);
    const a1221 = tick(enHora(despues, enCR(MIE, '12:21')));
    const rec1221 = acciones(a1221).filter((a) => a.accion.trabajoIds.includes('M01'));
    expect(rec1221.map((a) => [a.accion.tipo, a.accion.destinatarioId])).toEqual([['recordatorio', 'ricardo-brenes']]);
    expect(idsInternosEn(`${rec1221[0]!.aviso?.titulo} ${rec1221[0]!.aviso?.cuerpo} ${rec1221[0]!.accion.motivo}`)).toEqual([]);
    const final = aplicarEnMemoria(enHora(despues, enCR(MIE, '12:21')), a1221);
    expect(final.seguimientos.find((s) => s.id === 'S3')).toMatchObject({ nivel: 1, estado: 'agotado' });
    // Nunca escala: el día siguiente, nada sobre M01.
    expect(acciones(tick(enHora(final, enCR(JUE, '16:00')))).filter((a) => a.accion.trabajoIds.includes('M01'))).toEqual([]);
  });

  it('una parte confirma M03 (dos fuentes): confirmadoPorId = persona; aviso de asignación al responsable si es otro', () => {
    const inst = { ...trasLectura(), ahora: enCR(MIE, '08:30') };
    const efectos = efectosRevision(inst, 'M03', 'andres-vargas', { tipo: 'confirmar' });
    const m03 = trabajoDe(aplicarEnMemoria(inst, efectos), 'M03');
    expect([m03.confirmacion, m03.confirmadoPorId]).toEqual(['confirmado', 'andres-vargas']);
    const avisos = acciones(efectos).filter((a) => a.accion.tipo === 'aviso');
    expect(avisos.map((a) => [a.accion.destinatarioId, a.aviso?.personaId, a.accion.trabajoIds])).toEqual([['ricardo-brenes', 'ricardo-brenes', ['M03']]]);
    expect(idsInternosEn(`${avisos[0]!.aviso?.titulo} ${avisos[0]!.aviso?.cuerpo} ${avisos[0]!.accion.motivo}`)).toEqual([]);
    // Si confirma el propio responsable, no hay aviso.
    expect(acciones(efectosRevision(inst, 'M03', 'ricardo-brenes', { tipo: 'confirmar' })).map((a) => a.accion.tipo)).toEqual(['revisar_propuesta']);
  });

  it('tras confirmar un propuesto ya vencido, el siguiente tick pide el estado (R1 aplica desde ese momento)', () => {
    const sinEntrega = { ...trasLectura(), ahora: enCR(VIE, '17:30') };
    expect(acciones(tick(sinEntrega)).filter((a) => a.accion.tipo === 'pedir_estado' && a.accion.trabajoIds.includes('M02'))).toEqual([]);
    const confirmado = aplicarEnMemoria(sinEntrega, efectosRevision(sinEntrega, 'M02', 'esteban-castro', { tipo: 'confirmar' }));
    const pedidos = acciones(tick(confirmado)).filter((a) => a.accion.tipo === 'pedir_estado' && a.accion.trabajoIds.includes('M02'));
    expect(pedidos.map((a) => a.accion.destinatarioId)).toEqual(['daniela-quesada']);
  });
});

describe('efectosRevision · corregir (V8)', () => {
  it('Esteban corrige el plazo de M02: aplica, confirma, revisión corregida [plazo], aviso de asignación a Daniela', () => {
    const inst = { ...trasLectura(), ahora: enCR(MIE, '08:22') };
    const efectos = efectosRevision(inst, 'M02', 'esteban-castro', { tipo: 'corregir', cambios: { plazo: enCR(JUE, '17:00') } });
    const despues = aplicarEnMemoria(inst, efectos);
    const m02 = trabajoDe(despues, 'M02');
    expect([m02.plazo, m02.confirmacion, m02.confirmadoPorId, m02.numero]).toEqual([enCR(JUE, '17:00'), 'confirmado', 'esteban-castro', 7]);
    const [rev] = deTipo(efectos, 'registrar_revision');
    expect(rev?.revision.resultado).toBe('corregida');
    expect(rev?.revision.campos).toEqual(['plazo']);
    expect(rev?.revision.propuesto.plazo).toEqual(enCR(VIE, '17:00'));
    expect(rev?.revision.final?.plazo).toEqual(enCR(JUE, '17:00'));
    const avisos = acciones(efectos).filter((a) => a.accion.tipo === 'aviso');
    expect(avisos.map((a) => a.accion.destinatarioId)).toEqual(['daniela-quesada']);
    expect(avisos[0]!.aviso?.cuerpo).toContain('jue 26');
    expect(despues.seguimientos.find((s) => s.trabajoId === 'M02' && s.tipo === 'propuesta')?.estado).toBe('respondido');
    expect(deTipo(efectos, 'evento').map((e) => e.evento.datos)).toEqual([{ resultado: 'corregida', campos: ['plazo'] }]);
  });

  it('sin ningún cambio real → «No cambiaste nada»', () => {
    const inst = trasLectura();
    const m02 = trabajoDe(inst, 'M02');
    expect(() => efectosRevision(inst, 'M02', 'esteban-castro', { tipo: 'corregir', cambios: {} })).toThrow('No cambiaste nada');
    expect(() =>
      efectosRevision(inst, 'M02', 'esteban-castro', {
        tipo: 'corregir',
        cambios: { titulo: ` ${m02.titulo} `, responsableId: m02.responsableId, plazo: new Date(m02.plazo.getTime()), proyectoId: 'P2' },
      }),
    ).toThrow('No cambiaste nada');
  });

  it('varios campos a la vez, en orden fijo; cambiar el proyecto da el siguiente número del proyecto nuevo', () => {
    const inst = trasLectura();
    const efectos = efectosRevision(inst, 'M02', 'esteban-castro', {
      tipo: 'corregir',
      cambios: { proyectoId: 'P4', responsableId: 'jose-alfaro', titulo: 'Enviar fotos de Heredia y Alajuela' },
    });
    const m02 = trabajoDe(aplicarEnMemoria(inst, efectos), 'M02');
    expect([m02.proyectoId, m02.numero, m02.responsableId, m02.titulo]).toEqual(['P4', 15, 'jose-alfaro', 'Enviar fotos de Heredia y Alajuela']);
    expect(deTipo(efectos, 'registrar_revision')[0]?.revision.campos).toEqual(['titulo', 'responsable', 'proyecto']);
    // El aviso de asignación va al nuevo responsable, ya con la referencia nueva.
    const aviso = acciones(efectos).find((a) => a.accion.tipo === 'aviso');
    expect(aviso?.accion.destinatarioId).toBe('jose-alfaro');
    expect(aviso?.aviso?.cuerpo).toContain('PEDIDOS-15');
  });

  it('valida los datos: título vacío, persona o proyecto que no existen', () => {
    const inst = trasLectura();
    const corregir = (cambios: object) => () => efectosRevision(inst, 'M02', 'esteban-castro', { tipo: 'corregir', cambios });
    expect(corregir({ titulo: '   ' })).toThrow(ErrorDominio);
    expect(corregir({ responsableId: 'nadie' })).toThrow(ErrorDominio);
    expect(corregir({ proyectoId: 'P9' })).toThrow(ErrorDominio);
  });

  it('corregir el responsable al propio revisor: no hay aviso de asignación', () => {
    const inst = trasLectura();
    const efectos = efectosRevision(inst, 'M02', 'esteban-castro', { tipo: 'corregir', cambios: { responsableId: 'esteban-castro' } });
    expect(acciones(efectos).map((a) => a.accion.tipo)).toEqual(['revisar_propuesta']);
  });
});

describe('efectosRevision · descartar (V9)', () => {
  it('Ricardo descarta M01: sale de trabajos, queda en descartados con su número; revisión descartada con motivo', () => {
    const inst = { ...trasLectura(), ahora: enCR(MIE, '08:30') };
    const efectos = efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'descartar', motivo: '  Ya lo tengo en papel  ' });
    const despues = aplicarEnMemoria(inst, efectos);
    expect(despues.trabajos.some((t) => t.id === 'M01')).toBe(false);
    expect(despues.descartados).toEqual([{ id: 'M01', proyectoId: 'P4', numero: 13 }]);
    expect(despues.seguimientos.some((s) => s.trabajoId === 'M01')).toBe(false);
    // El cierre del seguimiento va antes del descarte (la base lo guarda cerrado).
    const tipos = efectos.map((e) => e.tipo);
    expect(tipos.indexOf('actualizar_seguimiento')).toBeLessThan(tipos.indexOf('actualizar_trabajo'));
    const [rev] = deTipo(efectos, 'registrar_revision');
    expect(rev?.revision).toMatchObject({ resultado: 'descartada', campos: [], final: null, motivo: 'Ya lo tengo en papel' });
    expect(acciones(efectos).map((a) => a.accion.tipo)).toEqual(['revisar_propuesta']);
    expect(deTipo(efectos, 'evento').map((e) => e.evento.datos)).toEqual([{ resultado: 'descartada', campos: [] }]);
    // Motivo vacío → null.
    const sinMotivo = efectosRevision(inst, 'M01', 'ricardo-brenes', { tipo: 'descartar', motivo: '  ' });
    expect(deTipo(sinMotivo, 'registrar_revision')[0]?.revision.motivo).toBeNull();
  });
});

describe('revisionDeCaptura (regla 17)', () => {
  const datos = {
    capturaId: 7,
    personaId: 'karla-jimenez',
    en: enCR(MIE, '09:00'),
    texto: 'Hay que revisar el inventario de empaques',
    titulo: 'Revisar el inventario de empaques',
    plazo: enCR(MIE, '17:00'),
    proyectoId: 'P3',
    trabajoId: 'T31',
  };

  it('la primera opción → confirmada []', () => {
    expect(revisionDeCaptura('lucia-mora', 'lucia-mora', datos)).toEqual({
      en: enCR(MIE, '09:00'),
      personaId: 'karla-jimenez',
      origen: 'captura',
      trabajoId: 'T31',
      capturaId: 7,
      resultado: 'confirmada',
      campos: [],
      propuesto: { titulo: 'Revisar el inventario de empaques', responsableId: 'lucia-mora', plazo: enCR(MIE, '17:00'), proyectoId: 'P3' },
      final: { titulo: 'Revisar el inventario de empaques', responsableId: 'lucia-mora', plazo: enCR(MIE, '17:00'), proyectoId: 'P3' },
      entrada: { texto: 'Hay que revisar el inventario de empaques' },
      motivo: null,
    });
  });

  it('otra opción → corregida [responsable], con el elegido en final', () => {
    const r = revisionDeCaptura('lucia-mora', 'diego-rojas', { ...datos, trabajoId: null, plazo: null });
    expect(r.resultado).toBe('corregida');
    expect(r.campos).toEqual(['responsable']);
    expect(r.propuesto.responsableId).toBe('lucia-mora');
    expect(r.final).toEqual({ titulo: 'Revisar el inventario de empaques', responsableId: 'diego-rojas', plazo: null, proyectoId: 'P3' });
    expect(r.trabajoId).toBeNull();
  });
});
