// Paginación de la tabla de Registro: lotes de 10, 20 y 50, y valores de la dirección que no se pueden creer.
import { describe, expect, it } from 'vitest';
import { paginar } from '@/dominio/paginacion';

describe('paginar', () => {
  it('sin nada pedido muestra las primeras 10', () => {
    expect(paginar(29)).toEqual({ por: 10, pagina: 1, paginas: 3, desde: 0, hasta: 10, total: 29 });
  });

  it('la última página trae solo lo que queda', () => {
    expect(paginar(29, '10', '3')).toMatchObject({ pagina: 3, desde: 20, hasta: 29 });
  });

  it('acepta los lotes de 20 y 50', () => {
    expect(paginar(29, '20', '2')).toMatchObject({ por: 20, pagina: 2, paginas: 2, desde: 20, hasta: 29 });
    expect(paginar(29, '50')).toMatchObject({ por: 50, pagina: 1, paginas: 1, desde: 0, hasta: 29 });
  });

  it('un lote que no se ofrece vuelve a 10', () => {
    for (const por of ['15', '0', '-10', 'abc', '1e3', '']) expect(paginar(29, por).por).toBe(10);
  });

  it('una página fuera de rango se ajusta a la más cercana', () => {
    expect(paginar(29, '10', '99').pagina).toBe(3);
    expect(paginar(29, '10', '0').pagina).toBe(1);
    expect(paginar(29, '10', 'abc').pagina).toBe(1);
    expect(paginar(29, '10', '2.5').pagina).toBe(1);
  });

  it('con la dirección repetida toma el primer valor', () => {
    expect(paginar(29, ['20', '50'], ['2', '1'])).toMatchObject({ por: 20, pagina: 2 });
  });

  it('una lista vacía tiene una sola página sin filas', () => {
    expect(paginar(0)).toEqual({ por: 10, pagina: 1, paginas: 1, desde: 0, hasta: 0, total: 0 });
  });

  it('un total exacto no deja una página vacía al final', () => {
    expect(paginar(20, '10').paginas).toBe(2);
    expect(paginar(20, '10', '2')).toMatchObject({ desde: 10, hasta: 20 });
  });
});
