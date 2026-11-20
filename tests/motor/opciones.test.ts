// Opciones A/B/C, decisor y desplazamiento de plazos (§4.2 regla 8 y §8.1 de docs/05). Puras. Tarea 3.3.
// Las cifras se comprueban contra la tabla de repuestos de la semilla: el código no las escribe a mano.
import { describe, expect, it } from 'vitest';
import { enCR } from '@/dominio/tiempo';
import type { CambioFecha, OpcionCalculada } from '@/dominio/tipos';
import { aplicarEnMemoria } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { calcularOpciones, decisorPara } from '@/motor/opciones';
import { desplazarCadena } from '@/motor/plazos';
import { instantaneaDesdeSemilla } from '../ayudantes/preparar';

/** Estado tras C01 a las 8:10: T04 bloqueado por T31 (conseguir el compresor) y faltante reportado. */
function trasC01(): Instantanea {
  const base = instantaneaDesdeSemilla();
  const ahora = enCR('2026-11-25', '08:10');
  const t31 = {
    ...base.trabajos.find((t) => t.id === 'T04')!,
    id: 'T31',
    titulo: 'Conseguir compresor de 2 HP',
    responsableId: 'lucia-mora',
    solicitadoPorId: 'jose-alfaro',
    plazo: enCR('2026-11-25', '12:00'),
    estado: 'abierto' as const,
    urgente: true,
    repuestoId: 'compresor-2hp',
    cantidadRepuesto: 1,
    origen: 'captura' as const,
  };
  return aplicarEnMemoria({ ...base, ahora }, [
    { tipo: 'crear_trabajo', trabajo: t31, necesidades: [], actorId: 'jose-alfaro' },
    { tipo: 'actualizar_trabajo', trabajoId: 'T04', cambios: { estado: 'bloqueado', bloqueadoPorId: 'T31' }, actorId: 'jose-alfaro' },
    {
      tipo: 'actualizar_repuesto',
      repuestoId: 'compresor-2hp',
      cambios: { faltanteReportadoEn: ahora, faltanteReportadoPor: 'jose-alfaro' },
      actorId: 'jose-alfaro',
    },
  ]);
}

const compresor = { repuestoId: 'compresor-2hp', cantidad: 3, proveedor: 'local' as const, ajustePrecioPct: null, existenciaReal: 0 };
const cambios = (o: OpcionCalculada | undefined) =>
  Object.fromEntries((o?.cambiosFecha ?? []).map((c: CambioFecha) => [c.trabajoId, c.a.toISOString()]));
const iso = (fecha: string, hora: string) => enCR(fecha, hora).toISOString();

describe('calcularOpciones · compresores (C11 / E4)', () => {
  const inst = trasC01();
  const r = inst.repuestos.find((x) => x.id === 'compresor-2hp')!;
  const opciones = calcularOpciones(inst, compresor);
  const [a, b, c] = opciones;

  it('A, B y C con el costo que sale de la tabla de repuestos', () => {
    expect(opciones.map((o) => o.letra)).toEqual(['A', 'B', 'C']);
    expect(a?.costo).toBe(3 * r.precioLocal);
    expect(b?.costo).toBe(3 * r.precioHabitual);
    expect(c?.costo).toBe(r.precioLocal + 2 * r.precioHabitual);
    expect([a?.costo, b?.costo, c?.costo]).toEqual([1_380_000, 1_140_000, 1_220_000]);
  });

  it('necesidades ordenadas por plazo (T04 primero); llegadas local hoy 15:00 y habitual +6 días naturales 07:00', () => {
    expect(a?.lineas).toEqual([
      { proveedor: 'local', cantidad: 3, precioUnitario: 460_000, llegada: enCR('2026-11-25', '15:00'), trabajoIds: ['T04', 'T10', 'T11'] },
    ]);
    expect(b?.lineas[0]).toMatchObject({ proveedor: 'habitual', cantidad: 3, llegada: enCR('2026-12-01', '07:00') });
    expect(c?.lineas).toEqual([
      { proveedor: 'local', cantidad: 1, precioUnitario: 460_000, llegada: enCR('2026-11-25', '15:00'), trabajoIds: ['T04'] },
      { proveedor: 'habitual', cantidad: 2, precioUnitario: 380_000, llegada: enCR('2026-12-01', '07:00'), trabajoIds: ['T10', 'T11'] },
    ]);
  });

  it('A no cambia fechas', () => {
    expect(a?.cambiosFecha).toEqual([]);
    expect(a?.consecuencia).toContain('a tiempo');
  });

  it('B: fechas de la contradicción resuelta 1', () => {
    expect(cambios(b)).toEqual({
      T04: iso('2026-12-01', '17:00'),
      T05: iso('2026-12-02', '17:00'),
      T06: iso('2026-12-03', '17:00'),
      T07: iso('2026-12-03', '17:00'),
      T10: iso('2026-12-01', '17:00'),
      T11: iso('2026-12-01', '17:00'),
      T13: iso('2026-12-03', '17:00'),
    });
    expect(b?.cambiosFecha.find((x) => x.trabajoId === 'T04')?.de).toEqual(enCR('2026-11-25', '17:00'));
    expect(b?.consecuencia).toContain('Cámara fría La Colina');
    expect(b?.consecuencia).toContain('jue 3 dic');
  });

  it('C: La Colina a tiempo; Cartago y Curridabat al 1-dic, informe T13 al 3-dic', () => {
    expect(cambios(c)).toEqual({
      T10: iso('2026-12-01', '17:00'),
      T11: iso('2026-12-01', '17:00'),
      T13: iso('2026-12-03', '17:00'),
    });
  });

  it('decisor: gerente general si alguna opción supera ₡100.000', () => {
    expect(decisorPara(inst, opciones)).toBe('marcela-solis');
  });

  it('con la cantidad o la existencia corregida, C desaparece si solo queda un trabajo sin cubrir', () => {
    const dos = calcularOpciones(inst, { ...compresor, existenciaReal: 2 });
    expect(dos.map((o) => o.letra)).toEqual(['A', 'B']);
    expect(dos[0]?.lineas[0]?.trabajoIds).toEqual(['T11']);
  });
});

