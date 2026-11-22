// Ingesta de correo: reglas 12–14b de docs/08 sobre hechos ya extraídos. Puro. Esqueleto de R2; lo implementa R5.
import type { CopiaLeida, EmpresaCorreo, EsperaCorreo, HechoCorreo, PedidoCorreo } from '@/correo/tipos';
import { noImplementado, type ResumenLectura } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Plan de una lectura: los efectos (trabajos M01…, evidencias, dependencias, bloqueos, entregas, recepciones,
 * acciones `leer_correo`/`proponer_trabajo`/`reconocer_correo`/`crear_trabajo`, seguimientos `propuesta`,
 * `registrar_mensajes`) y su resumen. `yaLeidos`: claves `${personaId}|${idInternet}` (db/instantanea.ts claveLeido).
 * Solo procesa las copias que no están en `yaLeidos`; con 0 copias nuevas devuelve `{ efectos: [], resumen }` vacío.
 */
export function planLectura(
  inst: Instantanea,
  e: { hechos: HechoCorreo[]; copias: CopiaLeida[]; yaLeidos: Set<string>; empresa: EmpresaCorreo },
): { efectos: Efecto[]; resumen: ResumenLectura } {
  return noImplementado('R5 · motor/ingesta.ts · planLectura', inst, e);
}

/** Regla 12b: id del trabajo (no resuelto, no descartado) que es el mismo hecho que el pedido, o null. */
export function mismoHecho(inst: Instantanea, p: PedidoCorreo): string | null {
  return noImplementado('R5 · motor/ingesta.ts · mismoHecho', inst, p);
}

/** Regla 13: trabajo al que corresponde lo que se espera (umbral UMBRAL_ENLACE_ESPERA), o null. `propioId`: el trabajo
 * de quien espera, que nunca se enlaza consigo mismo. */
export function enlazarEspera(inst: Instantanea, espera: EsperaCorreo, propioId: string | null): string | null {
  return noImplementado('R5 · motor/ingesta.ts · enlazarEspera', inst, espera, propioId);
}

/** Regla 12 (proyecto): el del trabajo enlazado; si no, por el asunto (P4, P2, P1, P3) o 'OD'. */
export function proyectoDelPedido(inst: Instantanea, p: PedidoCorreo, enlazadoId: string | null): string {
  return noImplementado('R5 · motor/ingesta.ts · proyectoDelPedido', inst, p, enlazadoId);
}
