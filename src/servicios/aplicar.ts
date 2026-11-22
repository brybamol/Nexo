// Convierte un plan validado en efectos (motor) y los persiste. Tarea 2.3.
import { eq } from 'drizzle-orm';
import { capturas, type Db } from '@/db/esquema';
import { persistirEfectos } from '@/db/instantanea';
import { formatearFecha } from '@/dominio/formato';
import { minusculaInicial } from '@/dominio/texto';
import {
  ErrorDominio,
  type Plan,
  type PlanDecision,
  type PlanTrabajoNuevo,
  type Trabajo,
} from '@/dominio/tipos';
import { efectosActualizacion } from '@/motor/actualizacion';
import { efectosDecisionNueva } from '@/motor/decision';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { impedimentoEntrega, modoResolucion, quienPuedeResolver } from '@/motor/entregas';
import { nombrador, porId, siguienteIdTrabajo, siguienteNumeroTrabajo, type Instantanea } from '@/motor/instantanea';
import { efectosBloqueo } from '@/motor/propagacion';
import { efectosRevision } from '@/motor/propuestas';
import { iniciarSeguimientoUrgente, registrarRespuesta } from '@/motor/seguimiento';

export interface ResultadoAplicacion {
  resumen: string;
  trabajosCreados: string[];
  trabajosActualizados: string[];
  decisionId: string | null;
  avisosA: string[];
}

const unicos = (xs: string[]) => [...new Set(xs)];

async function textoDeCaptura(db: Db, capturaId: number): Promise<string | null> {
  const [fila] = await db.select({ texto: capturas.texto }).from(capturas).where(eq(capturas.id, capturaId));
  return fila?.texto ?? null;
}

/** El hecho que originó las acciones: quién lo dijo y con qué palabras. */
async function hechoDeCaptura(db: Db, inst: Instantanea, autorId: string, capturaId: number): Promise<string> {
  const autor = inst.personas.find((p) => p.id === autorId)?.nombre ?? autorId;
  const texto = await textoDeCaptura(db, capturaId);
  return texto !== null ? `${autor} escribió: «${texto}»` : `Captura de ${autor}`;
}

/**
 * Regla 14a de docs/08: el autor escribió como trabajo nuevo una propuesta de Nexo de la que es parte (lo decidió
 * validarInterpretacion). La propuesta queda confirmada por él, con su revisión `confirmada` (regla 16: avisos,
 * seguimiento de recepción si tiene entrega). Si la otra parte (no el dueño) es quien escribe, se revisa en su nombre:
 * para el motor, el revisor pasa a ser el dueño solo en memoria (en la base el dueño no cambia).
 */
function efectosConfirmarPorCaptura(inst: Instantanea, trabajoId: string, autorId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t || t.confirmacion !== 'propuesto') return [];
  if (![t.duenoPropuestaId, t.solicitadoPorId, t.responsableId].includes(autorId)) return [];
  const comoDueno: Instantanea = {
    ...inst,
    trabajos: inst.trabajos.map((x) => (x.id === trabajoId ? { ...x, duenoPropuestaId: autorId } : x)),
  };
  return efectosRevision(comoDueno, trabajoId, autorId, { tipo: 'confirmar' });
}

/** Regla 19 en el resumen de una captura que pidió pasar a resuelto: entregado o por qué no cambió de estado. */
function resumenRegla19(inst: Instantanea, trabajoId: string, autorId: string, efectos: Efecto[]): string {
  const x = inst.trabajos.find((t) => t.id === trabajoId);
  if (!x) return '';
  const { cita } = nombrador(inst);
  const sobreX = efectos.flatMap((e) => (e.tipo === 'actualizar_trabajo' && e.trabajoId === trabajoId ? [e.cambios] : []));
  if (sobreX.some((c) => c.estado === 'resuelto')) return '';
  if (sobreX.some((c) => c.entrega)) {
    const solicitante = inst.personas.find((p) => p.id === x.solicitadoPorId)?.nombre ?? 'quien lo pidió';
    return `${cita(x.id)} quedó entregado: falta que ${solicitante} confirme que lo recibió.`;
  }
  const modo = modoResolucion(x, autorId);
  const porQue = modo === 'prohibido' ? `${quienPuedeResolver(inst, x)}.` : modo === 'entregar' ? impedimentoEntrega(inst, x, autorId) : null;
  return porQue ? `${cita(x.id)} no cambió de estado: ${minusculaInicial(porQue)}` : '';
}

