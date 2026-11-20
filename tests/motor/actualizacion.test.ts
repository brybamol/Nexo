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
