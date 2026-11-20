import { describe, expect, it } from 'vitest';
import { minusculaInicial, normalizar, similitud } from '@/dominio/texto';

describe('normalizar', () => {
  it('minúsculas, sin tildes ni puntuación, espacios simples', () => {
    expect(normalizar('  ¡Hola,   MUNDO! Cámara-fría… ')).toBe('hola mundo camara fria');
    expect(normalizar('Ñandú: T04?')).toBe('nandu t04');
    expect(normalizar('')).toBe('');
  });
});

describe('similitud', () => {
  it('idénticos tras normalizar = 1', () => {
    expect(similitud('Compresor, 2HP', 'compresor 2hp')).toBe(1);
  });
  it('sin nada en común = 0', () => {
    expect(similitud('abc', 'xyz')).toBe(0);
  });
  it('parecidos entre 0 y 1', () => {
    const s = similitud('falta el compresor', 'falta un compresor');
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
  it('es simétrica', () => {
    expect(similitud('termostato roto', 'termostato')).toBe(similitud('termostato', 'termostato roto'));
  });
  it('textos muy cortos', () => {
    expect(similitud('a', 'a')).toBe(1);
    expect(similitud('a', 'b')).toBe(0);
    expect(similitud('', '')).toBe(1);
    expect(similitud('', 'hola')).toBe(0);
  });
});

describe('minusculaInicial', () => {
  it('solo baja la primera letra: conserva siglas como «HP»', () => {
    expect(minusculaInicial('Compresor de 2 HP')).toBe('compresor de 2 HP');
    expect(minusculaInicial('')).toBe('');
  });
});
