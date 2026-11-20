// Efectos de una actualización: notas con problema, liberación, reprogramación (§4.2 reglas 5–7). Puro. Tarea 2.3.
import type { PlanActualizacion } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

export function efectosActualizacion(inst: Instantanea, plan: PlanActualizacion, autorId: string): Efecto[] {
  void inst;
  void plan;
  void autorId;
  return [];
}
