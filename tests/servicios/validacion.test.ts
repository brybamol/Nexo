// Validación determinista de propuestas repetidas (venga la propuesta del intérprete Local o de Claude). Pura.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Decision, Trabajo } from '@/dominio/tipos';
import type { Interpretacion, InterpretacionDe } from '@/ia/interprete';
import { aplicarEnMemoria } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { validarInterpretacion } from '@/servicios/validacion';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const MIE = '2026-11-25';

/** Semilla a las 7:05 con T31 (conseguir compresor, de Lucía) bloqueando T04. */
function conT31(): Instantanea {
  const base = { ...instantaneaDesdeSemilla(), ahora: enCR(MIE, '07:05') };
  const t04 = base.trabajos.find((t) => t.id === 'T04') as Trabajo;
  const t31: Trabajo = {
    ...t04,
    id: 'T31',
    numero: 8, // COLINA-8
    titulo: 'Conseguir compresor de 2 HP',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR(MIE, '12:00'),
    estado: 'abierto',
    urgente: true,
    repuestoId: 'compresor-2hp',
    origen: 'captura',
    creadoEn: enCR(MIE, '07:05'),
  };
  return aplicarEnMemoria(base, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: 'jose-alfaro' },
    { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Falta compresor de 2 HP' }, actorId: 'jose-alfaro' },
  ]);
}

/** Lo que podría proponer Claude: otro título, responsable no seguro. */
const comoClaude: InterpretacionDe<'trabajo_nuevo'> = {
  tipo: 'trabajo_nuevo',
  titulo: 'Compresor faltante para la instalación de La Colina',
  proyectoId: 'P1',
  responsableId: 'lucia-mora',
  responsableSeguro: false,
  plazo: { dia: 'hoy' },
  urgente: true,
  conCostoProbable: false,
  relacionados: [],
  bloquea: ['T04'],
  repuestoFaltante: { repuestoId: 'compresor-2hp' },
};

describe('validarInterpretacion · trabajo nuevo repetido', () => {
  it('si lo que bloquearía ya está bloqueado por un trabajo no resuelto, es duplicado de ese trabajo', () => {
    expect(validarInterpretacion(conT31(), comoClaude, 'jose-alfaro')).toEqual({ tipo: 'plan', plan: { tipo: 'duplicado', trabajoId: 'T31' } });
  });

  it('también sin repuesto: el bloqueante abierto manda', () => {
    const i: Interpretacion = { ...comoClaude, repuestoFaltante: null, responsableSeguro: true };
    expect(validarInterpretacion(conT31(), i, 'jose-alfaro')).toEqual({ tipo: 'plan', plan: { tipo: 'duplicado', trabajoId: 'T31' } });
  });

  it('si el bloqueante ya está resuelto, sí se crea el trabajo nuevo', () => {
    const inst = conT31();
    const resuelto = aplicarEnMemoria(inst, [
      { tipo: 'actualizar_trabajo', trabajoId: 'T31', cambios: { estado: 'resuelto', resueltoEn: inst.ahora }, actorId: 'lucia-mora' },
    ]);
    const r = validarInterpretacion(resuelto, { ...comoClaude, responsableSeguro: true }, 'jose-alfaro');
    expect(r.tipo === 'plan' && r.plan.tipo).toBe('trabajo_nuevo');
  });
});

describe('validarInterpretacion · decisión repetida', () => {
  const C11: InterpretacionDe<'decision'> = {
    tipo: 'decision',
    proyectoId: 'P1',
    resumen: 'Comprar 3 compresores de urgencia.',
    compra: { repuestoId: 'compresor-2hp', cantidad: 3, proveedor: 'local', ajustePrecioPct: null },
    existenciaReal: 0,
    trabajoRelacionadoId: 'T31',
  };
  const pendiente = (estado: Decision['estado']): Decision => ({
    id: 'D01',
    creadaEn: enCR(MIE, '08:10'),
    proyectoId: 'P1',
    numero: 1,
    proponenteId: 'lucia-mora',
    decisorId: 'marcela-solis',
    capturaId: 1,
    repuestoId: 'compresor-2hp',
    cantidad: 3,
    contexto: '',
    afectados: { trabajoIds: [], personaIds: [] },
    opcionPropuesta: 'A',
    estado,
    opcionElegida: null,
    decididaEn: null,
    motivoRechazo: null,
    opciones: [],
  });

  it('con una decisión pendiente del mismo repuesto y proyecto no prepara otra (ni pregunta la cantidad)', () => {
    const inst = { ...conT31(), decisiones: [pendiente('pendiente')] };
    const r = validarInterpretacion(inst, C11, 'lucia-mora');
    expect(r.tipo).toBe('error');
    if (r.tipo === 'error') expect(r.mensaje).toMatch(/^Ya está pendiente la decisión «Compra de 3 compresores de 2 HP» \(COLINA-D1\), .*No creé nada\.$/); // D01
    expect(validarInterpretacion(inst, { ...C11, compra: { ...C11.compra, cantidad: null } }, 'lucia-mora').tipo).toBe('error');
  });

  it('si la anterior ya se decidió o es de otro proyecto, sí se prepara', () => {
    const decidida = { ...conT31(), decisiones: [pendiente('aprobada')] };
    expect(validarInterpretacion(decidida, C11, 'lucia-mora').tipo).toBe('plan');
    const otroProyecto = { ...conT31(), decisiones: [{ ...pendiente('pendiente'), proyectoId: 'P2' }] };
    expect(validarInterpretacion(otroProyecto, C11, 'lucia-mora').tipo).toBe('plan');
  });
});
