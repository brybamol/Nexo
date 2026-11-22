// Cuánto se equivoca Nexo (docs/08 regla 22). Puro. Esqueleto de R2; lo implementa R6b.
import {
  noImplementado,
  type CasoCorreccion,
  type Confirmacion,
  type RevisionPropuesta,
  type TasaCorreccion,
} from '@/dominio/tipos';

/**
 * Regla 22. `revisiones`: todas (de correo y de captura); cuenta solo la PRIMERA revisión humana de cada trabajo o
 * captura. `inferidos`: los trabajos de origen correo (también los descartados).
 */
export function calcularTasaCorreccion(
  revisiones: RevisionPropuesta[],
  inferidos: { id: string; confirmacion: Confirmacion; confirmadoPorId: string | null }[],
): TasaCorreccion {
  return noImplementado('R6b · motor/tasa.ts · calcularTasaCorreccion', revisiones, inferidos);
}

/** Caso de prueba: `{ entrada, propuesto, esperado: final, resultado }`. */
export function casoDePrueba(r: RevisionPropuesta): CasoCorreccion {
  return noImplementado('R6b · motor/tasa.ts · casoDePrueba', r);
}
