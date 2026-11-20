// Bandeja de decisiones: listar, aprobar (R8) y rechazar. Tarea 3.3.
// Cada mutación: transacción → cargarInstantanea → motor/decision → persistirEfectos.
import { cargarInstantanea, persistirEfectos, tomarTurnoEscritura } from '@/db/instantanea';
import { formatearColones } from '@/dominio/formato';
import { ErrorDominio, type Decision, type EstadoDecision, type LetraOpcion, type Persona } from '@/dominio/tipos';
import * as motor from '@/motor/decision';
import type { Efecto } from '@/motor/efectos';
import { porId, type Instantanea } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';
import type { DecisionVista, PersonaBreve } from '@/servicios/vistas';

function breve(p: Persona | undefined, id: string): PersonaBreve {
  if (!p) throw new Error(`Persona desconocida en la base: ${id}`);
  return { id: p.id, nombre: p.nombre, rol: p.rol, area: p.area };
}

function aVista(inst: Instantanea, d: Decision): DecisionVista {
  const personas = porId(inst.personas);
  const trabajos = porId(inst.trabajos);
  const proyecto = inst.proyectos.find((p) => p.id === d.proyectoId);
  return {
    id: d.id,
    estado: d.estado,
    creadaEn: d.creadaEn,
    proyecto: { id: d.proyectoId, nombre: proyecto?.nombre ?? d.proyectoId },
    proponente: breve(personas.get(d.proponenteId), d.proponenteId),
    decisor: breve(personas.get(d.decisorId), d.decisorId),
    contexto: d.contexto,
    afectados: d.afectados.trabajoIds.map((id) => {
      const t = trabajos.get(id);
      return { trabajoId: id, titulo: t?.titulo ?? '', responsable: t ? (personas.get(t.responsableId)?.nombre ?? t.responsableId) : '' };
    }),
    opciones: d.opciones.map((o) => ({ ...o, costoTexto: formatearColones(o.costo) })),
    opcionPropuesta: d.opcionPropuesta,
    opcionElegida: d.opcionElegida,
    decididaEn: d.decididaEn,
    motivoRechazo: d.motivoRechazo,
  };
}

/** Pendientes primero; dentro de cada grupo, las más recientes primero. */
export async function listarDecisiones(
  ctx: ContextoServicio,
  f?: { decisorId?: string; estado?: EstadoDecision },
): Promise<DecisionVista[]> {
  const inst = await cargarInstantanea(ctx.db);
  return inst.decisiones
    .filter((d) => (!f?.decisorId || d.decisorId === f.decisorId) && (!f?.estado || d.estado === f.estado))
    .sort(
      (a, b) =>
        Number(b.estado === 'pendiente') - Number(a.estado === 'pendiente') ||
        b.creadaEn.getTime() - a.creadaEn.getTime() ||
        (a.id < b.id ? 1 : -1),
    )
    .map((d) => aVista(inst, d));
}

export async function obtenerDecision(ctx: ContextoServicio, id: string): Promise<DecisionVista | null> {
  const inst = await cargarInstantanea(ctx.db);
  const d = inst.decisiones.find((x) => x.id === id);
  return d ? aVista(inst, d) : null;
}

function comprobarDecisor(inst: Instantanea, id: string, personaId: string): void {
  const d = inst.decisiones.find((x) => x.id === id);
  if (!d) throw new ErrorDominio(`No existe la decisión ${id}.`);
  if (d.estado !== 'pendiente') throw new ErrorDominio(`La decisión ${id} ya está ${d.estado}.`);
  if (d.decisorId !== personaId) {
    const nombre = inst.personas.find((p) => p.id === d.decisorId)?.nombre ?? d.decisorId;
    throw new ErrorDominio(`Solo ${nombre} puede decidir ${id}.`);
  }
}

const avisados = (efectos: Efecto[]) => [
  ...new Set(efectos.flatMap((e) => (e.tipo === 'accion' && e.aviso && e.accion.destinatarioId ? [e.accion.destinatarioId] : []))),
];

/** Lanza ErrorDominio si la persona no es el decisor o la decisión no está pendiente. */
export async function aprobarDecision(
  ctx: ContextoServicio,
  id: string,
  letra: LetraOpcion,
  personaId: string,
): Promise<{ trabajosCreados: string[]; avisosA: string[] }> {
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    comprobarDecisor(inst, id, personaId);
    const efectos = motor.aplicarDecision(inst, id, letra, personaId);
    await persistirEfectos(tx, efectos);
    return {
      trabajosCreados: efectos.flatMap((e) => (e.tipo === 'crear_trabajo' ? [e.trabajo.id] : [])),
      avisosA: avisados(efectos),
    };
  });
}

/** Avisa a quien la propuso con el motivo; no ejecuta nada más. */
export async function rechazarDecision(
  ctx: ContextoServicio,
  id: string,
  personaId: string,
  motivo: string,
): Promise<{ avisosA: string[] }> {
  const limpio = motivo.trim();
  if (limpio === '') throw new ErrorDominio('Escribe el motivo del rechazo.');
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    comprobarDecisor(inst, id, personaId);
    const efectos = motor.rechazarDecision(inst, id, personaId, limpio);
    await persistirEfectos(tx, efectos);
    return { avisosA: avisados(efectos) };
  });
}
