// Revisión de las propuestas de Nexo (docs/08 regla 16). Esqueleto de R2; lo implementa R6b.
// Mutación: transacción → tomarTurnoEscritura → cargarInstantanea → efectosRevision (motor/propuestas.ts) → persistirEfectos.
import { noImplementado, type EntradaRevisionPropuesta } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';

/** Confirmar, corregir o descartar una propuesta. ErrorDominio si `personaId` no puede revisarla. */
export async function revisarPropuesta(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  r: EntradaRevisionPropuesta,
): Promise<void> {
  return noImplementado('R6b · servicios/propuestas.ts · revisarPropuesta', ctx, trabajoId, personaId, r);
}
