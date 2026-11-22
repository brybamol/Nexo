// Reforma de escalamiento, regla 2: el dueño del resultado puede actuar, no solo enterarse. Motor puro.
// Reasignar, mover el plazo y declarar bloqueo: autorización, registro (R10), avisos (R5) y efecto en el seguimiento
// y en las marcas de riesgo.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { autorizadosParaActuar } from '@/motor/escalamiento';
import type { Instantanea } from '@/motor/instantanea';
import { efectosDeclararBloqueo, efectosMoverPlazo, efectosReasignar } from '@/motor/intervencion';
import { calcularMarcas } from '@/motor/marcas';
import { iniciarSeguimientoUrgente, siguienteEvento, tick } from '@/motor/seguimiento';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const MIE = '2026-11-25';
const JUE = '2026-11-26';
type Accion = Extract<Efecto, { tipo: 'accion' }>;

function mover(inst: Instantanea, ahora: Date): Instantanea {
  const enAhora = { ...inst, ahora };
  return aplicarEnMemoria(enAhora, tick(enAhora));
}
/** Como «Siguiente evento» hasta `hasta`. */
function hasta(inicio: Instantanea, fin: Date): Instantanea {
  let inst = mover(inicio, inicio.ahora);
  for (let sig = siguienteEvento(inst); sig && sig.getTime() <= fin.getTime(); sig = siguienteEvento(inst)) inst = mover(inst, sig);
  return mover(inst, fin);
}
const acciones = (efs: Efecto[]): Accion[] => efs.filter((e): e is Accion => e.tipo === 'accion');
const avisosA = (efs: Efecto[]) => acciones(efs).filter((a) => a.aviso).map((a) => a.accion.destinatarioId);
const avisoDe = (efs: Efecto[], personaId: string) => acciones(efs).filter((a) => a.aviso?.personaId === personaId);
const registro = (efs: Efecto[]) => acciones(efs).filter((a) => a.accion.tipo === 'actualizar_trabajo');
const enRiesgo = (inst: Instantanea) => [...calcularMarcas(inst)].filter(([, m]) => m.enRiesgo).map(([id]) => id).sort();

/** 7:05 de la semilla tras C01: T31 urgente (P1) de Lucía, que bloquea T04; seguimiento S3 abierto. */
function trasC01(o: { proyectoId?: string; responsableId?: string; bloquea?: string[] } = {}): Instantanea {
  const base = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05'));
  const proyectoId = o.proyectoId ?? 'P1';
  const t31: Trabajo = {
    ...(base.trabajos.find((t) => t.id === 'T04') as Trabajo),
    id: 'T31',
    numero: Math.max(...base.trabajos.filter((t) => t.proyectoId === proyectoId).map((t) => t.numero), 0) + 1,
    proyectoId,
    titulo: 'Conseguir un compresor de 2 HP para la cámara de La Colina',
    responsableId: o.responsableId ?? 'lucia-mora',
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
    ...(o.bloquea ?? ['T04']).map(
      (id): Efecto => ({ tipo: 'actualizar_trabajo', trabajoId: id, cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta el compresor' }, actorId: 'jose-alfaro' }),
    ),
  ]);
  return aplicarEnMemoria(conT31, iniciarSeguimientoUrgente(conT31, 'T31'));
}

/** 8:05: el escalamiento de T31 ya llegó a Esteban Castro (responsable de La Colina). */
const a0805 = () => hasta(trasC01(), enCR(MIE, '08:05'));

describe('quién puede actuar (se valida también en el servidor)', () => {
  it('el responsable del proyecto y el responsable de la operación siempre; el del trabajo, el solicitante o la gerente, no', () => {
    const inst = trasC01();
    expect(autorizadosParaActuar(inst, 'T31')).toEqual([
      { personaId: 'esteban-castro', razon: 'proyecto' },
      { personaId: 'andres-vargas', razon: 'operacion' },
    ]);
    for (const p of ['lucia-mora', 'jose-alfaro', 'marcela-solis', 'mario-chaves']) {
      expect(() => efectosReasignar(inst, 'T31', p, 'diego-rojas', '')).toThrow(ErrorDominio);
      expect(() => efectosMoverPlazo(inst, 'T31', p, enCR(JUE, '12:00'), 'Motivo')).toThrow(ErrorDominio);
      expect(() => efectosDeclararBloqueo(inst, 'T31', p, 'Motivo')).toThrow(ErrorDominio);
    }
    expect(() => efectosReasignar(inst, 'T31', 'lucia-mora', 'diego-rojas', '')).toThrow('no puede');
  });

  it('las personas a las que ya se escaló el trabajo (perjudicados de otro proyecto), desde que se les escala', () => {
    // T31 de P3 a cargo de Diego, bloquea COLINA-4 y TRIGAL-3: 8:05 Lucía; 8:35 Esteban y Daniela.
    const inicio = trasC01({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] });
    const antes = hasta(inicio, enCR(MIE, '08:05'));
    expect(autorizadosParaActuar(antes, 'T31').map((a) => a.personaId)).not.toContain('daniela-quesada');
    expect(() => efectosDeclararBloqueo(antes, 'T31', 'daniela-quesada', 'Motivo')).toThrow(ErrorDominio);
    const despues = hasta(inicio, enCR(MIE, '08:35'));
    expect(autorizadosParaActuar(despues, 'T31')).toEqual([
      { personaId: 'lucia-mora', razon: 'proyecto' },
      { personaId: 'esteban-castro', razon: 'escalado' },
      { personaId: 'daniela-quesada', razon: 'escalado' },
      { personaId: 'andres-vargas', razon: 'operacion' },
    ]);
    // El seguimiento está agotado, pero Daniela sigue pudiendo actuar.
    expect(efectosDeclararBloqueo(despues, 'T31', 'daniela-quesada', 'Sin proveedor hasta el lunes').length).toBeGreaterThan(0);
  });

  it('no se actúa sobre un trabajo resuelto ni inexistente', () => {
    const inst = aplicarEnMemoria(trasC01(), [{ tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { estado: 'resuelto', resueltoEn: enCR(MIE, '07:20') }, actorId: 'lucia-mora' }]);
    expect(() => efectosReasignar(inst, 'T31', 'esteban-castro', 'diego-rojas', '')).toThrow('resuelto');
    expect(() => efectosReasignar(inst, 'T99', 'esteban-castro', 'diego-rojas', '')).toThrow(ErrorDominio);
  });
});

