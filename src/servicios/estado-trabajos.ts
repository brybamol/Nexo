// Respuestas a seguimientos y cambios de estado desde la interfaz (sin pasar por la caja de captura). Tarea 3.4.
// Cada mutación: transacción → cargarInstantanea → motor → persistirEfectos (§4.4). La respuesta es la regla 3 de §4.2.
import { cargarInstantanea, persistirEfectos, tomarTurnoEscritura } from '@/db/instantanea';
import { ErrorDominio, type EstadoTrabajo, type PlanActualizacion } from '@/dominio/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import type { Efecto } from '@/motor/efectos';
import { efectosEntrega, efectosRechazoEntrega, efectosRecepcion } from '@/motor/entregas';
import { autorizadosParaActuar, type Razon } from '@/motor/escalamiento';
import { nombrador, visiblePara, type Instantanea } from '@/motor/instantanea';
import { efectosDeclararBloqueo, efectosMoverPlazo, efectosReasignar } from '@/motor/intervencion';
import { registrarRespuesta } from '@/motor/seguimiento';
import type { ContextoServicio } from '@/servicios/contexto';
import type { PersonaBreve } from '@/servicios/vistas';

const ESTADOS: readonly EstadoTrabajo[] = ['abierto', 'en_curso', 'bloqueado', 'resuelto'];

function comprobar(inst: Instantanea, trabajoId: string, personaId: string, estado?: EstadoTrabajo) {
  const trabajo = inst.trabajos.find((t) => t.id === trabajoId);
  if (!trabajo) throw new ErrorDominio('No existe ese trabajo.');
  const persona = inst.personas.find((p) => p.id === personaId);
  if (!persona) throw new ErrorDominio(`No existe la persona ${personaId}.`);
  // Regla 18 de docs/08: un propuesto solo lo ve (y solo lo toca) su dueño.
  if (!visiblePara(trabajo, personaId)) {
    const dueno = inst.personas.find((p) => p.id === trabajo.duenoPropuestaId)?.nombre ?? 'otra persona';
    throw new ErrorDominio(`Este trabajo todavía es una propuesta de Nexo para ${dueno}.`);
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) throw new ErrorDominio(`El estado «${estado}» no es válido.`);
  return { trabajo, persona };
}

function plan(trabajoId: string, estado: EstadoTrabajo | null, nota: string | null): PlanActualizacion {
  return { tipo: 'actualizacion', trabajoId, nuevoEstado: estado, nota, hayProblema: false, reprogramar: [], notasRelacionadas: [] };
}

/**
 * Una persona responde a un seguimiento de `trabajoId` desde la interfaz: cierra el seguimiento pendiente (regla 3),
 * registra la acción y, si se indica, cambia el estado y/o añade una nota. Error si no hay seguimiento pendiente o
 * la persona no es el responsable ni alguien a quien ya se escaló.
 */
export async function responderSeguimiento(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  r: { estado?: EstadoTrabajo; nota?: string },
): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    const { trabajo, persona } = comprobar(inst, trabajoId, personaId, r.estado);
    const nota = r.nota?.trim() || null;
    const estado = r.estado && r.estado !== trabajo.estado ? r.estado : null;

    if (!registrarRespuesta(inst, trabajoId, personaId).length) {
      throw new ErrorDominio(`No hay un seguimiento pendiente de ${nombrador(inst).cita(trabajoId)} que ${persona.nombre} pueda responder.`);
    }
    let efectos: Efecto[];
    if (estado || nota) {
      // Ya incluye la respuesta. Regla 19 de docs/08: la nota es la evidencia si pasa a resuelto.
      efectos = efectosActualizacion(inst, plan(trabajoId, estado, nota), personaId, { texto: nota ?? '', fuente: 'interfaz' });
    } else {
      efectos = [
        ...registrarRespuesta(inst, trabajoId, personaId),
        {
          tipo: 'accion',
          accion: {
            en: inst.ahora,
            tipo: 'actualizar_trabajo',
            motivo: `${persona.nombre} respondió al seguimiento de ${nombrador(inst).cita(trabajoId)}: se cierra el seguimiento.`,
            hechoOrigen: `${persona.nombre} respondió sobre ${nombrador(inst).cita(trabajo.id)}`,
            trabajoIds: [trabajoId],
            decisionId: null,
            destinatarioId: null,
            capturaId: null,
          },
          aviso: null,
        },
      ];
    }
    await persistirEfectos(tx, efectos);
  });
}

// ─── El dueño del resultado actúa (reforma de escalamiento, regla 2) ───────────
// La autorización la comprueba el motor (motor/intervencion.ts) dentro de la transacción: el servidor nunca confía en
// que la interfaz solo muestre los botones a quien puede usarlos.

/** `avisosA`: ids de las personas avisadas (la Server Action los convierte en nombres). */
export type ResultadoIntervencion = { avisosA: string[] };

const avisados = (efectos: Efecto[]): string[] => [
  ...new Set(efectos.flatMap((e) => (e.tipo === 'accion' && e.aviso && e.accion.destinatarioId ? [e.accion.destinatarioId] : []))),
];

async function intervenir(ctx: ContextoServicio, calcular: (inst: Instantanea) => Efecto[]): Promise<ResultadoIntervencion> {
  return ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const efectos = calcular(await cargarInstantanea(tx));
    await persistirEfectos(tx, efectos);
    return { avisosA: avisados(efectos) };
  });
}

