import { describe, expect, it } from 'vitest';
import { formatearColones, formatearFecha, formatearHoras } from '@/dominio/formato';
import { enCR } from '@/dominio/tiempo';

describe('formato', () => {
  it('colones', () => {
    expect(formatearColones(1380000)).toBe('₡1.380.000');
    expect(formatearColones(0)).toBe('₡0');
    expect(formatearColones(950)).toBe('₡950');
    expect(formatearColones(100000)).toBe('₡100.000');
    expect(formatearColones(-1500)).toBe('-₡1.500');
  });
  it('fecha en hora de Costa Rica', () => {
    expect(formatearFecha(enCR('2026-11-25', '15:00'))).toBe('mié 25 nov, 15:00');
    expect(formatearFecha(enCR('2026-11-30', '07:05'))).toBe('lun 30 nov, 07:05');
    expect(formatearFecha(new Date('2026-11-26T03:00:00Z'))).toBe('mié 25 nov, 21:00');
  });
  it('horas con una decimal y coma', () => {
    expect(formatearHoras(205)).toBe('3,4 h');
    expect(formatearHoras(60)).toBe('1,0 h');
    expect(formatearHoras(30)).toBe('0,5 h');
    expect(formatearHoras(0)).toBe('0,0 h');
  });
});
