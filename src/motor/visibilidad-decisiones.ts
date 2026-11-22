// Quién ve una decisión (docs/08 §10.7). Puro. No hay rangos nuevos: se usa lo que Nexo ya sabe de cada persona.
// Ver no es decidir: solo el decisor aprueba o rechaza (servicios/decisiones.ts lo comprueba aparte).
import { RESPONSABLE_OPERACION, ROL_GERENTE } from '@/dominio/constantes';
import type { Decision } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Una persona ve la decisión `d` si:
 * - la decide o la propuso;
 * - responde por el proyecto de la decisión;
 * - la decisión le toca el trabajo: figura entre los afectados, hoy responde por un trabajo afectado, o le tocó
 *   un trabajo que la decisión creó al aprobarse (la compra);
 * - es de gerencia: la gerente general o el responsable de la operación.
 * El resto no la ve.
 */
export function puedeVerDecision(inst: Instantanea, d: Decision, personaId: string): boolean {
  if (d.decisorId === personaId || d.proponenteId === personaId) return true;
  if (inst.proyectos.some((p) => p.id === d.proyectoId && p.responsableId === personaId)) return true;
  if (d.afectados.personaIds.includes(personaId)) return true;
  const afectados = new Set(d.afectados.trabajoIds);
  if (inst.trabajos.some((t) => t.responsableId === personaId && (afectados.has(t.id) || t.decisionId === d.id))) return true;
  if (personaId === RESPONSABLE_OPERACION) return true;
  return inst.personas.some((p) => p.id === personaId && p.rol === ROL_GERENTE);
}