/** (a) Reasigna el trabajo a otra persona. ErrorDominio si `autorId` no puede actuar sobre él. */
export function reasignarTrabajo(
  ctx: ContextoServicio,
  trabajoId: string,
  autorId: string,
  nuevoResponsableId: string,
  motivo = '',
): Promise<ResultadoIntervencion> {
  return intervenir(ctx, (inst) => efectosReasignar(inst, trabajoId, autorId, nuevoResponsableId, motivo));
}

/** (b) Mueve el plazo (futuro), con motivo obligatorio. */
export function moverPlazoTrabajo(ctx: ContextoServicio, trabajoId: string, autorId: string, plazo: Date, motivo: string): Promise<ResultadoIntervencion> {
  return intervenir(ctx, (inst) => efectosMoverPlazo(inst, trabajoId, autorId, plazo, motivo));
}

/** (c) Declara bloqueado el trabajo, con motivo obligatorio. */
export function declararBloqueoTrabajo(ctx: ContextoServicio, trabajoId: string, autorId: string, motivo: string): Promise<ResultadoIntervencion> {
  return intervenir(ctx, (inst) => efectosDeclararBloqueo(inst, trabajoId, autorId, motivo));
}

const RAZON_VISIBLE: Record<Razon, string> = {
  proyecto: 'responsable del proyecto',
  perjudicado: 'responsable de un proyecto afectado',
  escalado: 'persona a la que Nexo escaló el trabajo',
  operacion: 'responsable de la operación',
};

export interface PermisosActuar {
  /** Personas a las que se puede reasignar (todas; la interfaz quita al responsable actual). */
  personas: PersonaBreve[];
  ahora: Date;
  /** Solo los trabajos (de los pedidos) sobre los que la persona puede actuar, con por qué y sus datos actuales. */
  trabajos: Record<string, { razon: string; responsableId: string; plazo: Date }>;
}

/** Para la interfaz: sobre cuáles de `trabajoIds` puede actuar `personaId` (no resueltos). Solo lectura. */
export async function obtenerPermisosActuar(ctx: ContextoServicio, personaId: string, trabajoIds: string[]): Promise<PermisosActuar> {
  const inst = await cargarInstantanea(ctx.db);
  const trabajos: PermisosActuar['trabajos'] = {};
  for (const id of new Set(trabajoIds)) {
    const t = inst.trabajos.find((x) => x.id === id);
    if (!t || t.estado === 'resuelto') continue;
    const permiso = autorizadosParaActuar(inst, id).find((a) => a.personaId === personaId);
    if (permiso) trabajos[id] = { razon: RAZON_VISIBLE[permiso.razon], responsableId: t.responsableId, plazo: t.plazo };
  }
  return {
    personas: inst.personas.map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, area: p.area })),
    ahora: inst.ahora,
    trabajos,
  };
}

/**
 * Cambia el estado de un trabajo desde la interfaz. Aplica las mismas reglas que una actualización por captura:
 * responde al seguimiento si corresponde, resolver lo cierra y libera dependientes (§4.2 reglas 3 y 5). Sin cambio
 * real de estado no hace nada.
 * Reformas v2 (R6b): `evidencia` es la nota con la que se resuelve o se entrega (regla 19 de docs/08). Sin ella,
 * pasar a resuelto da ErrorDominio «Escribe qué entregaste o pega el enlace.»; el responsable con otro solicitante no
 * lo resuelve: lo declara entregado; quien no puede darlo por resuelto (ni un jefe) recibe ErrorDominio.
 */
export async function cambiarEstado(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  estado: EstadoTrabajo,
  evidencia?: string,
): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    const { trabajo } = comprobar(inst, trabajoId, personaId, estado);
    if (trabajo.estado === estado) return;
    await persistirEfectos(
      tx,
      efectosActualizacion(inst, plan(trabajoId, estado, null), personaId, { texto: evidencia ?? '', fuente: 'interfaz' }),
    );
  });
}

// ─── Entrega y recepción (docs/08 reglas 19–20, con motor/entregas.ts) ───────

async function mutar(ctx: ContextoServicio, trabajoId: string, personaId: string, calcular: (inst: Instantanea) => Efecto[]): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    comprobar(inst, trabajoId, personaId);
    await persistirEfectos(tx, calcular(inst));
  });
}

/** El responsable declara la entrega (nota o enlace). ErrorDominio «Escribe qué entregaste o pega el enlace». */
export async function declararEntrega(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  e: { nota?: string; enlace?: string },
): Promise<void> {
  await mutar(ctx, trabajoId, personaId, (inst) =>
    efectosEntrega(inst, trabajoId, personaId, { nota: e.nota ?? null, enlace: e.enlace ?? null, fuente: 'interfaz' }),
  );
}

/** Quien lo pidió confirma que lo recibió: queda Resuelto. */
export async function confirmarRecepcion(ctx: ContextoServicio, trabajoId: string, personaId: string, nota?: string): Promise<void> {
  await mutar(ctx, trabajoId, personaId, (inst) => efectosRecepcion(inst, trabajoId, personaId, nota ?? '', 'interfaz'));
}

/** Quien lo pidió rechaza la entrega (motivo obligatorio). */
export async function rechazarEntrega(ctx: ContextoServicio, trabajoId: string, personaId: string, motivo: string): Promise<void> {
  await mutar(ctx, trabajoId, personaId, (inst) => efectosRechazoEntrega(inst, trabajoId, personaId, motivo));
}
