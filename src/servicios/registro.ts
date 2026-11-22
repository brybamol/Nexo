// Registro de acciones de Nexo. Tarea 4.4.
import { desc } from 'drizzle-orm';
import { acciones, decisiones, personas, proyectos, repuestos, trabajos, type Db } from '@/db/esquema';
import { crearNombrador, type Nombrador } from '@/dominio/nombres';
import type { ContextoServicio } from '@/servicios/contexto';
import type { AccionVista, PersonaBreve } from '@/servicios/vistas';

type FilaAccion = typeof acciones.$inferSelect;

/** Nombres visibles de trabajos y decisiones leídos de la base (sin cargar la instantánea entera). */
export async function cargarNombrador(db: Db): Promise<Nombrador> {
  const [ps, ts, ds, rs] = await Promise.all([
    db.select({ id: proyectos.id, clave: proyectos.clave }).from(proyectos),
    db.select({ id: trabajos.id, proyectoId: trabajos.proyectoId, numero: trabajos.numero, titulo: trabajos.titulo }).from(trabajos),
    db
      .select({
        id: decisiones.id,
        proyectoId: decisiones.proyectoId,
        numero: decisiones.numero,
        repuestoId: decisiones.repuestoId,
        cantidad: decisiones.cantidad,
      })
      .from(decisiones),
    db.select({ id: repuestos.id, nombre: repuestos.nombre, unidad: repuestos.unidad }).from(repuestos),
  ]);
  return crearNombrador({ proyectos: ps, trabajos: ts, decisiones: ds, repuestos: rs });
}

/** Fila de `acciones` → vista, con el nombre visible de sus trabajos y de su decisión. */
export function accionAVista(a: FilaAccion, nombres: Nombrador, personasPorId: Map<string, PersonaBreve>): AccionVista {
  return {
    id: a.id,
    en: a.en,
    tipo: a.tipo,
    motivo: a.motivo,
    hechoOrigen: a.hechoOrigen,
    trabajoIds: a.trabajoIds,
    trabajos: nombres.refs(a.trabajoIds),
    destinatario: a.destinatarioId ? (personasPorId.get(a.destinatarioId) ?? null) : null,
    decisionId: a.decisionId,
    decision: a.decisionId
      ? { id: a.decisionId, titulo: nombres.tituloDecision(a.decisionId), referencia: nombres.referenciaDecision(a.decisionId) }
      : null,
  };
}

/** Más recientes primero. */
export async function listarAcciones(ctx: ContextoServicio, f?: { limite?: number }): Promise<AccionVista[]> {
  const orden = [desc(acciones.en), desc(acciones.id)] as const;
  const filas =
    f?.limite === undefined
      ? await ctx.db.select().from(acciones).orderBy(...orden)
      : await ctx.db.select().from(acciones).orderBy(...orden).limit(f.limite);
  const filasPersonas = await ctx.db.select().from(personas);
  const porId = new Map(filasPersonas.map((p) => [p.id, { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area }]));
  const nombres = await cargarNombrador(ctx.db);
  return filas.map((a) => accionAVista(a, nombres, porId));
}
