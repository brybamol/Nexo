// Tasa de corrección y casos de prueba (docs/08 regla 22). Esqueletos de R2; los implementa R6b.
// Lee `revisiones` (db/instantanea.ts cargarRevisiones) y los trabajos de origen correo, también los descartados.
import { noImplementado, type CasoCorreccion, type TasaCorreccion } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';

export async function obtenerTasaCorreccion(ctx: ContextoServicio): Promise<TasaCorreccion> {
  return noImplementado('R6b · servicios/tasa.ts · obtenerTasaCorreccion', ctx);
}

/** Un caso por primera revisión humana: `{ entrada, propuesto, esperado: final, resultado }`. */
export async function exportarCasosDePrueba(ctx: ContextoServicio): Promise<CasoCorreccion[]> {
  return noImplementado('R6b · servicios/tasa.ts · exportarCasosDePrueba', ctx);
}