describe('reasignar', () => {
  it('Esteban (a quien se escaló a las 8:05) reasigna a Diego: cambia el responsable, cierra el seguimiento, registra y avisa a los dos', () => {
    const inst = a0805();
    const efs = efectosReasignar(inst, 'T31', 'esteban-castro', 'diego-rojas', 'Diego está en bodega y puede buscarlo');
    expect(efs).toContainEqual({ tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { responsableId: 'diego-rojas' }, actorId: 'esteban-castro' });
    expect(efs).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S3', cambios: { estado: 'respondido' } });
    expect(efs).toContainEqual({
      tipo: 'evento',
      evento: expect.objectContaining({ actorId: 'esteban-castro', tipo: 'respuesta_seguimiento', trabajoId: 'T31', datos: expect.objectContaining({ seguimientoId: 'S3', nivel: 2 }) }),
    });
    // R10: una acción con el motivo y el hecho que la originó.
    const [r] = registro(efs);
    expect(r?.accion).toMatchObject({ tipo: 'actualizar_trabajo', destinatarioId: null, trabajoIds: ['T31'] });
    for (const texto of ['Esteban Castro', 'Lucía Mora', 'Diego Rojas', 'Diego está en bodega', '(COLINA-8)']) expect(r?.accion.motivo).toContain(texto);
    expect(r?.accion.hechoOrigen).toContain('Esteban Castro reasignó');
    // Avisa al responsable anterior y al nuevo, uno a cada uno; no al autor.
    expect(avisosA(efs).sort()).toEqual(['diego-rojas', 'lucia-mora']);
    expect(avisoDe(efs, 'diego-rojas')[0]?.aviso?.cuerpo).toContain('José Alfaro'); // quién lo pidió
    expect(avisoDe(efs, 'diego-rojas')[0]?.aviso?.cuerpo).toContain('«Instalar unidad condensadora y compresor» (COLINA-4)'); // qué bloquea
    expect(avisoDe(efs, 'lucia-mora')[0]?.aviso?.cuerpo).toContain('Ya no está a tu cargo');
    // Ningún texto muestra ids internos.
    for (const a of acciones(efs)) expect(`${a.accion.motivo} ${a.aviso?.cuerpo ?? ''}`).not.toMatch(/\bT\d{2}\b|\bS\d\b/);

    const despues = aplicarEnMemoria(inst, efs);
    expect(despues.trabajos.find((t) => t.id === 'T31')?.responsableId).toBe('diego-rojas');
    expect(enRiesgo(despues)).toEqual(enRiesgo(inst)); // reasignar no cambia las marcas
    // El plazo (12:00) aún no vence: Nexo no persigue hasta entonces, y entonces le pide el estado a Diego.
    expect(acciones(tick({ ...despues, ahora: enCR(MIE, '11:59') })).filter((a) => a.accion.trabajoIds.includes('T31'))).toEqual([]);
    const a12 = tick({ ...despues, ahora: enCR(MIE, '12:00') });
    expect(acciones(a12).filter((a) => a.accion.trabajoIds.includes('T31')).map((a) => [a.accion.tipo, a.accion.destinatarioId])).toEqual([['pedir_estado', 'diego-rojas']]);
  });

  it('si el trabajo ya venció, el seguimiento se reprograma para el nuevo responsable (el aviso es la solicitud)', () => {
    // T15 venció el martes; Lucía es la responsable de P3: puede reasignarlo a Diego.
    const inst = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05'));
    const efs = efectosReasignar(inst, 'T15', 'lucia-mora', 'diego-rojas', '');
    expect(efs).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S1', cambios: { estado: 'respondido' } });
    expect(efs).toContainEqual({
      tipo: 'crear_seguimiento',
      seguimiento: {
        id: 'S3',
        trabajoId: 'T15',
        plazoReferencia: enCR('2026-11-24', '17:00'),
        nivel: 0,
        destinatarioId: 'diego-rojas',
        urgente: false,
        proximoEn: enCR(MIE, '11:05'), // 7:05 + 4 horas laborales
        estado: 'pendiente',
        iniciadoEn: enCR(MIE, '07:05'),
        escaladosA: [],
      },
    });
    expect(avisosA(efs)).toEqual(['diego-rojas']); // Lucía es la autora: no se le avisa
    const despues = aplicarEnMemoria(inst, efs);
    const r = tick({ ...despues, ahora: enCR(MIE, '11:05') });
    expect(acciones(r).filter((a) => a.accion.trabajoIds.includes('T15')).map((a) => [a.accion.tipo, a.accion.destinatarioId])).toEqual([['recordatorio', 'diego-rojas']]);
  });

  it('rechaza a una persona inexistente o al mismo responsable', () => {
    const inst = a0805();
    expect(() => efectosReasignar(inst, 'T31', 'esteban-castro', 'nadie', '')).toThrow(ErrorDominio);
    expect(() => efectosReasignar(inst, 'T31', 'esteban-castro', 'lucia-mora', '')).toThrow('ya es');
  });
});

