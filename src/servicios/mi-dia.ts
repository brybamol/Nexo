// Vista «Mi día» por persona. Tarea 4.1.
// Lee la instantánea (trabajos con marcas) y los avisos guardados; no escribe salvo marcarAvisosLeidos.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { acciones, avisos } from '@/db/esquema';
import { ErrorDominio, NoImplementado, type Persona } from '@/dominio/tipos';
import { registrarRespuesta } from '@/motor/seguimiento';
import type { ContextoServicio } from '@/servicios/contexto';
import { cargarVistasTrabajos } from '@/servicios/consultas-trabajos';
import { listarDecisiones } from '@/servicios/decisiones';
import { cargarNombrador } from '@/servicios/registro';
import { obtenerAhora } from '@/servicios/reloj';
import type { AvisoVista, DecisionVista, MiDia, PersonaBreve, TrabajoVista } from '@/servicios/vistas';

const MAX_AVISOS = 20;

function breve(p: Persona): PersonaBreve {
  return { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area };
}

function persona(personas: Persona[], id: string): Persona {
  const p = personas.find((x) => x.id === id);
  if (!p) throw new ErrorDominio(`No existe la persona ${id}.`);
  return p;
}

/** Orden de «lo que debo»: urgentes, luego atrasados, luego plazo ascendente (empate: id). */
function ordenDebo(a: TrabajoVista, b: TrabajoVista): number {
  if (a.urgente !== b.urgente) return a.urgente ? -1 : 1;
  if (a.marcas.atrasado !== b.marcas.atrasado) return a.marcas.atrasado ? -1 : 1;
  return a.plazo.getTime() - b.plazo.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

async function avisosDe(ctx: ContextoServicio, personaId: string): Promise<AvisoVista[]> {
  const filas = await ctx.db
    .select({ aviso: avisos, tipo: acciones.tipo })
    .from(avisos)
    .innerJoin(acciones, eq(avisos.accionId, acciones.id))
    .where(eq(avisos.personaId, personaId))
    .orderBy(desc(avisos.en), desc(avisos.id))
    .limit(MAX_AVISOS);
  const nombres = await cargarNombrador(ctx.db);
  return filas.map(({ aviso, tipo }) => ({
    id: aviso.id,
    en: aviso.en,
    titulo: aviso.titulo,
    cuerpo: aviso.cuerpo,
    trabajoIds: aviso.trabajoIds,
    trabajos: nombres.refs(aviso.trabajoIds),
    tipoAccion: tipo,
    leido: aviso.leidoEn !== null,
  }));
}

async function decisionesPendientesDe(ctx: ContextoServicio, personaId: string): Promise<DecisionVista[]> {
  try {
    return await listarDecisiones(ctx, { decisorId: personaId, estado: 'pendiente' });
  } catch (e) {
    if (e instanceof NoImplementado) return []; // la bandeja de decisiones (3.3) aún no existe en esta rama
    throw e;
  }
}

/**
 * Lo que la persona ve al abrir Nexo. `debo`: sus trabajos no resueltos (urgente, atrasado, plazo).
 * `esperoDeOtros`: trabajos no resueltos de otros responsables que ella solicitó, de los que dependen sus trabajos
 * o por los que están bloqueados, sin repetir y por plazo. `avisos`: los suyos, del más reciente al más antiguo, máx. 20.
 */
export async function obtenerMiDia(ctx: ContextoServicio, personaId: string): Promise<MiDia> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db, personaId); // instantánea visible para ella (regla 18)
  const yo = persona(inst.personas, personaId);

  // Regla 15: una propuesta no es «lo que debo» ni «lo que espero»: va aparte, solo para su dueño.
  const propuestas = vistas.filter((v) => v.confirmacion === 'propuesto' && v.dueno?.id === personaId);
  const pendientes = vistas.filter((v) => v.estado !== 'resuelto' && v.confirmacion === 'confirmado');
  const debo = pendientes.filter((v) => v.responsable.id === personaId).sort(ordenDebo);

  // Regla 20: lo que pidió, otra persona ya entregó y falta que ella confirme que lo recibió.
  const porConfirmarRecibido = pendientes.filter(
    (v) => v.entrega !== null && v.solicitadoPor?.id === personaId && v.responsable.id !== personaId,
  );
  const porConfirmar = new Set(porConfirmarRecibido.map((v) => v.id));

  const necesarios = new Set<string>();
  for (const t of debo) {
    for (const id of t.dependeDe) necesarios.add(id);
    if (t.bloqueadoPor) necesarios.add(t.bloqueadoPor.id);
  }
  const esperoDeOtros = pendientes.filter(
    (v) => v.responsable.id !== personaId && !porConfirmar.has(v.id) && (v.solicitadoPor?.id === personaId || necesarios.has(v.id)),
  ); // `vistas` ya viene por plazo ascendente

  return {
    persona: breve(yo),
    ahora: inst.ahora,
    debo,
    esperoDeOtros,
    avisos: await avisosDe(ctx, personaId),
    decisionesPendientes: await decisionesPendientesDe(ctx, personaId),
    propuestas,
    porConfirmarRecibido,
  };
}

/**
 * Trabajos con un seguimiento pendiente que la persona puede responder (es el responsable, o un jefe al que
 * ya se escaló): los que Nexo le está pidiendo ahora. Del seguimiento más antiguo al más reciente.
 */
export async function obtenerSeguimientosPendientes(ctx: ContextoServicio, personaId: string): Promise<TrabajoVista[]> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db, personaId);
  persona(inst.personas, personaId);
  // Solo seguimientos de ESTADO (los de recepción y propuesta viven en porConfirmarRecibido y propuestas).
  return vistas
    .filter((v) => v.seguimiento !== null && v.confirmacion === 'confirmado' && registrarRespuesta(inst, v.id, personaId).length > 0)
    .sort((a, b) => (a.seguimiento?.desde.getTime() ?? 0) - (b.seguimiento?.desde.getTime() ?? 0) || (a.id < b.id ? -1 : 1));
}

/** Marca como leídos todos los avisos de la persona que aún no lo estaban. */
export async function marcarAvisosLeidos(ctx: ContextoServicio, personaId: string): Promise<void> {
  const ahora = await obtenerAhora(ctx);
  await ctx.db
    .update(avisos)
    .set({ leidoEn: ahora })
    .where(and(eq(avisos.personaId, personaId), isNull(avisos.leidoEn)));
}
