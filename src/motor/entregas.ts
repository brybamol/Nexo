// Entrega y resolución con evidencia (docs/08 reglas 19–20). Puro. Esqueleto de R2; lo implementa R4.
import { noImplementado, type Entrega, type Trabajo } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

/** Regla 19: quien lo pidió resuelve; el responsable con otro solicitante entrega; el que se lo pidió a sí mismo (o sin
 * solicitante) resuelve con nota; nadie más puede. */
export function modoResolucion(t: Trabajo, personaId: string): 'resolver' | 'entregar' | 'prohibido' {
  return noImplementado('R4 · motor/entregas.ts · modoResolucion', t, personaId);
}

/** Regla 20: declarar la entrega (pone `entrega`, evidencia `entrega`, cierra seguimientos de estado, aviso y
 * seguimiento `recepcion` si está confirmado). ErrorDominio sin nota ni enlace o si está bloqueado por otro. */
export function efectosEntrega(
  inst: Instantanea,
  trabajoId: string,
  personaId: string,
  e: { nota: string | null; enlace: string | null; fuente: Entrega['fuente'] },
): Efecto[] {
  return noImplementado('R4 · motor/entregas.ts · efectosEntrega', inst, trabajoId, personaId, e);
}

/** Regla 20: el solicitante confirma que lo recibió → Resuelto, liberación (regla 5), aviso al responsable. */
export function efectosRecepcion(inst: Instantanea, trabajoId: string, personaId: string, cita: string, fuente: Entrega['fuente']): Efecto[] {
  return noImplementado('R4 · motor/entregas.ts · efectosRecepcion', inst, trabajoId, personaId, cita, fuente);
}

/** Regla 20: el solicitante rechaza la entrega (motivo obligatorio) → `entrega = null`, nota, aviso, evento. */
export function efectosRechazoEntrega(inst: Instantanea, trabajoId: string, personaId: string, motivo: string): Efecto[] {
  return noImplementado('R4 · motor/entregas.ts · efectosRechazoEntrega', inst, trabajoId, personaId, motivo);
}
