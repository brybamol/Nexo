import { describe, expect, it } from 'vitest';
import {
  diasHabilesEntre,
  enCR,
  esDiaHabil,
  partesCR,
  resolverPlazo,
  siguienteDiaHabil,
  sumarDiasHabiles,
  sumarHorasLaborales,
  sumarMinutos,
} from '@/dominio/tiempo';

const iso = (d: Date) => d.toISOString();

describe('enCR / partesCR', () => {
  it('convierte hora de Costa Rica a instante UTC', () => {
    expect(iso(enCR('2026-11-25', '12:00'))).toBe('2026-11-25T18:00:00.000Z');
    expect(iso(enCR('2026-11-25', '07:00'))).toBe('2026-11-25T13:00:00.000Z');
  });
  it('partesCR devuelve fecha, hora y día de la semana locales', () => {
    expect(partesCR(enCR('2026-11-25', '15:30'))).toEqual({ fecha: '2026-11-25', hora: '15:30', diaSemana: 3 });
  });
  it('cruza la medianoche local, no la UTC', () => {
    const d = new Date('2026-11-26T03:00:00Z'); // 21:00 del 25 en CR
    expect(partesCR(d)).toEqual({ fecha: '2026-11-25', hora: '21:00', diaSemana: 3 });
    const e = new Date('2026-11-25T05:59:00Z'); // 23:59 del 24 en CR
    expect(partesCR(e).fecha).toBe('2026-11-24');
  });
  it('domingo = 0, sábado = 6', () => {
    expect(partesCR(enCR('2026-11-29', '10:00')).diaSemana).toBe(0);
    expect(partesCR(enCR('2026-11-28', '10:00')).diaSemana).toBe(6);
  });
});

describe('esDiaHabil', () => {
  it('lunes a viernes sí, fin de semana no', () => {
    expect(esDiaHabil(enCR('2026-11-23', '09:00'))).toBe(true);
    expect(esDiaHabil(enCR('2026-11-27', '09:00'))).toBe(true);
    expect(esDiaHabil(enCR('2026-11-28', '09:00'))).toBe(false);
    expect(esDiaHabil(enCR('2026-11-29', '09:00'))).toBe(false);
  });
  it('usa el día de Costa Rica (viernes 21:00 CR ya es sábado en UTC)', () => {
    expect(esDiaHabil(new Date('2026-11-28T03:00:00Z'))).toBe(true);
  });
});

describe('sumarMinutos', () => {
  it('suma y resta minutos', () => {
    expect(iso(sumarMinutos(enCR('2026-11-25', '07:00'), 30))).toBe(iso(enCR('2026-11-25', '07:30')));
    expect(iso(sumarMinutos(enCR('2026-11-25', '07:00'), -60))).toBe(iso(enCR('2026-11-25', '06:00')));
  });
});

describe('sumarHorasLaborales', () => {
  it('dentro de la jornada', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '07:05'), 4))).toBe(iso(enCR('2026-11-25', '11:05')));
  });
  it('termina justo a las 17:00 sin saltar', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '13:00'), 4))).toBe(iso(enCR('2026-11-25', '17:00')));
  });
  it('salta la noche', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '16:00'), 4))).toBe(iso(enCR('2026-11-26', '10:00')));
  });
  it('salta el fin de semana', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-27', '15:00'), 4))).toBe(iso(enCR('2026-11-30', '09:00')));
  });
  it('arranca en la próxima apertura si empieza fuera de horario', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '05:00'), 4))).toBe(iso(enCR('2026-11-25', '11:00')));
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '18:00'), 4))).toBe(iso(enCR('2026-11-26', '11:00')));
    expect(iso(sumarHorasLaborales(enCR('2026-11-28', '10:00'), 4))).toBe(iso(enCR('2026-11-30', '11:00')));
  });
  it('0 horas no mueve el instante', () => {
    const d = enCR('2026-11-25', '18:00');
    expect(iso(sumarHorasLaborales(d, 0))).toBe(iso(d));
  });
  it('varios días', () => {
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '07:00'), 20))).toBe(iso(enCR('2026-11-26', '17:00')));
    expect(iso(sumarHorasLaborales(enCR('2026-11-25', '07:00'), 31))).toBe(iso(enCR('2026-11-30', '08:00')));
  });
});

