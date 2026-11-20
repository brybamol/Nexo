// Respuestas a seguimientos y cambios de estado desde la interfaz (sin pasar por la caja de captura). Tarea 3.4.
// Cada mutación: transacción → cargarInstantanea → motor → persistirEfectos (§4.4). La respuesta es la regla 3 de §4.2.
import { cargarInstantanea, persistirEfectos, tomarTurnoEscritura } from '@/db/instantanea';
import { ErrorDominio, type EstadoTrabajo, type PlanActualizacion } from '@/dominio/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';
import { registrarRespuesta } from '@/motor/seguimiento';
import type { ContextoServicio } from '@/servicios/contexto';

const ESTADOS: readonly EstadoTrabajo[] = ['abierto', 'en_curso', 'bloqueado', 'resuelto'];

function comprobar(inst: Instantanea, trabajoId: string, personaId: string, estado?: EstadoTrabajo) {
  const trabajo = inst.trabajos.find((t) => t.id === trabajoId);
  if (!trabajo) throw new ErrorDominio(`No existe el trabajo ${trabajoId}.`);
  const persona = inst.personas.find((p) => p.id === personaId);
  if (!persona) throw new ErrorDominio(`No existe la persona ${personaId}.`);
  if (estado !== undefined && !ESTADOS.includes(estado)) throw new ErrorDominio(`El estado «${estado}» no es válido.`);
  return { trabajo, persona };
}

function plan(trabajoId: string, estado: EstadoTrabajo | null, nota: string | null): PlanActualizacion {
  return { tipo: 'actualizacion', trabajoId, nuevoEstado: estado, nota, hayProblema: false, reprogramar: [], notasRelacionadas: [] };
}

/**
 * Una persona responde a un seguimiento de `trabajoId` desde la interfaz: cierra el seguimiento pendiente (regla 3),
 * registra la acción y, si se indica, cambia el estado y/o añade una nota. Error si no hay seguimiento pendiente o
 * la persona no es el responsable ni un jefe al que ya se escaló.
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
      throw new ErrorDominio(`No hay un seguimiento pendiente de ${trabajoId} que ${persona.nombre} pueda responder.`);
    }
    let efectos: Efecto[];
    if (estado || nota) {
      efectos = efectosActualizacion(inst, plan(trabajoId, estado, nota), personaId); // ya incluye la respuesta
    } else {
      efectos = [
        ...registrarRespuesta(inst, trabajoId, personaId),
        {
          tipo: 'accion',
          accion: {
            en: inst.ahora,
            tipo: 'actualizar_trabajo',
            motivo: `${persona.nombre} respondió al seguimiento de ${trabajoId}: se cierra el seguimiento.`,
            hechoOrigen: `${persona.nombre} respondió sobre ${trabajoId} «${trabajo.titulo}»`,
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

/**
 * Cambia el estado de un trabajo desde la interfaz. Aplica las mismas reglas que una actualización por captura:
 * responde al seguimiento si corresponde, resolver lo cierra y libera dependientes (§4.2 reglas 3 y 5). Sin cambio
 * real de estado no hace nada.
 */
export async function cambiarEstado(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  estado: EstadoTrabajo,
): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    await tomarTurnoEscritura(tx);
    const inst = await cargarInstantanea(tx);
    const { trabajo } = comprobar(inst, trabajoId, personaId, estado);
    if (trabajo.estado === estado) return;
    await persistirEfectos(tx, efectosActualizacion(inst, plan(trabajoId, estado, null), personaId));
  });
}
