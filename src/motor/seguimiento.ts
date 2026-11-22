// Seguimiento y escalamiento: R1, R2, R3 (§4.2 reglas 2–3 de docs/05). Puro: instantánea → efectos. Tarea 3.1;
// camino del escalamiento según la reforma de escalamiento (motor/escalamiento.ts).
//
// Modelo: un seguimiento guarda el ÚLTIMO nivel hecho (`nivel`), cuándo toca el siguiente (`proximoEn`) y a quiénes
// ya se escaló (`escaladosA`).
//   nivel 0 = solicitud de estado (R1, o el aviso de asignación de un urgente creado por captura)
//   nivel 1 = recordatorio al responsable (R2)
//   nivel 2 = escalamiento 1: al responsable del proyecto (o, si es el mismo responsable, directo al paso 2)
//   nivel 3 = escalamiento 2: a los perjudicados de otros proyectos o, sin ellos, al responsable de la operación
// El jefe directo (`jefeId`) ya no interviene. Cada nivel se programa desde el anterior PROGRAMADO (no desde la hora
// del tick), así que saltar el reloj produce los mismos niveles y el mismo estado final que avanzar paso a paso.
// Cuando ya no queda nadie a quien escalar, el seguimiento pasa a `agotado` en ese mismo paso.
//
// Reformas v2 (docs/08 reglas 15, 20 y 21; tarea R3): cada seguimiento tiene un `tipo`.
//   'estado'    R1–R3 de siempre. R1 omite los propuestos y los entregados; el camino del escalamiento se calcula
//               sobre la vista general (sin propuestos: un propuesto no hace perjudicado a nadie).
//   'propuesta' propuesta sin revisar (lo abre motor/propuestas.ts): al vencer, un recordatorio al dueño y `agotado`.
//   'recepcion' «¿lo recibiste?» (lo abre motor/entregas.ts): nivel 0 = el aviso; al vencer, un recordatorio al
//               solicitante y `agotado`. Ninguno de los dos escala ni avisa a terceros.
import { HORAS_LABORALES_NORMAL, HORAS_REVISION_PROPUESTA, MIN_URGENTE } from '@/dominio/constantes';
import { formatearFecha } from '@/dominio/formato';
import { enumerar } from '@/dominio/nombres';
import { sumarHorasLaborales, sumarMinutos } from '@/dominio/tiempo';
import { ErrorDominio, type NivelSeguimiento, type Seguimiento, type TipoAccion, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { pasosEscalamiento, queBloquea, type Destino } from '@/motor/escalamiento';
import { instantaneaVisible, nombrador, porId, siguienteIdSeguimiento, type Instantanea } from '@/motor/instantanea';

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Instante del siguiente nivel: urgente 30 min; normal 4 horas laborales. */
export function siguienteNivelEn(desde: Date, urgente: boolean): Date {
  return urgente ? sumarMinutos(desde, MIN_URGENTE) : sumarHorasLaborales(desde, HORAS_LABORALES_NORMAL);
}

const intervaloTexto = (urgente: boolean) => (urgente ? `${MIN_URGENTE} minutos` : `${HORAS_LABORALES_NORMAL} horas laborales`);

function nombre(inst: Instantanea, personaId: string | null): string {
  if (!personaId) return '';
  return inst.personas.find((p) => p.id === personaId)?.nombre ?? personaId;
}

/** Lo que el dueño del resultado puede hacer desde Nexo (regla 2 de la reforma). */
const PUEDE_ACTUAR = 'Desde Nexo puedes reasignarlo, mover el plazo o declararlo bloqueado.';

/** «desde cuándo»: un urgente creado por captura cuenta desde su creación; uno por R1, desde que venció. */
function desdeTexto(s: Seguimiento, t: Trabajo): string {
  const f = formatearFecha(s.plazoReferencia);
  return s.plazoReferencia.getTime() === t.plazo.getTime() ? `que venció su plazo (${f})` : `que se pidió (${f})`;
}

function efectoAccion(
  inst: Instantanea,
  tipo: TipoAccion,
  destinatarioId: string,
  t: Trabajo,
  motivo: string,
  hechoOrigen: string,
  titulo: string,
  cuerpo: string,
  trabajosAviso: string[] = [t.id],
): Efecto {
  return {
    tipo: 'accion',
    accion: { en: inst.ahora, tipo, motivo, hechoOrigen, trabajoIds: [t.id], decisionId: null, destinatarioId, capturaId: null },
    aviso: { personaId: destinatarioId, en: inst.ahora, titulo, cuerpo, trabajoIds: trabajosAviso },
  };
}

// ─── Pasos ────────────────────────────────────────────────────────────────────

/** R1: nivel 0 al vencer el plazo, con la acción `pedir_estado` al responsable. */
function solicitar(inst: Instantanea, t: Trabajo): Efecto[] {
  const seguimiento: Seguimiento = {
    id: siguienteIdSeguimiento(inst),
    trabajoId: t.id,
    plazoReferencia: t.plazo,
    nivel: 0,
    destinatarioId: t.responsableId,
    urgente: t.urgente,
    proximoEn: siguienteNivelEn(t.plazo, t.urgente),
    estado: 'pendiente',
    iniciadoEn: inst.ahora,
    escaladosA: [],
    tipo: 'estado',
  };
  const plazo = formatearFecha(t.plazo);
  const cita = nombrador(inst).cita(t.id);
  return [
    { tipo: 'crear_seguimiento', seguimiento },
    efectoAccion(
      inst,
      'pedir_estado',
      t.responsableId,
      t,
      `Venció el plazo de ${cita} el ${plazo} y no está resuelto: se pide el estado a ${nombre(inst, t.responsableId)}.`,
      `Plazo vencido de ${cita} · ${plazo}`,
      `¿Cómo va «${t.titulo}»?`,
      `Venció el plazo de ${cita} el ${plazo}. Cuéntale a Nexo cómo va: responde o cambia el estado.`,
    ),
  ];
}

/** Regla 15: la propuesta sigue sin revisar → un recordatorio a su dueño y el seguimiento se agota. Nunca escala. */
function recordarPropuesta(inst: Instantanea, s: Seguimiento, t: Trabajo): Efecto[] {
  if (s.nivel !== 0) return [{ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'agotado' } }];
  const cita = nombrador(inst).cita(t.id);
  const dueno = s.destinatarioId;
  return [
    { tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { nivel: 1, estado: 'agotado' } },
    efectoAccion(
      inst,
      'recordatorio',
      dueno,
      t,
      `${cita} sigue sin revisar ${HORAS_REVISION_PROPUESTA} horas laborales después de proponerse: recordatorio a ${nombre(inst, dueno)}, su dueño.`,
      `Propuesta sin revisar: ${cita} · desde ${formatearFecha(s.iniciadoEn)}`,
      `Tienes una propuesta de Nexo sin revisar: «${t.titulo}»`,
      `Nexo propuso ${cita} al leer tu correo y nadie lo ha revisado. Solo tú lo ves: confírmalo, corrígelo o descártalo.`,
    ),
  ];
}

