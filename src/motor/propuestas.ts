// Propuestas de Nexo: seguimiento y revisión (docs/08 reglas 15–17). Puro. Esqueleto de R2; lo implementa R3.
import {
  noImplementado,
  type DatosRevisionCaptura,
  type EntradaRevisionPropuesta,
  type RevisionNueva,
} from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Regla 15: al crearse una propuesta, su seguimiento `tipo = 'propuesta'` (nivel 0, destinatario = dueño,
 * `plazoReferencia` = `iniciadoEn` = creación, `proximoEn` = creación + HORAS_REVISION_PROPUESTA laborales).
 * Solo crea el seguimiento (nivel 0 sin acción). `inst` ya debe contener el trabajo.
 */
export function seguimientoDePropuesta(inst: Instantanea, trabajoId: string): Efecto[] {
  return noImplementado('R3 · motor/propuestas.ts · seguimientoDePropuesta', inst, trabajoId);
}

/**
 * Regla 16: confirmar, corregir o descartar una propuesta. ErrorDominio si `personaId` no puede revisarla o si
 * «No cambiaste nada». Incluye la acción `revisar_propuesta`, el evento `propuesta_revisada`, el efecto
 * `registrar_revision`, el cierre del seguimiento `propuesta` y los avisos que correspondan.
 */
export function efectosRevision(inst: Instantanea, trabajoId: string, personaId: string, r: EntradaRevisionPropuesta): Efecto[] {
  return noImplementado('R3 · motor/propuestas.ts · efectosRevision', inst, trabajoId, personaId, r);
}

/**
 * Regla 17: revisión `origen = 'captura'` al responder la pregunta de responsable: `confirmada` si `elegidoId` es la
 * primera opción propuesta (`propuestoId`), `corregida` con `['responsable']` si es otra.
 */
export function revisionDeCaptura(propuestoId: string, elegidoId: string, datos: DatosRevisionCaptura): RevisionNueva {
  return noImplementado('R3 · motor/propuestas.ts · revisionDeCaptura', propuestoId, elegidoId, datos);
}
