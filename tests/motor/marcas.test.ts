import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import { calcularMarcas } from '@/motor/marcas';
import { avisosPorRiesgoNuevo, efectosBloqueo } from '@/motor/propagacion';
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

// ─── Reformas v2 (docs/08 reglas 15 y 21; tarea R3) ─────────────────────────────

/** Copia de T28 (P4) como trabajo del correo: propuesto de `dueno` o confirmado si `dueno` es null. */
function delCorreo(inst: Instantanea, id: string, dueno: string | null, extra: Partial<Trabajo> = {}): Trabajo {
  const nuevo: Trabajo = {
    ...t(inst, 'T28'),
    id,
    numero: 13,
    origen: 'correo',
    confirmacion: dueno ? 'propuesto' : 'confirmado',
    duenoPropuestaId: dueno,
    ...extra,
  };
  inst.trabajos.push(nuevo);
  return nuevo;
}

describe('calcularMarcas · propuestos (regla 15)', () => {
  it('un propuesto atrasado no pone en riesgo a un confirmado que depende de él; él sí lleva su marca', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M01', 'ricardo-brenes', { plazo: enCR('2026-11-24', '17:00') });
    inst.dependencias.push({ trabajoId: 'T29', dependeDeId: 'M01' });
    const m = calcularMarcas(inst);
    expect(m.get('M01')!.atrasado).toBe(true);
    expect(m.get('T29')).toEqual({ atrasado: false, enRiesgo: false, causas: [] });
    expect(ids(m, 'enRiesgo')).toEqual(INICIALES);
  });

  it('un propuesto bloqueado tampoco es fuente para confirmados', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M01', 'ricardo-brenes', { estado: 'bloqueado', bloqueadoPorId: 'T28', motivoBloqueo: 'x' });
    inst.dependencias.push({ trabajoId: 'T29', dependeDeId: 'M01' });
    expect(calcularMarcas(inst).get('T29')!.enRiesgo).toBe(false);
  });

  it('el propuesto sí recibe marcas de sus predecesores, y las pasa a otro propuesto', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M01', 'lucia-mora');
    delCorreo(inst, 'M02', 'lucia-mora');
    inst.dependencias.push({ trabajoId: 'M01', dependeDeId: 'T15' }, { trabajoId: 'M02', dependeDeId: 'M01' });
    const m = calcularMarcas(inst);
    expect(m.get('M01')).toEqual({ atrasado: false, enRiesgo: true, causas: [{ tipo: 'atrasado', trabajoId: 'T15' }] });
    expect(m.get('M02')).toEqual({ atrasado: false, enRiesgo: true, causas: [{ tipo: 'cadena', trabajoId: 'M01' }] });
  });

  it('V6: M03 (confirmado por dos fuentes) depende de T28; a las 12:00 T28 atrasado y M03 en riesgo por él', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M03', null, { numero: 14, responsableId: 'ricardo-brenes', plazo: enCR('2026-11-27', '17:00') });
    inst.dependencias.push({ trabajoId: 'M03', dependeDeId: 'T28' });
    inst.ahora = enCR('2026-11-25', '12:00');
    const m = calcularMarcas(inst);
    expect(m.get('T28')!.atrasado).toBe(true);
    expect(m.get('M03')).toEqual({ atrasado: false, enRiesgo: true, causas: [{ tipo: 'atrasado', trabajoId: 'T28' }] });
  });
});

