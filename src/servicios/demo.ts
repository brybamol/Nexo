// Reinicio de la demo: DDL_BORRAR + DDL_CREAR + cargarSemilla en una transacción. Tarea 1.5.
import { sql } from 'drizzle-orm';
import { DDL_BORRAR, DDL_CREAR } from '@/db/ddl';
import { cargarSemilla } from '@/db/semilla/cargar';
import type { ContextoServicio } from '@/servicios/contexto';

/** El DDL son sentencias sueltas sin `;` internos: se ejecutan una a una (la consulta preparada no admite varias). */
function sentencias(ddl: string): string[] {
  return ddl
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Deja la base exactamente como al arrancar: sin rastro de lo hecho en la demo. Todo o nada. */
export async function reiniciarDemo(ctx: ContextoServicio): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    for (const s of [...sentencias(DDL_BORRAR), ...sentencias(DDL_CREAR)]) {
      await tx.execute(sql.raw(s));
    }
    await cargarSemilla(tx);
  });
}
