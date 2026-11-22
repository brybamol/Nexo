// Secuencia de un proyecto y orden de proyectos por proximidad. Puro: sin base, sin hora real.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';
import {
  calcularSecuencia,
  etiquetaDia,
  ordenarPorProximidad,
  proximidad,
  type ProyectoOrdenable,
  type Secuencia,
} from '@/motor/secuencia';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

const ids = (s: Secuencia) => s.etapas.map((e) => e.trabajoIds);
const estados = (s: Secuencia) => s.etapas.map((e) => e.estado);

function nuevo(inst: Instantanea, id: string, extra: Partial<Trabajo>): Trabajo {
  const base = inst.trabajos.find((t) => t.id === 'T05');
  if (!base) throw new Error('falta T05 en la semilla');
  const t: Trabajo = { ...structuredClone(base), id, numero: 99, titulo: `Trabajo ${id}`, estado: 'abierto', ...extra };
  inst.trabajos.push(t);
  return t;
}

describe('calcularSecuencia: etapas por dependencias', () => {
  it('La Colina es una cadena: una etapa por trabajo, la actual es la instalación', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'P1');
    expect(s.modo).toBe('etapas');
    expect(ids(s)).toEqual([['T01'], ['T02'], ['T03'], ['T04'], ['T05'], ['T06'], ['T07']]);
    expect(estados(s)).toEqual(['hecha', 'hecha', 'hecha', 'actual', 'pendiente', 'pendiente', 'pendiente']);
    expect(s.etapaActual).toBe(3);
    expect(s.completo).toBe(false);
    expect(s.antes.T05).toEqual(['T04']);
    expect(s.antes.T01).toEqual([]);
  });

  it('Trigal abre en paralelo tras agendar (por plazo) y converge en el informe', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'P2');
    expect(ids(s)).toEqual([['T08'], ['T09', 'T10', 'T11', 'T12'], ['T13']]);
    expect(estados(s)).toEqual(['hecha', 'actual', 'pendiente']);
    expect(s.antes.T13).toEqual(['T10', 'T11', 'T12']);
  });

  it('Repuestos críticos: cadena con la conciliación como etapa actual', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'P3');
    expect(ids(s)).toEqual([['T14'], ['T15'], ['T16'], ['T17'], ['T18']]);
    expect(s.etapaActual).toBe(1);
  });

  it('un bloqueo por un trabajo del mismo proyecto lo coloca justo antes del bloqueado', () => {
    const inst = instantaneaDesdeSemilla();
    nuevo(inst, 'T31', { proyectoId: 'P1', titulo: 'Conseguir compresor de 2 HP', plazo: enCR('2026-11-25', '15:00') });
    const t04 = inst.trabajos.find((t) => t.id === 'T04');
    if (!t04) throw new Error('falta T04');
    t04.estado = 'bloqueado';
    t04.bloqueadoPorId = 'T31';
    const s = calcularSecuencia(inst, 'P1');
    expect(ids(s)).toEqual([['T01'], ['T02'], ['T03', 'T31'], ['T04'], ['T05'], ['T06'], ['T07']]);
    expect(s.etapaActual).toBe(2);
    expect(estados(s).slice(0, 4)).toEqual(['hecha', 'hecha', 'actual', 'pendiente']);
    expect(s.antes.T04).toEqual(['T03', 'T31']);
    expect(s.fuera.T04).toEqual([]);
  });

  it('las esperas hacia otro proyecto no cambian las etapas: se informan aparte', () => {
    const inst = instantaneaDesdeSemilla();
    const t04 = inst.trabajos.find((t) => t.id === 'T04');
    if (!t04) throw new Error('falta T04');
    t04.estado = 'bloqueado';
    t04.bloqueadoPorId = 'T10';
    inst.dependencias.push({ trabajoId: 'T05', dependeDeId: 'T11' });
    const s = calcularSecuencia(inst, 'P1');
    expect(ids(s)).toEqual([['T01'], ['T02'], ['T03'], ['T04'], ['T05'], ['T06'], ['T07']]);
    expect(s.fuera.T04).toEqual(['T10']);
    expect(s.fuera.T05).toEqual(['T11']);
  });

  it('ignora dependencias hacia trabajos que no existen', () => {
    const inst = instantaneaDesdeSemilla();
    inst.dependencias.push({ trabajoId: 'T05', dependeDeId: 'T99' });
    const s = calcularSecuencia(inst, 'P1');
    expect(ids(s)[4]).toEqual(['T05']);
    expect(s.antes.T05).toEqual(['T04']);
    expect(s.fuera.T05).toEqual([]);
  });

  it('tolera ciclos: cada trabajo aparece una vez y los del ciclo van en una etapa final marcada', () => {
    const inst = instantaneaDesdeSemilla();
    inst.dependencias.push({ trabajoId: 'T06', dependeDeId: 'T07' });
    const s = calcularSecuencia(inst, 'P1');
    expect(s.etapas.flatMap((e) => e.trabajoIds).sort()).toEqual(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07']);
    const ultima = s.etapas[s.etapas.length - 1];
    expect(ultima?.ciclo).toBe(true);
    expect(ultima?.trabajoIds).toEqual(['T06', 'T07']);
    expect(s.etapas.slice(0, -1).every((e) => !e.ciclo)).toBe(true);
  });

  it('un trabajo suelto (sin relaciones) se coloca por su plazo, en la última etapa que ya empezó a esa fecha', () => {
    const inst = instantaneaDesdeSemilla();
    nuevo(inst, 'T31', { proyectoId: 'P1', plazo: enCR('2026-11-26', '17:00') });
    const s = calcularSecuencia(inst, 'P1');
    expect(ids(s)[4]).toEqual(['T05', 'T31']);
  });

  it('es estable: el orden de entrada no cambia el resultado', () => {
    const a = instantaneaDesdeSemilla();
    const b = instantaneaDesdeSemilla();
    b.trabajos.reverse();
    b.dependencias.reverse();
    for (const p of ['P1', 'P2', 'P3', 'P4']) expect(calcularSecuencia(b, p)).toEqual(calcularSecuencia(a, p));
  });

  it('todo resuelto: completo, sin etapa actual y todas hechas', () => {
    const inst = instantaneaDesdeSemilla();
    for (const t of inst.trabajos) if (t.proyectoId === 'P1') t.estado = 'resuelto';
    const s = calcularSecuencia(inst, 'P1');
    expect(s.completo).toBe(true);
    expect(s.etapaActual).toBeNull();
    expect(estados(s).every((e) => e === 'hecha')).toBe(true);
  });

  it('un proyecto vacío no tiene etapas', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'OD');
    expect(s).toMatchObject({ etapas: [], etapaActual: null, completo: false, total: 0, hechos: 0 });
  });

  it('cuenta hechos y total', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'P1');
    expect([s.hechos, s.total]).toEqual([3, 7]);
  });
});

