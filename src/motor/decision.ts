// Decisiones: crear, aplicar (R8) y rechazar (§4.2 regla 9). Puro. Tarea 3.3.
import type { LetraOpcion, PropuestaCompra } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

export function efectosDecisionNueva(
  inst: Instantanea,
  p: PropuestaCompra,
  proponenteId: string,
  proyectoId: string,
  capturaId: number | null,
): Efecto[] {
  void inst;
  void p;
  void proponenteId;
  void proyectoId;
  void capturaId;
  return [];
}

export function aplicarDecision(inst: Instantanea, decisionId: string, letra: LetraOpcion, decisorId: string): Efecto[] {
  void inst;
  void decisionId;
  void letra;
  void decisorId;
  return [];
}

export function rechazarDecision(inst: Instantanea, decisionId: string, decisorId: string, motivo: string): Efecto[] {
  void inst;
  void decisionId;
  void decisorId;
  void motivo;
  return [];
}
