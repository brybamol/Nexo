import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import { calcularMarcas } from '@/motor/marcas';
import type { Instantanea } from '@/motor/instantanea';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const ids = (m: Map<string, { atrasado: boolean; enRiesgo: boolean }>, k: 'atrasado' | 'enRiesgo') =>
  [...m].filter(([, v]) => v[k]).map(([id]) => id).sort();

const t = (inst: Instantanea, id: string): Trabajo => inst.trabajos.find((x) => x.id === id)!;

/** Simula la captura C01: T31 (nuevo) bloquea T04 y el compresor queda reportado como faltante. */
function conC01(): Instantanea {
  const inst = instantaneaDesdeSemilla();
  const t04 = t(inst, 'T04');
  inst.trabajos.push({
    ...t04,
    id: 'T31',
    titulo: 'Conseguir compresor de 2 HP',
    plazo: enCR('2026-11-25', '12:00'),
    estado: 'abierto',
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: 'compresor-2hp',
    cantidadRepuesto: 1,
    origen: 'captura',
  });
  t04.estado = 'bloqueado';
  t04.bloqueadoPorId = 'T31';
  t04.motivoBloqueo = 'Sin compresor';
  const r = inst.repuestos.find((x) => x.id === 'compresor-2hp')!;
  r.faltanteReportadoEn = inst.ahora;
  r.faltanteReportadoPor = 'jose-alfaro';
  return inst;
}

const SEIS = ['T05', 'T06', 'T07', 'T10', 'T11', 'T13'];
const INICIALES = ['T16', 'T17', 'T18'];

describe('calcularMarcas', () => {
  it('estado inicial: atrasados T15 y T21; en riesgo T16, T17, T18', () => {
    const m = calcularMarcas(instantaneaDesdeSemilla());
    expect(ids(m, 'atrasado')).toEqual(['T15', 'T21']);
    expect(ids(m, 'enRiesgo')).toEqual(INICIALES);
    expect(m.get('T16')!.causas).toEqual([{ tipo: 'atrasado', trabajoId: 'T15' }]);
    expect(m.get('T17')!.causas).toEqual([{ tipo: 'cadena', trabajoId: 'T16' }]);
    expect(m.get('T18')!.causas).toEqual([{ tipo: 'cadena', trabajoId: 'T17' }]);
  });

  it('devuelve una entrada por trabajo y los resueltos no llevan marcas', () => {
    const inst = instantaneaDesdeSemilla();
    const m = calcularMarcas(inst);
    expect(m.size).toBe(inst.trabajos.length);
    for (const x of inst.trabajos.filter((y) => y.estado === 'resuelto')) {
      expect(m.get(x.id)).toEqual({ atrasado: false, enRiesgo: false, causas: [] });
    }
    // incluso con el reloj muy adelantado
    inst.ahora = enCR('2026-12-31', '12:00');
    for (const x of inst.trabajos.filter((y) => y.estado === 'resuelto')) {
      expect(calcularMarcas(inst).get(x.id)).toEqual({ atrasado: false, enRiesgo: false, causas: [] });
    }
  });

  it('tras C01: en riesgo T05, T06, T07, T10, T11, T13 además de los iniciales, cada uno con su causa', () => {
    const m = calcularMarcas(conC01());
    expect(ids(m, 'enRiesgo')).toEqual([...INICIALES, ...SEIS].sort());
    expect(m.get('T04')!.enRiesgo).toBe(false); // bloqueado no es «en riesgo»
    expect(m.get('T05')!.causas).toEqual([{ tipo: 'bloqueado', trabajoId: 'T04' }]);
    expect(m.get('T06')!.causas).toEqual([{ tipo: 'cadena', trabajoId: 'T05' }]);
    expect(m.get('T07')!.causas).toEqual([{ tipo: 'cadena', trabajoId: 'T06' }]);
    expect(m.get('T10')!.causas).toEqual([{ tipo: 'repuesto', repuestoId: 'compresor-2hp' }]);
    expect(m.get('T11')!.causas).toEqual([{ tipo: 'repuesto', repuestoId: 'compresor-2hp' }]);
    expect(m.get('T13')!.causas).toEqual(
      expect.arrayContaining([
        { tipo: 'cadena', trabajoId: 'T10' },
        { tipo: 'cadena', trabajoId: 'T11' },
      ]),
    );
  });

  it('opción A (llega hoy 15:00): los seis dejan de estar en riesgo aunque T04 siga bloqueado', () => {
    const inst = conC01();
    const llegada = enCR('2026-11-25', '15:00');
    t(inst, 'T04').fechaSolucion = llegada;
    for (const n of inst.necesidades.filter((x) => x.repuestoId === 'compresor-2hp')) n.fechaDisponible = llegada;
    const m = calcularMarcas(inst);
    expect(t(inst, 'T04').estado).toBe('bloqueado');
    expect(ids(m, 'enRiesgo')).toEqual(INICIALES);
  });

  it('opción B (llega 1-dic): siguen en riesgo', () => {
    const inst = conC01();
    const llegada = enCR('2026-12-01', '07:00');
    t(inst, 'T04').fechaSolucion = llegada;
    for (const n of inst.necesidades.filter((x) => x.repuestoId === 'compresor-2hp')) n.fechaDisponible = llegada;
    const m = calcularMarcas(inst);
    expect(ids(m, 'enRiesgo')).toEqual([...INICIALES, ...SEIS].sort());
  });

  it('un plazo vence en su minuto exacto (T28 a las 12:00)', () => {
    const inst = instantaneaDesdeSemilla();
    inst.ahora = enCR('2026-11-25', '11:59');
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(false);
    inst.ahora = enCR('2026-11-25', '12:00');
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(true);
    t(inst, 'T28').estado = 'resuelto';
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(false);
  });

  it('dependencias circulares o con ids inexistentes no cuelgan la función', () => {
    const inst = instantaneaDesdeSemilla();
    inst.dependencias.push(
      { trabajoId: 'T14', dependeDeId: 'T18' }, // cierra un ciclo T15..T18 -> T14 (T14 resuelto)
      { trabajoId: 'T16', dependeDeId: 'T18' },
      { trabajoId: 'T17', dependeDeId: 'T17' },
      { trabajoId: 'T99', dependeDeId: 'T15' },
      { trabajoId: 'T16', dependeDeId: 'T98' },
    );
    const m = calcularMarcas(inst);
    expect(m.size).toBe(inst.trabajos.length);
    expect(ids(m, 'enRiesgo')).toEqual(INICIALES);
  });
});