describe('calcularOpciones · empaques (C06 con respuesta 20)', () => {
  const inst = instantaneaDesdeSemilla();
  const opciones = calcularOpciones(inst, {
    repuestoId: 'empaque-puerta',
    cantidad: 20,
    proveedor: null,
    ajustePrecioPct: 12,
    existenciaReal: null,
  });

  it('A local ₡84.000 hoy 15:00; B habitual con el ajuste (₡3.920) ₡78.400 sáb 28 07:00; sin C ni cambios', () => {
    expect(opciones).toHaveLength(2);
    expect(opciones[0]).toMatchObject({ letra: 'A', costo: 84_000, cambiosFecha: [] });
    expect(opciones[0]?.lineas[0]).toMatchObject({ proveedor: 'local', cantidad: 20, precioUnitario: 4_200, llegada: enCR('2026-11-25', '15:00') });
    expect(opciones[1]).toMatchObject({ letra: 'B', costo: 78_400, cambiosFecha: [] });
    expect(opciones[1]?.lineas[0]).toMatchObject({ precioUnitario: 3_920, llegada: enCR('2026-11-28', '07:00') });
    expect(decisorPara(inst, opciones)).toBe('andres-vargas');
  });

  it('después de las 15:00 el proveedor local entrega el siguiente día hábil', () => {
    const tarde = calcularOpciones({ ...inst, ahora: enCR('2026-11-27', '15:00') }, {
      repuestoId: 'empaque-puerta',
      cantidad: 20,
      proveedor: null,
      ajustePrecioPct: null,
      existenciaReal: null,
    });
    expect(tarde[0]?.lineas[0]?.llegada).toEqual(enCR('2026-11-30', '15:00'));
    expect(tarde[1]?.lineas[0]?.precioUnitario).toBe(3_500);
  });

  it('repuesto inexistente o cantidad no positiva → sin opciones', () => {
    expect(calcularOpciones(inst, { repuestoId: 'nada', cantidad: 1, proveedor: null, ajustePrecioPct: null, existenciaReal: null })).toEqual([]);
    expect(calcularOpciones(inst, { repuestoId: 'termostato', cantidad: 0, proveedor: null, ajustePrecioPct: null, existenciaReal: null })).toEqual([]);
  });
});

describe('desplazarCadena', () => {
  it('cada dependiente se mueve los mismos días hábiles que su predecesor más desplazado; incluye los nuevos', () => {
    const inst = instantaneaDesdeSemilla();
    const res = desplazarCadena(inst, new Map([['T04', enCR('2026-11-26', '17:00')]]));
    expect(Object.fromEntries(res.map((c) => [c.trabajoId, c.a.toISOString()]))).toEqual({
      T04: iso('2026-11-26', '17:00'),
      T05: iso('2026-11-27', '17:00'),
      T06: iso('2026-11-30', '17:00'),
      T07: iso('2026-11-30', '17:00'),
    });
  });

  it('sin desplazamiento no hay cambios', () => {
    const inst = instantaneaDesdeSemilla();
    expect(desplazarCadena(inst, new Map([['T04', enCR('2026-11-25', '17:00')]]))).toEqual([]);
  });
});