describe('calcularMarcas · entregados (regla 21)', () => {
  const entrega = (en: Date) => ({ en, porId: 'paola-herrera', nota: 'Enviada', enlace: null, fuente: 'interfaz' as const });

  it('entregar a tiempo quita el atraso; entregar tarde no; sin entrega, atrasado', () => {
    const inst = instantaneaDesdeSemilla();
    inst.ahora = enCR('2026-11-25', '15:00');
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(true);
    t(inst, 'T28').entrega = entrega(enCR('2026-11-25', '11:30'));
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(false);
    t(inst, 'T28').entrega = entrega(enCR('2026-11-25', '12:00')); // en el minuto exacto del plazo: a tiempo
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(false);
    t(inst, 'T28').entrega = entrega(enCR('2026-11-25', '12:10'));
    expect(calcularMarcas(inst).get('T28')!.atrasado).toBe(true);
  });

  it('un entregado no es fuente de riesgo para sus dependientes, aunque esté atrasado', () => {
    const inst = instantaneaDesdeSemilla();
    inst.ahora = enCR('2026-11-27', '09:00'); // T27 venció el jue 17:00; T26 depende de T27
    expect(calcularMarcas(inst).get('T26')!.causas).toContainEqual({ tipo: 'atrasado', trabajoId: 'T27' });
    t(inst, 'T27').entrega = entrega(enCR('2026-11-27', '08:00'));
    const m = calcularMarcas(inst);
    expect(m.get('T27')!.atrasado).toBe(true); // entregó tarde
    expect(m.get('T26')!.enRiesgo).toBe(false);
  });

  it('el estado inicial (todo confirmado, sin entregas) no cambia', () => {
    const m = calcularMarcas(instantaneaDesdeSemilla());
    expect(ids(m, 'atrasado')).toEqual(['T15', 'T21']);
    expect(ids(m, 'enRiesgo')).toEqual(INICIALES);
  });
});

describe('propagación · sin avisos a propuestos (regla 15)', () => {
  it('avisosPorRiesgoNuevo solo avisa de los confirmados que pasan a en riesgo', () => {
    const antes = instantaneaDesdeSemilla();
    delCorreo(antes, 'M03', null, { numero: 14, responsableId: 'ricardo-brenes', plazo: enCR('2026-11-27', '17:00') });
    delCorreo(antes, 'M04', 'karla-jimenez', { numero: 15, responsableId: 'karla-jimenez', plazo: enCR('2026-11-27', '17:00') });
    antes.dependencias.push({ trabajoId: 'M03', dependeDeId: 'T28' }, { trabajoId: 'M04', dependeDeId: 'T28' });
    antes.ahora = enCR('2026-11-25', '11:59');
    const despues = { ...antes, ahora: enCR('2026-11-25', '12:00') };
    const avisos = avisosPorRiesgoNuevo(antes, despues, 'Venció el plazo').flatMap((e) => (e.tipo === 'accion' ? [[e.accion.destinatarioId, e.accion.trabajoIds]] : []));
    expect(avisos).toEqual([['ricardo-brenes', ['M03']]]);
  });

  it('bloquear un propuesto cambia su estado pero no avisa a nadie', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M01', 'ricardo-brenes', { responsableId: 'diego-rojas' });
    delCorreo(inst, 'M02', 'ricardo-brenes', { numero: 14, responsableId: 'karla-jimenez' });
    inst.dependencias.push({ trabajoId: 'M02', dependeDeId: 'M01' });
    const efectos = efectosBloqueo(inst, {
      trabajoBloqueadoId: 'M01',
      bloqueanteId: 'T28',
      motivo: 'Falta la cotización',
      repuestoFaltanteId: null,
      autorId: 'ricardo-brenes',
      descripcion: 'Espera del correo',
    });
    expect(efectos.map((e) => e.tipo)).toEqual(['actualizar_trabajo']);
  });

  it('bloquear un confirmado avisa a los confirmados que quedan en riesgo, no a los propuestos', () => {
    const inst = instantaneaDesdeSemilla();
    delCorreo(inst, 'M01', 'ricardo-brenes', { responsableId: 'diego-rojas' });
    inst.dependencias.push({ trabajoId: 'M01', dependeDeId: 'T27' });
    const efectos = efectosBloqueo(inst, {
      trabajoBloqueadoId: 'T27',
      bloqueanteId: 'T28',
      motivo: 'Falta la cotización',
      repuestoFaltanteId: null,
      autorId: 'andres-vargas',
      descripcion: 'Bloqueo de prueba',
    });
    const avisos = efectos.flatMap((e) => (e.tipo === 'accion' ? [[e.accion.destinatarioId, e.accion.trabajoIds]] : []));
    expect(avisos).toEqual([['diego-rojas', ['T26']]]); // T26 (confirmado) sí; M01 (propuesto, también de Diego) no
  });
});
