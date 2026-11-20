// Seguimiento y escalamiento: R1, R2, R3 (§4.2 reglas 2–3). Puro. Tarea 3.1.
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

/** R1, R2, R3 hasta inst.ahora, en orden. */
export function tick(inst: Instantanea): Efecto[] {
  void inst;
  return [];
}

/** Menor instante futuro (> ahora) en que pasará algo; null si nada. */
export function siguienteEvento(inst: Instantanea): Date | null {
  void inst;
  return null;
}

/** Nivel 0 al crear un trabajo urgente por captura. */
export function iniciarSeguimientoUrgente(inst: Instantanea, trabajoId: string): Efecto[] {
  void inst;
  void trabajoId;
  return [];
}

export function registrarRespuesta(inst: Instantanea, trabajoId: string, personaId: string): Efecto[] {
  void inst;
  void trabajoId;
  void personaId;
  return [];
}
