// Confianza y visibilidad (docs/08 reglas 14 y 18). Puro. Esqueleto de R2; lo implementa R3.
// visiblePara e instantaneaVisible son contrato de la instantánea (motor/instantanea.ts, R2): aquí solo se reexportan.
import type { Confianza, EvidenciaTrabajo, Trabajo } from '@/dominio/tipos';

export { instantaneaVisible, visiblePara } from '@/motor/instantanea';

/**
 * Regla 18 (calculada, no se guarda): `una_fuente` = propuesto; `dos_fuentes` = origen correo, confirmado y
 * `confirmadoPorId` null; `persona` = todo lo demás.
 * Las evidencias no cambian el resultado (la regla se lee de los campos del trabajo); se reciben para que la firma
 * no cambie si algún día la confianza las mira.
 */
export function confianzaDe(t: Trabajo, evidencias: EvidenciaTrabajo[]): Confianza {
  void evidencias;
  if (t.confirmacion === 'propuesto') return 'una_fuente';
  if (t.origen === 'correo' && t.confirmacion === 'confirmado' && t.confirmadoPorId === null) return 'dos_fuentes';
  return 'persona';
}

/**
 * Partes (solicitante y responsable) en cuyo buzón está el pedido: unión de `buzones` de sus evidencias `pedido`.
 * Nunca cuenta el buzón de alguien en copia. Orden: solicitante, responsable (sin repetir).
 */
export function buzonesDelPedido(t: Trabajo, evidencias: EvidenciaTrabajo[]): string[] {
  const vistos = new Set<string>();
  for (const e of evidencias) {
    if (e.trabajoId !== t.id || e.tipo !== 'pedido') continue;
    for (const b of e.buzones) vistos.add(b);
  }
  const partes = [t.solicitadoPorId, t.responsableId].filter((p): p is string => p !== null);
  return [...new Set(partes)].filter((p) => vistos.has(p));
}

/**
 * Regla 14b: ¿lo vieron los buzones de las DOS partes? Exige solicitante distinto del responsable (sin solicitante, o
 * si se lo pidió a sí mismo, hay una sola parte y nunca se confirma por fuentes).
 */
export function cubreDosPartes(t: Trabajo, evidencias: EvidenciaTrabajo[]): boolean {
  if (t.solicitadoPorId === null || t.solicitadoPorId === t.responsableId) return false;
  return buzonesDelPedido(t, evidencias).length === 2;
}
