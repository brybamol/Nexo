// Revisión de las propuestas de Nexo (docs/08 regla 16). Tarea R6b.
// Mutación: transacción → tomarTurnoEscritura → cargarInstantanea (COMPLETA, no la visible) → efectosRevision
// (motor/propuestas.ts) → persistirEfectos. La fila de `revisiones` sale del efecto `registrar_revision`.
// No ejecuta tick: R1 aplica desde la revisión y lo hace el siguiente tick del reloj (regla 16).
import { cargarInstantanea, persistirEfectos, tomarTurnoEscritura } from '@/db/instantanea';
import { ErrorDominio, type EntradaRevisionPropuesta } from '@/dominio/tipos';
import { efectosRevision } from '@/motor/propuestas';
import type { ContextoServicio } from '@/servicios/contexto';

/** Confirmar, corregir o descartar una propuesta. ErrorDominio si `personaId` no puede revisarla. */
export async function revisarPropuesta(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  r: EntradaRevisionPropuesta,
): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    if (!inst.personas.some((p) => p.id === personaId)) throw new ErrorDominio(`No existe la persona ${personaId}.`);
    await persistirEfectos(tx, efectosRevision(inst, trabajoId, personaId, r));
  });
}