function efectosTrabajoNuevo(inst: Instantanea, plan: PlanTrabajoNuevo, autorId: string, capturaId: number, hecho: string): Efecto[] {
  const personas = porId(inst.personas);
  const trabajos = porId(inst.trabajos);
  const autor = personas.get(autorId)?.nombre ?? autorId;
  const responsable = personas.get(plan.responsableId)?.nombre ?? plan.responsableId;
  const proyecto = inst.proyectos.find((p) => p.id === plan.proyectoId)?.nombre ?? plan.proyectoId;
  const repuesto = plan.repuestoFaltanteId ? inst.repuestos.find((r) => r.id === plan.repuestoFaltanteId) ?? null : null;
  const id = siguienteIdTrabajo(inst);
  // Número dentro del proyecto: se calcula con la instantánea leída tras tomarTurnoEscritura, en la misma transacción
  // que inserta el trabajo, así que dos capturas a la vez no reciben el mismo (y la base tiene UNIQUE por si acaso).
  const numero = siguienteNumeroTrabajo(inst, plan.proyectoId);

  // Cantidad del repuesto a conseguir: lo que necesitan los trabajos que bloquea (mínimo 1).
  const cantidad = repuesto
    ? Math.max(
        1,
        inst.necesidades
          .filter((n) => n.repuestoId === repuesto.id && !n.atendida && plan.bloquea.includes(n.trabajoId))
          .reduce((s, n) => s + n.cantidad, 0),
      )
    : null;

  const trabajo: Trabajo = {
    id,
    proyectoId: plan.proyectoId,
    numero,
    titulo: plan.titulo,
    responsableId: plan.responsableId,
    solicitadoPorId: autorId,
    plazo: plan.plazo,
    estado: 'abierto',
    urgente: plan.urgente,
    conCostoProbable: plan.conCostoProbable,
    bloqueadoPorId: null,
    motivoBloqueo: null,
    fechaSolucion: null,
    repuestoId: repuesto?.id ?? null,
    cantidadRepuesto: cantidad,
    etiqueta: null,
    relacionados: plan.relacionados,
    origen: 'captura',
    capturaId,
    decisionId: null,
    creadoEn: inst.ahora,
    resueltoEn: null,
    confirmacion: 'confirmado',
    duenoPropuestaId: null,
    confirmadoPorId: null,
    entrega: null,
  };

  const efectos: Efecto[] = [{ tipo: 'crear_trabajo', trabajo, necesidades: [], actorId: autorId }];
  const nombres = nombrador(aplicarEnMemoria(inst, efectos));
  const extras: string[] = [];
  if (plan.urgente) extras.push('Urgente.');
  if (plan.conCostoProbable) extras.push('Con costo probable.');
  if (plan.bloquea.length > 0) extras.push(`Bloquea ${nombres.citas(plan.bloquea)}.`);
  if (plan.relacionados.length > 0) extras.push(`Relacionado con ${nombres.citas(plan.relacionados)}.`);
  const detalle = `${nombres.cita(id)} en ${proyecto}, responsable ${responsable}, plazo ${formatearFecha(plan.plazo)}.`;

  efectos.push({
    tipo: 'accion',
    accion: {
      en: inst.ahora,
      tipo: 'crear_trabajo',
      motivo: `${autor} lo reportó: ${detalle}${extras.length > 0 ? ` ${extras.join(' ')}` : ''}`,
      hechoOrigen: hecho,
      trabajoIds: [id, ...plan.bloquea],
      decisionId: null,
      destinatarioId: null,
      capturaId,
    },
    aviso: null,
  });

  // Aviso de asignación (para un trabajo urgente cuenta como la solicitud de estado: §4.2 regla 2).
  if (plan.responsableId !== autorId) {
    const cuerpo = `${autor} pidió ${detalle}${extras.length > 0 ? ` ${extras.join(' ')}` : ''}`;
    efectos.push({
      tipo: 'accion',
      accion: {
        en: inst.ahora,
        tipo: 'aviso',
        motivo: `Nuevo trabajo asignado a ${responsable}: ${nombres.cita(id)}.`,
        hechoOrigen: hecho,
        trabajoIds: [id],
        decisionId: null,
        destinatarioId: plan.responsableId,
        capturaId,
      },
      aviso: { personaId: plan.responsableId, en: inst.ahora, titulo: `Nuevo trabajo: ${plan.titulo}`, cuerpo, trabajoIds: [id] },
    });
  }

  // Bloqueos: la propagación (R4, R5) es de motor/propagacion.ts; aquí se garantiza el hecho mínimo.
  for (const bloqueadoId of plan.bloquea) {
    const actual = aplicarEnMemoria(inst, efectos);
    efectos.push(
      ...efectosBloqueo(actual, {
        trabajoBloqueadoId: bloqueadoId,
        bloqueanteId: id,
        motivo: repuesto ? `Falta ${minusculaInicial(repuesto.nombre)}` : plan.titulo,
        repuestoFaltanteId: repuesto?.id ?? null,
        autorId,
        descripcion: hecho,
      }),
    );
    const t = aplicarEnMemoria(inst, efectos).trabajos.find((x) => x.id === bloqueadoId);
    if (t && (t.estado !== 'bloqueado' || t.bloqueadoPorId !== id)) {
      const original = trabajos.get(bloqueadoId);
      efectos.push({
        tipo: 'actualizar_trabajo',
        trabajoId: bloqueadoId,
        cambios: {
          estado: 'bloqueado',
          bloqueadoPorId: id,
          motivoBloqueo: repuesto ? `Falta ${minusculaInicial(repuesto.nombre)}` : plan.titulo,
          ...(original?.fechaSolucion ? { fechaSolucion: null } : {}),
        },
        actorId: autorId,
      });
    }
  }
  if (repuesto) {
    const r = aplicarEnMemoria(inst, efectos).repuestos.find((x) => x.id === repuesto.id);
    if (r && !r.faltanteReportadoEn) {
      efectos.push({
        tipo: 'actualizar_repuesto',
        repuestoId: repuesto.id,
        cambios: { faltanteReportadoEn: inst.ahora, faltanteReportadoPor: autorId },
        actorId: autorId,
      });
    }
  }

  // Un trabajo urgente creado por captura abre su seguimiento al crearse (§4.2 regla 2; motor/seguimiento.ts).
  if (plan.urgente) efectos.push(...iniciarSeguimientoUrgente(aplicarEnMemoria(inst, efectos), id));
  return efectos;
}