describe('sumarDiasHabiles / siguienteDiaHabil / diasHabilesEntre', () => {
  it('conserva la hora y salta el fin de semana', () => {
    expect(iso(sumarDiasHabiles(enCR('2026-11-25', '15:00'), 1))).toBe(iso(enCR('2026-11-26', '15:00')));
    expect(iso(sumarDiasHabiles(enCR('2026-11-27', '15:00'), 1))).toBe(iso(enCR('2026-11-30', '15:00')));
    expect(iso(sumarDiasHabiles(enCR('2026-11-25', '07:00'), 5))).toBe(iso(enCR('2026-12-02', '07:00')));
  });
  it('n = 0 no cambia; n negativo retrocede', () => {
    const d = enCR('2026-11-25', '07:00');
    expect(iso(sumarDiasHabiles(d, 0))).toBe(iso(d));
    expect(iso(sumarDiasHabiles(enCR('2026-11-30', '07:00'), -1))).toBe(iso(enCR('2026-11-27', '07:00')));
  });
  it('siguienteDiaHabil', () => {
    expect(iso(siguienteDiaHabil(enCR('2026-11-25', '12:00')))).toBe(iso(enCR('2026-11-26', '12:00')));
    expect(iso(siguienteDiaHabil(enCR('2026-11-27', '12:00')))).toBe(iso(enCR('2026-11-30', '12:00')));
    expect(iso(siguienteDiaHabil(enCR('2026-11-28', '12:00')))).toBe(iso(enCR('2026-11-30', '12:00')));
  });
  it('diasHabilesEntre cuenta fechas de calendario de CR', () => {
    expect(diasHabilesEntre(enCR('2026-11-25', '07:00'), enCR('2026-11-25', '17:00'))).toBe(0);
    expect(diasHabilesEntre(enCR('2026-11-25', '17:00'), enCR('2026-11-26', '07:00'))).toBe(1);
    expect(diasHabilesEntre(enCR('2026-11-27', '10:00'), enCR('2026-11-30', '10:00'))).toBe(1);
    expect(diasHabilesEntre(enCR('2026-11-23', '10:00'), enCR('2026-11-30', '10:00'))).toBe(5);
    expect(diasHabilesEntre(enCR('2026-11-28', '10:00'), enCR('2026-11-29', '10:00'))).toBe(0);
  });
});

describe('resolverPlazo', () => {
  const antes = enCR('2026-11-25', '07:05');
  const despues = enCR('2026-11-25', '13:00');
  it('con hora: ese día a esa hora', () => {
    expect(iso(resolverPlazo({ dia: '2026-11-27', hora: '09:30' }, false, antes))).toBe(iso(enCR('2026-11-27', '09:30')));
    expect(iso(resolverPlazo({ dia: 'hoy', hora: '14:00' }, true, antes))).toBe(iso(enCR('2026-11-25', '14:00')));
    expect(iso(resolverPlazo({ dia: 'manana', hora: '10:00' }, false, antes))).toBe(iso(enCR('2026-11-26', '10:00')));
  });
  it('hoy urgente: 12:00 antes de mediodía, 17:00 después', () => {
    expect(iso(resolverPlazo({ dia: 'hoy' }, true, antes))).toBe(iso(enCR('2026-11-25', '12:00')));
    expect(iso(resolverPlazo({ dia: 'hoy' }, true, despues))).toBe(iso(enCR('2026-11-25', '17:00')));
  });
  it('hoy normal: 17:00', () => {
    expect(iso(resolverPlazo({ dia: 'hoy' }, false, antes))).toBe(iso(enCR('2026-11-25', '17:00')));
  });
  it('mañana: siguiente día hábil 17:00', () => {
    expect(iso(resolverPlazo({ dia: 'manana' }, false, antes))).toBe(iso(enCR('2026-11-26', '17:00')));
    expect(iso(resolverPlazo({ dia: 'manana' }, true, enCR('2026-11-27', '09:00')))).toBe(iso(enCR('2026-11-30', '17:00')));
  });
  it('fecha explícita: 17:00', () => {
    expect(iso(resolverPlazo({ dia: '2026-12-01' }, false, antes))).toBe(iso(enCR('2026-12-01', '17:00')));
  });
});
