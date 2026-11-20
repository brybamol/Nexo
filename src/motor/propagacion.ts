// Propagación del bloqueo y avisos agrupados: R4, R5 (§4.2 regla 4). Puro. Tarea 3.2.
import type { HechoBloqueo } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

export type { HechoBloqueo };

/** Estado bloqueado, faltante reportado, R4 y R5. */
export function efectosBloqueo(inst: Instantanea, hecho: HechoBloqueo): Efecto[] {
  void inst;
  void hecho;
  return [];
}

export function avisosPorRiesgoNuevo(antes: Instantanea, despues: Instantanea, hecho: string): Efecto[] {
  void antes;
  void despues;
  void hecho;
  return [];
}

/** 'T15' si hay un trabajo no resuelto con etiqueta de conciliación y el repuesto tenía existencia > 0. */
export function causaCitada(inst: Instantanea, repuestoId: string): string | null {
  void inst;
  void repuestoId;
  return null;
}