function efectosDecision(inst: Instantanea, plan: PlanDecision, autorId: string, capturaId: number): Efecto[] {
  const efectos = efectosDecisionNueva(inst, plan.propuesta, autorId, plan.proyectoId, capturaId);
  if (!efectos.some((e) => e.tipo === 'crear_decision')) {
    throw new ErrorDominio('Entendí que es una decisión de compra, pero todavía no puedo prepararla. No creé nada.');
  }
  // Una decisión relacionada con un trabajo responde a su seguimiento (§4.2 regla 3).
  if (plan.trabajoRelacionadoId) efectos.push(...registrarRespuesta(aplicarEnMemoria(inst, efectos), plan.trabajoRelacionadoId, autorId));
  return efectos;
}

function resumir(
  inst: Instantanea,
  plan: Plan,
  efectos: Efecto[],
  creados: string[],
  actualizados: string[],
  decisionId: string | null,
  autorId: string,
): string {
  const personas = porId(inst.personas);
  const nombres = nombrador(aplicarEnMemoria(inst, efectos)); // incluye los trabajos y la decisión recién creados
  switch (plan.tipo) {
    case 'trabajo_nuevo': {
      const responsable = personas.get(plan.responsableId)?.nombre ?? plan.responsableId;
      const bloqueados = efectos.flatMap((e) =>
        e.tipo === 'actualizar_trabajo' && e.cambios.estado === 'bloqueado' ? [e.trabajoId] : [],
      );
      const partes = [
        `Creé ${nombres.citas(creados)} para ${responsable}, plazo ${formatearFecha(plan.plazo)}${plan.urgente ? ', urgente' : ''}.`,
      ];
      const bloq = unicos(bloqueados);
      if (bloq.length > 0) partes.push(`${nombres.citas(bloq)} ${bloq.length === 1 ? 'queda bloqueado' : 'quedan bloqueados'}.`);
      return partes.join(' ');
    }
    case 'actualizacion': {
      const x = inst.trabajos.find((t) => t.id === plan.trabajoId);
      const bloqueante = x?.estado === 'bloqueado' && x.bloqueadoPorId ? inst.trabajos.find((t) => t.id === x.bloqueadoPorId) : undefined;
      const cambioEstado = efectos.some((e) => e.tipo === 'actualizar_trabajo' && e.trabajoId === plan.trabajoId && e.cambios.estado);
      const sigue =
        plan.nuevoEstado && plan.nuevoEstado !== 'resuelto' && bloqueante && bloqueante.estado !== 'resuelto' && !cambioEstado
          ? ` ${nombres.cita(plan.trabajoId)} sigue bloqueado por ${nombres.cita(bloqueante.id)}: no cambié su estado.`
          : '';
      const hecho = actualizados.length > 0 ? `Actualicé ${nombres.citas(actualizados)}.` : '';
      const regla19 = plan.nuevoEstado === 'resuelto' ? resumenRegla19(inst, plan.trabajoId, autorId, efectos) : '';
      return `${hecho}${sigue}${regla19 ? ` ${regla19}` : ''}`.trim() || `Registré tu respuesta sobre ${nombres.cita(plan.trabajoId)}.`;
    }
    case 'decision':
      return decisionId ? `Preparé la decisión ${nombres.citaDecision(decisionId)}: ${plan.resumen}` : plan.resumen;
    case 'duplicado': {
      const confirmo = efectos.some((e) => e.tipo === 'registrar_revision');
      return confirmo
        ? `Ya existe ${nombres.cita(plan.trabajoId)}: era una propuesta de Nexo y quedó confirmada. No creé nada.`
        : `Ya existe ${nombres.cita(plan.trabajoId)}. No creé nada.`;
    }
    case 'no_es_trabajo':
      return plan.motivo;
    case 'pregunta':
      return plan.pregunta;
  }
}