/** Regla 20: la entrega sigue sin confirmar → un recordatorio a quien la pidió y el seguimiento se agota. No escala. */
function recordarRecepcion(inst: Instantanea, s: Seguimiento, t: Trabajo): Efecto[] {
  if (s.nivel !== 0) return [{ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'agotado' } }];
  const cita = nombrador(inst).cita(t.id);
  const solicitante = s.destinatarioId;
  const entrega = t.entrega;
  const quien = nombre(inst, entrega?.porId ?? t.responsableId);
  const cuando = entrega ? ` el ${formatearFecha(entrega.en)}` : '';
  return [
    { tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { nivel: 1, estado: 'agotado' } },
    efectoAccion(
      inst,
      'recordatorio',
      solicitante,
      t,
      `${quien} entregó ${cita} y ${nombre(inst, solicitante)} no ha confirmado que lo recibió ${intervaloTexto(s.urgente)} después: recordatorio.`,
      `Entrega sin confirmar: ${cita}${cuando}`,
      `¿Recibiste «${t.titulo}»?`,
      `${quien} entregó ${cita}${cuando}. Si ya lo recibiste, confírmalo en Nexo; si no está bien, dilo con el motivo.`,
    ),
  ];
}

/** Pasa un seguimiento pendiente vencido al nivel siguiente (o lo agota si no queda a quién escalar). */
function avanzar(inst: Instantanea, s: Seguimiento, t: Trabajo): Efecto[] {
  if (s.tipo === 'propuesta') return recordarPropuesta(inst, s, t);
  if (s.tipo === 'recepcion') return recordarRecepcion(inst, s, t);
  // El camino del escalamiento y «qué bloquea» se calculan sin propuestos (regla 15): un propuesto no hace
  // perjudicado a nadie ni se cita ante terceros.
  const general = instantaneaVisible(inst, null);
  const programado = s.proximoEn;
  const proximoEn = siguienteNivelEn(programado, s.urgente);
  const responsable = t.responsableId;
  const actualizar = (cambios: Partial<Seguimiento>): Efecto => ({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios });
  const desde = desdeTexto(s, t);
  const nombres = nombrador(inst);
  const cita = nombres.cita(t.id);
  const hecho = `Sin respuesta sobre ${cita} desde ${desde}`;
  const pasos = pasosEscalamiento(general, t, s);

  if (s.nivel === 0) {
    const siguiente = pasos.length > 0 ? { estado: 'pendiente' as const, proximoEn } : { estado: 'agotado' as const };
    return [
      actualizar({ nivel: 1, destinatarioId: responsable, ...siguiente }),
      efectoAccion(
        inst,
        'recordatorio',
        responsable,
        t,
        `${cita} sigue sin respuesta ${intervaloTexto(s.urgente)} después de pedir el estado: recordatorio a ${nombre(inst, responsable)}.`,
        hecho,
        `Recordatorio: «${t.titulo}» sigue sin respuesta`,
        `${cita} sigue sin respuesta desde ${desde}. Plazo: ${formatearFecha(t.plazo)}. Responde o cambia el estado para cerrar el seguimiento.`,
      ),
    ];
  }

  const nivelNuevo = (s.nivel + 1) as NivelSeguimiento;
  const paso = s.nivel <= 2 ? pasos[0] : undefined;
  if (!paso || paso.length === 0 || nivelNuevo > 3) return [actualizar({ estado: 'agotado' })];

  // Tras este paso, ¿queda otro? Solo si este era el del dueño del resultado y el nivel 3 aún cabe.
  const escaladosA = [...s.escaladosA, ...paso.map((d) => d.personaId)];
  const queda = nivelNuevo === 2 && pasos.length > 1 ? { estado: 'pendiente' as const, proximoEn } : { estado: 'agotado' as const };
  const solicitante = t.solicitadoPorId ? `Lo pidió ${nombre(inst, t.solicitadoPorId)}. ` : '';
  const bloquea = queBloquea(general, t);
  const bloqueaTexto = bloquea.length > 0 ? `Bloquea: ${nombres.citas(bloquea)}. ` : 'No bloquea otros trabajos. ';
  const previo = s.escaladosA.length > 0 ? ` Ya se escaló a ${enumerar(s.escaladosA.map((p) => nombre(inst, p)))} sin respuesta.` : '';
  const tras = s.nivel === 1 ? 'el recordatorio' : 'el primer escalamiento';
  const proyectoDe = (id: string | null) => inst.proyectos.find((p) => p.id === id)?.nombre ?? '';

  /** Por qué le llega a cada destino: en el motivo (registro) y en el aviso (qué puede hacer). */
  const porQue = (d: Destino): { motivo: string; aviso: string } => {
    switch (d.razon) {
      case 'proyecto':
        return {
          motivo: `responsable del proyecto «${proyectoDe(d.proyectoId)}», dueño del resultado`,
          aviso: `Te llega porque eres responsable del proyecto «${proyectoDe(d.proyectoId)}».`,
        };
      case 'perjudicado':
        return {
          motivo: `responsable de «${proyectoDe(d.proyectoId)}», que tiene ${nombres.citas(d.trabajoIds)} en riesgo o bloqueados por él`,
          aviso: `Te llega porque afecta a tu proyecto «${proyectoDe(d.proyectoId)}»: ${nombres.citas(d.trabajoIds)}.`,
        };
      case 'operacion':
        return {
          motivo: 'responsable de la operación (nadie de otro proyecto sale perjudicado)',
          aviso: 'Te llega porque eres responsable de la operación y nadie más puede destrabarlo.',
        };
    }
  };

  return [
    actualizar({ nivel: nivelNuevo, destinatarioId: paso[0]!.personaId, escaladosA, ...queda }),
    ...paso.map((d) => {
      const r = porQue(d);
      return efectoAccion(
        inst,
        'escalamiento',
        d.personaId,
        t,
        `${cita}, de ${nombre(inst, responsable)}, sigue sin respuesta tras ${tras}: escalamiento ${nivelNuevo - 1} a ${nombre(inst, d.personaId)}, ${r.motivo}.`,
        hecho,
        `«${t.titulo}» sin respuesta de ${nombre(inst, responsable)}`,
        `${cita}, a cargo de ${nombre(inst, responsable)}, sigue sin respuesta desde ${desde}. ${solicitante}${bloqueaTexto}Plazo: ${formatearFecha(t.plazo)}.${previo} ${r.aviso} ${PUEDE_ACTUAR}`,
        [t.id, ...d.trabajoIds],
      );
    }),
  ];
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

type Pendiente = { en: Date; trabajo: Trabajo; seguimiento: Seguimiento | null };

/** R1 (y sus niveles) solo para trabajos confirmados sin entrega: ni propuestos (regla 15) ni entregados (regla 21). */
const sigueEstado = (t: Trabajo) => t.confirmacion === 'confirmado' && t.entrega === null;

/** ¿Sigue teniendo sentido un seguimiento pendiente de este tipo para este trabajo (no resuelto)? */
function vigente(s: Seguimiento, t: Trabajo): boolean {
  switch (s.tipo) {
    case 'estado':
      return sigueEstado(t);
    case 'propuesta':
      return t.confirmacion === 'propuesto';
    case 'recepcion':
      return t.entrega !== null;
  }
}

/**
 * Todo lo que el seguimiento tiene programado, en orden (instante, trabajo, solicitud antes que nivel):
 *  - R1: trabajo confirmado, no resuelto ni entregado, sin seguimiento de estado para su plazo actual y sin otro de
 *    estado pendiente → en = plazo;
 *  - nivel siguiente de cada seguimiento pendiente y vigente de un trabajo no resuelto → en = proximoEn.
 */
function agenda(inst: Instantanea): Pendiente[] {
  const trabajos = porId(inst.trabajos);
  const res: Pendiente[] = [];
  const deEstado = inst.seguimientos.filter((s) => s.tipo === 'estado');
  const conPendiente = new Set(deEstado.filter((s) => s.estado === 'pendiente').map((s) => s.trabajoId));
  for (const t of inst.trabajos) {
    if (t.estado === 'resuelto' || !sigueEstado(t) || conPendiente.has(t.id)) continue;
    const yaPedido = deEstado.some((s) => s.trabajoId === t.id && s.plazoReferencia.getTime() === t.plazo.getTime());
    if (!yaPedido) res.push({ en: t.plazo, trabajo: t, seguimiento: null });
  }
  for (const s of inst.seguimientos) {
    const t = trabajos.get(s.trabajoId);
    if (s.estado === 'pendiente' && t && t.estado !== 'resuelto' && vigente(s, t)) res.push({ en: s.proximoEn, trabajo: t, seguimiento: s });
  }
  return res.sort(
    (a, b) =>
      a.en.getTime() - b.en.getTime() ||
      a.trabajo.id.localeCompare(b.trabajo.id) ||
      Number(a.seguimiento !== null) - Number(b.seguimiento !== null),
  );
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * R1, R2, R3 hasta inst.ahora, en orden cronológico de lo programado. Idempotente: repetir el tick a la misma hora
 * sobre la instantánea ya actualizada no produce nada. Cierra (`respondido`, sin evento) los seguimientos pendientes
 * de trabajos ya resueltos, los de estado cuyo plazo se movió al futuro o cuyo trabajo ya no sigue R1 (entregado o
 * propuesto), los de propuesta ya revisada y los de recepción sin entrega (rechazada). Las acciones llevan
 * `en` = inst.ahora (cuándo actuó Nexo).
 */
export function tick(inst: Instantanea): Efecto[] {
  const efectos: Efecto[] = [];
  let actual = inst;
  const emitir = (es: Efecto[]) => {
    efectos.push(...es);
    actual = aplicarEnMemoria(actual, es);
  };

  const trabajos = porId(inst.trabajos);
  for (const s of inst.seguimientos) {
    const t = trabajos.get(s.trabajoId);
    if (s.estado !== 'pendiente' || !t) continue;
    // Resuelto, o plazo movido al futuro por otra persona (un seguimiento de R1 ya no tiene motivo: el nuevo plazo
    // abrirá el suyo al vencer). El urgente de captura (referencia = creación del trabajo) no depende del plazo.
    const plazoMovido =
      s.tipo === 'estado' &&
      t.plazo.getTime() > inst.ahora.getTime() &&
      s.plazoReferencia.getTime() !== t.plazo.getTime() &&
      s.plazoReferencia.getTime() !== t.creadoEn.getTime();
    if (t.estado === 'resuelto' || plazoMovido || !vigente(s, t)) {
      emitir([{ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } }]);
    }
  }

  // Cada paso crea un seguimiento (como mucho uno por trabajo y plazo) o sube/cierra uno: termina.
  for (;;) {
    const p = agenda(actual).find((x) => x.en.getTime() <= inst.ahora.getTime());
    if (!p) break;
    emitir(p.seguimiento ? avanzar(actual, p.seguimiento, p.trabajo) : solicitar(actual, p.trabajo));
  }
  return efectos;
}

/** Menor instante futuro (> ahora) en que vence un plazo, toca un recordatorio o un escalamiento; null si nada. */
export function siguienteEvento(inst: Instantanea): Date | null {
  const despues = aplicarEnMemoria(inst, tick(inst));
  const p = agenda(despues).find((x) => x.en.getTime() > inst.ahora.getTime());
  return p ? p.en : null;
}

/**
 * Nivel 0 al crear un trabajo urgente por captura: `plazoReferencia` = `iniciadoEn` = creación, siguiente nivel a los
 * 30 min. Solo crea el seguimiento: el aviso de asignación (que emite la captura) cuenta como la solicitud.
 * `inst` ya debe contener el trabajo (p. ej. con aplicarEnMemoria). Devuelve [] si no es urgente, está resuelto o ya
 * tiene un seguimiento pendiente.
 */
export function iniciarSeguimientoUrgente(inst: Instantanea, trabajoId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) throw new ErrorDominio('No existe el trabajo para iniciar su seguimiento.');
  if (!t.urgente || t.estado === 'resuelto') return [];
  if (inst.seguimientos.some((s) => s.trabajoId === t.id && s.estado === 'pendiente')) return [];
  const seguimiento: Seguimiento = {
    id: siguienteIdSeguimiento(inst),
    trabajoId: t.id,
    plazoReferencia: t.creadoEn,
    nivel: 0,
    destinatarioId: t.responsableId,
    urgente: true,
    proximoEn: siguienteNivelEn(t.creadoEn, true),
    estado: 'pendiente',
    iniciadoEn: t.creadoEn,
    escaladosA: [],
    tipo: 'estado',
  };
  return [{ tipo: 'crear_seguimiento', seguimiento }];
}

/**
 * Respuesta de `personaId` sobre `trabajoId`: cierra (`respondido`) los seguimientos de ESTADO pendientes del trabajo
 * si la persona es el responsable o alguien a quien ya se escaló ese seguimiento (`escaladosA`), y registra el evento
 * `respuesta_seguimiento` (actor = la persona). Devuelve [] si no hay seguimiento pendiente o la persona no es del camino.
 * Los de propuesta los cierra la revisión (motor/propuestas.ts) y los de recepción, la recepción (motor/entregas.ts).
 */
export function registrarRespuesta(inst: Instantanea, trabajoId: string, personaId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) return [];
  const efectos: Efecto[] = [];
  for (const s of inst.seguimientos) {
    if (s.trabajoId !== trabajoId || s.estado !== 'pendiente' || s.tipo !== 'estado') continue;
    if (personaId !== t.responsableId && !s.escaladosA.includes(personaId)) continue;
    efectos.push(
      { tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } },
      {
        tipo: 'evento',
        evento: {
          en: inst.ahora,
          actorId: personaId,
          tipo: 'respuesta_seguimiento',
          trabajoId,
          decisionId: null,
          datos: { seguimientoId: s.id, nivel: s.nivel },
        },
      },
    );
  }
  return efectos;
}