describe('calcularSecuencia: por día cuando casi no hay dependencias', () => {
  it('Pedidos de la semana se agrupa por día, en orden, con la etapa de hoy como actual', () => {
    const s = calcularSecuencia(instantaneaDesdeSemilla(), 'P4');
    expect(s.modo).toBe('dias');
    expect(s.etapas.map((e) => e.dia)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(ids(s)).toEqual([
      ['T19'],
      ['T20', 'T21'],
      ['T22', 'T28', 'T23', 'T29'],
      ['T24', 'T25', 'T27'],
      ['T26', 'T30'],
    ]);
    // el martes quedó un trabajo sin hacer: no es «hecho» ni «actual»
    expect(estados(s)).toEqual(['hecha', 'rezagada', 'actual', 'pendiente', 'pendiente']);
    expect(s.etapaActual).toBe(2);
    expect(s.antes.T21).toEqual(['T22']);
    expect(s.antes.T26).toEqual(['T27']);
  });

  it('si hoy no hay nada, la actual es el primer día pendiente desde hoy', () => {
    const inst = instantaneaDesdeSemilla();
    for (const t of inst.trabajos) if (t.proyectoId === 'P4' && t.id !== 'T21') {
      if (t.plazo.getTime() < enCR('2026-11-26', '00:00').getTime()) t.estado = 'resuelto';
    }
    const s = calcularSecuencia(inst, 'P4');
    expect(estados(s)).toEqual(['hecha', 'rezagada', 'hecha', 'actual', 'pendiente']);
    expect(s.etapaActual).toBe(3);
  });

  it('si todo lo pendiente ya venció, la actual es el último día con algo pendiente', () => {
    const inst = instantaneaDesdeSemilla();
    inst.ahora = enCR('2026-12-02', '09:00');
    const s = calcularSecuencia(inst, 'P4');
    expect(s.etapaActual).toBe(4);
    expect(estados(s)).toEqual(['hecha', 'rezagada', 'rezagada', 'rezagada', 'actual']);
  });
});

describe('proximidad', () => {
  const ahora = enCR('2026-11-25', '07:00');
  it('lo dice en lenguaje natural, por días de calendario en Costa Rica', () => {
    expect(proximidad(enCR('2026-11-25', '17:00'), ahora).texto).toBe('vence hoy');
    expect(proximidad(enCR('2026-11-25', '06:00'), ahora).texto).toBe('venció hoy');
    expect(proximidad(enCR('2026-11-26', '08:00'), ahora).texto).toBe('vence mañana');
    expect(proximidad(enCR('2026-11-27', '17:00'), ahora).texto).toBe('vence en 2 días');
    expect(proximidad(enCR('2026-11-24', '17:00'), ahora).texto).toBe('venció ayer');
    expect(proximidad(enCR('2026-11-20', '17:00'), ahora).texto).toBe('venció hace 5 días');
    expect(proximidad(null, ahora)).toEqual({ dias: null, vencido: false, texto: 'sin fecha' });
  });

  it('cruza la medianoche de Costa Rica, no la de UTC', () => {
    const tarde = enCR('2026-11-25', '23:30');
    expect(proximidad(enCR('2026-11-26', '00:30'), tarde)).toMatchObject({ dias: 1, texto: 'vence mañana' });
  });

  it('marca vencido cuando la fecha ya pasó', () => {
    expect(proximidad(enCR('2026-11-25', '06:59'), ahora).vencido).toBe(true);
    expect(proximidad(enCR('2026-11-25', '07:01'), ahora).vencido).toBe(false);
  });
});

describe('etiquetaDia', () => {
  const ahora = enCR('2026-11-25', '07:00');
  it('nombra hoy, ayer y mañana, y el resto por su fecha', () => {
    expect(etiquetaDia('2026-11-25', ahora)).toBe('Hoy, mié 25 nov');
    expect(etiquetaDia('2026-11-24', ahora)).toBe('Ayer, mar 24 nov');
    expect(etiquetaDia('2026-11-26', ahora)).toBe('Mañana, jue 26 nov');
    expect(etiquetaDia('2026-11-23', ahora)).toBe('lun 23 nov');
  });
});

describe('ordenarPorProximidad', () => {
  const p = (id: string, fecha: string | null, extra: Partial<ProyectoOrdenable> = {}): ProyectoOrdenable => ({
    id,
    fecha: fecha ? enCR(fecha, '17:00') : null,
    total: 5,
    resueltos: 1,
    frenados: 0,
    ...extra,
  });

  it('primero lo que vence antes (lo vencido delante), luego sin fecha y al final lo terminado', () => {
    const orden = ordenarPorProximidad([
      p('terminado', '2026-11-24', { resueltos: 5 }),
      p('lunes', '2026-11-30'),
      p('sin-fecha', null),
      p('viernes', '2026-11-27'),
      p('vencido', '2026-11-24'),
      p('vacio', null, { total: 0, resueltos: 0 }),
    ]);
    expect(orden.map((x) => x.id)).toEqual(['vencido', 'viernes', 'lunes', 'sin-fecha', 'vacio', 'terminado']);
  });

  it('a igual fecha va primero el que tiene más trabajos frenados; luego el orden original', () => {
    const orden = ordenarPorProximidad([
      p('a', '2026-11-27'),
      p('b', '2026-11-27', { frenados: 1 }),
      p('c', '2026-11-27'),
      p('d', '2026-11-27', { frenados: 3 }),
    ]);
    expect(orden.map((x) => x.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('un proyecto vacío con fecha no está terminado', () => {
    const orden = ordenarPorProximidad([p('lleno', '2026-11-30'), p('vacio', '2026-11-27', { total: 0, resueltos: 0 })]);
    expect(orden.map((x) => x.id)).toEqual(['vacio', 'lleno']);
  });

  it('no muta la lista de entrada', () => {
    const entrada = [p('b', '2026-11-30'), p('a', '2026-11-27')];
    ordenarPorProximidad(entrada);
    expect(entrada.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
