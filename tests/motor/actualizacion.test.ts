// Liberación al resolver cualquier bloqueante (§4.2 regla 5 de docs/05). Pura. Corrección asignada a la tarea 3.3.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { PlanActualizacion, Trabajo } from '@/dominio/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

/** Como tras C15: T31 (vitrina dañada, sin repuesto) de Lucía bloquea T24 de Diego. */
function trasC15(): Instantanea {
  const base = instantaneaDesdeSemilla();
  const t24 = base.trabajos.find((t) => t.id === 'T24') as Trabajo;
  const t31: Trabajo = {
    ...t24,
    id: 'T31',
    numero: 13, // siguiente número de P4: PEDIDOS-13
    titulo: 'Resolver la vitrina dañada del pedido 1045',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'diego-rojas',
    plazo: enCR('2026-11-25', '12:00'),
    urgente: true,
    conCostoProbable: true,
    origen: 'captura',
  };
  return aplicarEnMemoria({ ...base, ahora: enCR('2026-11-25', '09:00') }, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: 'diego-rojas' },
    {
      tipo: 'actualizar_trabajo',
      trabajoId: 'T24',
      cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Vitrina dañada' },
      actorId: 'diego-rojas',
    },
  ]);
}

const resolver = (trabajoId: string): PlanActualizacion => ({
  tipo: 'actualizacion',
  trabajoId,
  nuevoEstado: 'resuelto',
  nota: null,
  hayProblema: false,
  reprogramar: [],
  notasRelacionadas: [],
});

const avisosDe = (efectos: Efecto[]) =>
  efectos.flatMap((e) => (e.tipo === 'accion' && e.aviso ? [{ personaId: e.aviso.personaId, trabajoIds: e.aviso.trabajoIds }] : []));

describe('efectosActualizacion · liberación', () => {
  it('resolver un bloqueante sin repuesto libera lo que bloqueaba y avisa a su responsable', () => {
    const inst = trasC15();
    const efectos = efectosActualizacion(inst, resolver('T31'), 'lucia-mora');
    const t24 = aplicarEnMemoria(inst, efectos).trabajos.find((t) => t.id === 'T24');
    expect(t24).toMatchObject({ estado: 'en_curso', bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null });
    expect(efectos.some((e) => e.tipo === 'actualizar_necesidad')).toBe(false);
    expect(avisosDe(efectos)).toEqual([{ personaId: 'diego-rojas', trabajoIds: ['T24'] }]);
  });

  it('responder «en curso» sobre un trabajo bloqueado por otro aún abierto no lo desbloquea: cierra el seguimiento y guarda la nota', () => {
    const base = trasC15();
    const inst: Instantanea = {
      ...base,
      seguimientos: [
        {
          id: 'S1',
          trabajoId: 'T24',
          plazoReferencia: base.ahora,
          nivel: 0,
          destinatarioId: 'diego-rojas',
          urgente: false,
          proximoEn: enCR('2026-11-25', '13:00'),
          estado: 'pendiente',
          iniciadoEn: base.ahora,
          escaladosA: [],
          tipo: 'estado',
        },
      ],
    };
    const efectos = efectosActualizacion(inst, { ...resolver('T24'), nuevoEstado: 'en_curso', nota: 'Sigo con lo demás.' }, 'diego-rojas');
    const despues = aplicarEnMemoria(inst, efectos);
    expect(despues.trabajos.find((t) => t.id === 'T24')).toMatchObject({ estado: 'bloqueado', bloqueadoPorId: 'T31', motivoBloqueo: 'Vitrina dañada' });
    expect(efectos.some((e) => e.tipo === 'actualizar_trabajo')).toBe(false);
    expect(despues.seguimientos[0]?.estado).toBe('respondido');
    expect(efectos).toContainEqual({ tipo: 'agregar_nota', trabajoId: 'T24', autorId: 'diego-rojas', texto: 'Sigo con lo demás.' });
    expect(avisosDe(efectos)).toEqual([]);
    const registro = efectos.find((e) => e.tipo === 'accion' && e.accion.tipo === 'actualizar_trabajo');
    expect(registro?.tipo === 'accion' && registro.accion.motivo).toContain(
      '«Entregar pedido 1045 · vitrina · Trigal Heredia» (PEDIDOS-6) sigue bloqueado por «Resolver la vitrina dañada del pedido 1045» (PEDIDOS-13)', // T24 por T31
    );
  });

  it('resolver el trabajo bloqueado sí se permite aunque el bloqueante siga abierto', () => {
    const inst = trasC15();
    const efectos = efectosActualizacion(inst, resolver('T24'), 'diego-rojas');
    expect(aplicarEnMemoria(inst, efectos).trabajos.find((t) => t.id === 'T24')).toMatchObject({ estado: 'resuelto', bloqueadoPorId: null });
  });

  it('al liberado que es el autor no se le avisa', () => {
    const inst = trasC15();
    const efectos = efectosActualizacion(
      { ...inst, trabajos: inst.trabajos.map((t) => (t.id === 'T31' ? { ...t, responsableId: 'diego-rojas' } : t)) },
      resolver('T31'),
      'diego-rojas',
    );
    expect(avisosDe(efectos)).toEqual([]);
  });
});
