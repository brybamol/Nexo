// Presentación de las tres cifras (05 §5). Tarea 4.4.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CifrasDemo } from '@/componentes/cifras-demo';
import type { Cifras } from '@/servicios/vistas';

const CIFRAS: Cifras = {
  resueltosSinGerente: 6,
  resueltosTotal: 8,
  porcentaje: 75,
  seguimientos: 19,
  preguntasRespondidas: 1,
  minutosAhorrados: 205,
  horasAhorradas: 3.4,
};

describe('CifrasDemo', () => {
  const html = renderToStaticMarkup(createElement(CifrasDemo, { cifras: CIFRAS }));

  it('muestra la cifra 1 con el porcentaje y la meta', () => {
    expect(html).toContain('6 de 8 (75 %)');
    expect(html).toContain('meta 50 %');
  });

  it('muestra la cifra 2 con el número de seguimientos', () => {
    expect(html).toContain('19');
  });

  it('muestra la cifra 3 en horas con coma decimal y siempre con la palabra estimado', () => {
    expect(html).toContain('3,4 h');
    expect(html).toContain('estimado');
  });

  it('declara que las horas son hipótesis, no medición', () => {
    expect(html).toContain('Hipótesis de minutos, no medición');
  });
});