/** Llamar dentro de la transacción del servicio, con la instantánea recién cargada en ella. */
export async function aplicarPlan(
  db: Db,
  inst: Instantanea,
  plan: Plan,
  autorId: string,
  capturaId: number,
): Promise<ResultadoAplicacion> {
  let efectos: Efecto[];
  switch (plan.tipo) {
    case 'trabajo_nuevo':
      efectos = efectosTrabajoNuevo(inst, plan, autorId, capturaId, await hechoDeCaptura(db, inst, autorId, capturaId));
      break;
    case 'actualizacion':
      // Regla 19 de docs/08: el texto de la captura es la evidencia. Si el autor no puede darlo por resuelto, no hay
      // error: se aplica lo demás sin el cambio de estado y el motivo de la acción y el resumen lo dicen.
      efectos = efectosActualizacion(inst, plan, autorId, { texto: (await textoDeCaptura(db, capturaId)) ?? '', fuente: 'captura' });
      break;
    case 'decision':
      efectos = efectosDecision(inst, plan, autorId, capturaId);
      break;
    case 'duplicado':
      efectos = efectosConfirmarPorCaptura(inst, plan.trabajoId, autorId); // regla 14a; [] si no es una propuesta
      break;
    default:
      efectos = []; // no_es_trabajo y pregunta no cambian nada
  }

  // Toda acción producida por esta captura queda ligada a ella (R10).
  efectos = efectos.map((e) =>
    e.tipo === 'accion' && e.accion.capturaId === null ? { ...e, accion: { ...e.accion, capturaId } } : e,
  );

  await persistirEfectos(db, efectos);

  const trabajosCreados = unicos(efectos.flatMap((e) => (e.tipo === 'crear_trabajo' ? [e.trabajo.id] : [])));
  const trabajosActualizados = unicos(
    efectos.flatMap((e) => (e.tipo === 'actualizar_trabajo' || e.tipo === 'agregar_nota' ? [e.trabajoId] : [])),
  ).filter((id) => !trabajosCreados.includes(id));
  const decisionId = efectos.find((e) => e.tipo === 'crear_decision')?.decision.id ?? null;
  const avisosA = unicos(efectos.flatMap((e) => (e.tipo === 'accion' && e.aviso && e.accion.destinatarioId ? [e.accion.destinatarioId] : [])));

  return {
    resumen: resumir(inst, plan, efectos, trabajosCreados, trabajosActualizados, decisionId, autorId),
    trabajosCreados,
    trabajosActualizados,
    decisionId,
    avisosA,
  };
}