describe('mover el plazo', () => {
  it('Esteban mueve el plazo de T31 al jueves con motivo: cierra el seguimiento, avisa a Lucía y Nexo pide el estado al vencer el nuevo', () => {
    const inst = a0805();
    const efs = efectosMoverPlazo(inst, 'T31', 'esteban-castro', enCR(JUE, '12:00'), 'El proveedor lo trae mañana');
    expect(efs).toContainEqual({ tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { plazo: enCR(JUE, '12:00') }, actorId: 'esteban-castro' });
    expect(efs).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S3', cambios: { estado: 'respondido' } });
    const [r] = registro(efs);
    for (const texto of ['Esteban Castro', 'El proveedor lo trae mañana', 'jue 26 nov, 12:00', 'mié 25 nov, 12:00']) expect(r?.accion.motivo).toContain(texto);
    expect(avisosA(efs)).toEqual(['lucia-mora']);
    expect(avisoDe(efs, 'lucia-mora')[0]?.aviso?.cuerpo).toContain('El proveedor lo trae mañana');
    const despues = aplicarEnMemoria(inst, efs);
    expect(siguienteEvento(despues)?.getTime()).not.toBe(enCR(MIE, '08:35').getTime()); // no hay escalamiento 2
    const jue = tick({ ...despues, ahora: enCR(JUE, '12:00') });
    expect(acciones(jue).filter((a) => a.accion.trabajoIds.includes('T31')).map((a) => [a.accion.tipo, a.accion.destinatarioId])).toEqual([['pedir_estado', 'lucia-mora']]);
  });

  it('quitar el atraso quita el riesgo de los dependientes y se les avisa, uno por persona (R5)', () => {
    // 7:05: T15 atrasado deja en riesgo T16 (Lucía), T17 (Karla) y T18 (Marcela). Andrés, responsable de la
    // operación, mueve el plazo de T15 al jueves.
    const inst = mover(instantaneaDesdeSemilla(), enCR(MIE, '07:05'));
    expect(enRiesgo(inst)).toEqual(['T16', 'T17', 'T18']);
    const efs = efectosMoverPlazo(inst, 'T15', 'andres-vargas', enCR(JUE, '17:00'), 'Diego hace el conteo hoy');
    expect(enRiesgo(aplicarEnMemoria(inst, efs))).toEqual([]);
    expect(avisosA(efs).sort()).toEqual(['karla-jimenez', 'lucia-mora', 'marcela-solis']);
    // Lucía: responsable del trabajo y de P3 y de T16, en un solo aviso.
    const lucia = avisoDe(efs, 'lucia-mora');
    expect(lucia).toHaveLength(1);
    expect(lucia[0]?.aviso?.cuerpo).toContain('Andrés Vargas movió el plazo');
    expect(lucia[0]?.aviso?.cuerpo).toContain('«Definir mínimos por repuesto» (REPUESTOS-3) ya no está en riesgo');
    expect(avisoDe(efs, 'karla-jimenez')[0]?.aviso?.cuerpo).toContain('«Cotizar el reorden con dos proveedores» (REPUESTOS-4) ya no está en riesgo');
  });

  it('pide un plazo futuro, distinto del actual, y un motivo', () => {
    const inst = a0805();
    expect(() => efectosMoverPlazo(inst, 'T31', 'esteban-castro', enCR(MIE, '08:05'), 'Motivo')).toThrow('posterior');
    expect(() => efectosMoverPlazo(inst, 'T31', 'esteban-castro', enCR(MIE, '12:00'), 'Motivo')).toThrow(ErrorDominio);
    expect(() => efectosMoverPlazo(inst, 'T31', 'esteban-castro', enCR(JUE, '12:00'), '   ')).toThrow('motivo');
  });
});

