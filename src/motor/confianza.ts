// Confianza y visibilidad (docs/08 reglas 14 y 18). Puro. Esqueleto de R2; lo implementa R3.
// visiblePara e instantaneaVisible son contrato de la instantánea (motor/instantanea.ts, R2): aquí solo se reexportan.
import { noImplementado, type Confianza, type EvidenciaTrabajo, type Trabajo } from '@/dominio/tipos';

export { instantaneaVisible, visiblePara } from '@/motor/instantanea';

/**
 * Regla 18 (calculada, no se guarda): `una_fuente` = propuesto; `dos_fuentes` = origen correo, confirmado y
 * `confirmadoPorId` null; `persona` = todo lo demás.
 */
export function confianzaDe(t: Trabajo, evidencias: EvidenciaTrabajo[]): Confianza {
  return noImplementado('R3 · motor/confianza.ts · confianzaDe', t, evidencias);
}

/** Partes (solicitante y responsable) en cuyo buzón está el pedido: unión de `buzones` de sus evidencias `pedido`. */
export function buzonesDelPedido(t: Trabajo, evidencias: EvidenciaTrabajo[]): string[] {
  return noImplementado('R3 · motor/confianza.ts · buzonesDelPedido', t, evidencias);
}
