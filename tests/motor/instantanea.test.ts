import { describe, expect, it } from 'vitest';
import type { Dependencia, Seguimiento, Trabajo } from '@/dominio/tipos';
import {
  cadenaDependientes,
  dependientesDirectos,
  porId,
  siguienteIdDecision,
  siguienteIdSeguimiento,
  siguienteIdTrabajo,
  type Instantanea,
} from '@/motor/instantanea';

function trabajo(id: string): Trabajo {
  return { id } as Trabajo;
}

function inst(parcial: Partial<Instantanea>): Instantanea {
  return {
    ahora: new Date('2026-11-25T13:00:00Z'),
    personas: [],
    proyectos: [],
    trabajos: [],
    dependencias: [],
    repuestos: [],
    necesidades: [],
    seguimientos: [],
    decisiones: [],
    evidencias: [],
    descartados: [],
    ...parcial,
  };
}

const dep = (trabajoId: string, dependeDeId: string): Dependencia => ({ trabajoId, dependeDeId });

describe('índices de la instantánea', () => {
  // Cadena de P1 y P2: T04→T05→T06→T07; T13 depende de T10, T11, T12.
  const i = inst({
    dependencias: [dep('T05', 'T04'), dep('T06', 'T05'), dep('T07', 'T06'), dep('T13', 'T10'), dep('T13', 'T11'), dep('T13', 'T12')],
  });

  it('porId indexa por id', () => {
    const m = porId([trabajo('T01'), trabajo('T02')]);
    expect(m.get('T02')?.id).toBe('T02');
    expect(m.size).toBe(2);
  });

  it('dependientes directos y cadena en orden BFS sin repetir', () => {
    expect(dependientesDirectos(i, 'T04')).toEqual(['T05']);
    expect(cadenaDependientes(i, 'T04')).toEqual(['T05', 'T06', 'T07']);
    expect(cadenaDependientes(i, 'T10')).toEqual(['T13']);
    expect(cadenaDependientes(i, 'T07')).toEqual([]);
  });

  it('siguientes ids', () => {
    const conTrabajos = inst({ trabajos: ['T01', 'T30', 'T09'].map(trabajo) });
    expect(siguienteIdTrabajo(conTrabajos)).toBe('T31');
    expect(siguienteIdDecision(inst({}))).toBe('D01');
    expect(siguienteIdSeguimiento(inst({ seguimientos: [{ id: 'S9' } as Seguimiento] }))).toBe('S10');
  });
});
