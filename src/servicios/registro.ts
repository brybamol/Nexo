// Registro de acciones de Nexo. Tarea 4.4.
import { desc } from 'drizzle-orm';
import { acciones, personas } from '@/db/esquema';
import type { ContextoServicio } from '@/servicios/contexto';
import type { AccionVista } from '@/servicios/vistas';

/** Más recientes primero. */
export async function listarAcciones(ctx: ContextoServicio, f?: { limite?: number }): Promise<AccionVista[]> {
  const orden = [desc(acciones.en), desc(acciones.id)] as const;
  const filas =
    f?.limite === undefined
      ? await ctx.db.select().from(acciones).orderBy(...orden)
      : await ctx.db.select().from(acciones).orderBy(...orden).limit(f.limite);
  const filasPersonas = await ctx.db.select().from(personas);
  const porId = new Map(filasPersonas.map((p) => [p.id, { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area }]));
  return filas.map((a) => ({
    id: a.id,
    en: a.en,
    tipo: a.tipo,
    motivo: a.motivo,
    hechoOrigen: a.hechoOrigen,
    trabajoIds: a.trabajoIds,
    destinatario: a.destinatarioId ? (porId.get(a.destinatarioId) ?? null) : null,
    decisionId: a.decisionId,
  }));
}
