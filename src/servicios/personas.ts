// Personas para el selector «ver como». Tarea 1.5.
import { personas } from '@/db/esquema';
import type { ContextoServicio } from '@/servicios/contexto';
import type { PersonaBreve } from '@/servicios/vistas';

/** Las 12 personas en el orden de la semilla (la gerente primero). */
export async function listarPersonas(ctx: ContextoServicio): Promise<PersonaBreve[]> {
  const filas = await ctx.db.select().from(personas);
  return filas.map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, area: p.area }));
}
