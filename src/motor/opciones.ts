// Opciones A/B/C y decisor: R6, R7 (§4.2 regla 8). Puro. Tarea 3.3.
import type { CambioFecha, OpcionCalculada, PropuestaCompra } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

export type { CambioFecha, OpcionCalculada, PropuestaCompra };

export function calcularOpciones(inst: Instantanea, p: PropuestaCompra): OpcionCalculada[] {
  void inst;
  void p;
  return [];
}

/** personaId: jefe de operaciones si el costo máximo ≤ ₡100.000; si no, gerente general. */
export function decisorPara(inst: Instantanea, opciones: OpcionCalculada[]): string {
  void inst;
  void opciones;
  return '';
}
