// Tasa de corrección y casos de prueba (docs/08 regla 22). Tarea R6b.
// Lee `revisiones` (db/instantanea.ts cargarRevisiones) y los trabajos de origen correo, también los descartados
// (la instantánea no los trae completos, por eso se leen de la tabla).
import { asc, eq } from 'drizzle-orm';
import { trabajos, type Db } from '@/db/esquema';
import { cargarRevisiones } from '@/db/instantanea';
import type { CasoCorreccion, TasaCorreccion } from '@/dominio/tipos';
import { calcularTasaCorreccion, casoDePrueba, primerasRevisiones } from '@/motor/tasa';
import type { ContextoServicio } from '@/servicios/contexto';

async function inferidos(db: Db) {
  return db
    .select({ id: trabajos.id, confirmacion: trabajos.confirmacion, confirmadoPorId: trabajos.confirmadoPorId })
    .from(trabajos)
    .where(eq(trabajos.origen, 'correo'))
    .orderBy(asc(trabajos.id));
}

/** Regla 22. Con cero revisiones, `tasa = null`: la interfaz dice «Todavía no lo sé: nadie ha revisado lo que Nexo propuso». */
export async function obtenerTasaCorreccion(ctx: ContextoServicio): Promise<TasaCorreccion> {
  const revisiones = await cargarRevisiones(ctx.db);
  return calcularTasaCorreccion(revisiones, await inferidos(ctx.db));
}

/** Un caso por primera revisión humana: `{ entrada, propuesto, esperado: final, resultado }`, en orden de revisión. */
export async function exportarCasosDePrueba(ctx: ContextoServicio): Promise<CasoCorreccion[]> {
  return primerasRevisiones(await cargarRevisiones(ctx.db)).map(casoDePrueba);
}
