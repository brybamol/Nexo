// Marcas calculadas: atrasado, en riesgo y causas (§4.2 regla 1). Puro. Tarea 2.4.
import type { Marcas } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/** Una entrada por trabajo. */
export function calcularMarcas(inst: Instantanea): Map<string, Marcas> {
  void inst;
  return new Map();
}