describe('declarar bloqueo', () => {
  it('Andrés (responsable de Pedidos) declara bloqueada la reprogramación de 1043: sus dependientes quedan en riesgo y se avisa (R4, R5)', () => {
    const inst = mover(instantaneaDesdeSemilla(), enCR(MIE, '08:05'));
    const efs = efectosDeclararBloqueo(inst, 'T22', 'andres-vargas', 'Don Beto no contesta el teléfono');
    expect(efs).toContainEqual({
      tipo: 'actualizar_trabajo',
      trabajoId: 'T22',
      cambios: { estado: 'bloqueado', bloqueadoPorId: null, motivoBloqueo: 'Don Beto no contesta el teléfono', fechaSolucion: null },
      actorId: 'andres-vargas',
    });
    const despues = aplicarEnMemoria(inst, efs);
    expect(enRiesgo(despues)).toContain('T21');
    expect(avisosA(efs).sort()).toEqual(['diego-rojas', 'sofia-navarro']);
    expect(avisoDe(efs, 'diego-rojas')[0]?.aviso?.cuerpo).toContain('queda en riesgo');
    expect(avisoDe(efs, 'sofia-navarro')[0]?.aviso?.cuerpo).toContain('Don Beto no contesta el teléfono');
    const [r] = registro(efs);
    expect(r?.accion.motivo).toContain('Don Beto no contesta el teléfono');
    expect(r?.accion.trabajoIds).toEqual(['T22']);
  });

  it('cierra el seguimiento pendiente y avisa a los demás a quienes se escaló', () => {
    // T31 de P3 a cargo de Diego: a las 8:35 ya se escaló a Lucía, Esteban y Daniela. Lucía declara el bloqueo.
    const inst = hasta(trasC01({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] }), enCR(MIE, '08:05'));
    const efs = efectosDeclararBloqueo(inst, 'T31', 'lucia-mora', 'El proveedor local no tiene compresores');
    expect(efs).toContainEqual({ tipo: 'actualizar_seguimiento', seguimientoId: 'S3', cambios: { estado: 'respondido' } });
    expect(avisosA(efs)).toEqual(['diego-rojas']); // el responsable; Lucía es la autora y nadie más tenía el escalamiento
    const despues = aplicarEnMemoria(inst, efs);
    expect(tick({ ...despues, ahora: enCR(MIE, '08:35') }).filter((e) => e.tipo === 'accion')).toEqual([]);

    const tarde = hasta(trasC01({ proyectoId: 'P3', responsableId: 'diego-rojas', bloquea: ['T04', 'T10'] }), enCR(MIE, '08:35'));
    const efs2 = efectosDeclararBloqueo(tarde, 'T31', 'esteban-castro', 'El proveedor local no tiene compresores');
    expect(avisosA(efs2).sort()).toEqual(['daniela-quesada', 'diego-rojas', 'lucia-mora']);
    expect(avisoDe(efs2, 'daniela-quesada')[0]?.aviso?.cuerpo).toContain('Esteban Castro ya actuó');
  });

  it('rechaza un trabajo ya bloqueado o sin motivo', () => {
    const inst = a0805();
    expect(() => efectosDeclararBloqueo(inst, 'T04', 'esteban-castro', 'Motivo')).toThrow('ya está bloqueado');
    expect(() => efectosDeclararBloqueo(inst, 'T31', 'esteban-castro', '')).toThrow('motivo');
  });
});
