// Seguimiento y escalamiento: R1, R2, R3 (§4.2 reglas 2–3 de docs/05). Puro: instantánea → efectos. Tarea 3.1.
//
// Modelo: un seguimiento guarda el ÚLTIMO nivel hecho (`nivel`) y cuándo toca el siguiente (`proximoEn`).
//   nivel 0 = solicitud de estado (R1, o el aviso de asignación de un urgente creado por captura)
//   nivel 1 = recordatorio al responsable (R2)
//   nivel 2 = escalamiento a su jefe directo (R3)
//   nivel 3 = escalamiento al jefe del jefe (R3, «una vez más como máximo») → `agotado`
// Cada nivel se programa desde el anterior PROGRAMADO (no desde la hora del tick), así que saltar el reloj
// produce los mismos niveles y el mismo estado final que avanzar paso a paso. Cuando ya no queda nivel
// posible (sin jefe, o tras el nivel 3) el seguimiento pasa a `agotado` en ese mismo paso.
import { HORAS_LABORALES_NORMAL, MIN_URGENTE } from '@/dominio/constantes';
import { formatearFecha } from '@/dominio/formato';
import { sumarHorasLaborales, sumarMinutos } from '@/dominio/tiempo';
import { ErrorDominio, type NivelSeguimiento, type Seguimiento, type TipoAccion, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { cadenaDependientes, dependientesDirectos, porId, siguienteIdSeguimiento, type Instantanea } from '@/motor/instantanea';

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Instante del siguiente nivel: urgente 30 min; normal 4 horas laborales. */
function siguienteNivelEn(desde: Date, urgente: boolean): Date {
  return urgente ? sumarMinutos(desde, MIN_URGENTE) : sumarHorasLaborales(desde, HORAS_LABORALES_NORMAL);
}

const intervaloTexto = (urgente: boolean) => (urgente ? `${MIN_URGENTE} minutos` : `${HORAS_LABORALES_NORMAL} horas laborales`);

function nombre(inst: Instantanea, personaId: string | null): string {
  if (!personaId) return '';
  return inst.personas.find((p) => p.id === personaId)?.nombre ?? personaId;
}

function jefeDe(inst: Instantanea, personaId: string | null): string | null {
  if (!personaId) return null;
  return inst.personas.find((p) => p.id === personaId)?.jefeId ?? null;
}

/** Qué bloquea un trabajo: los trabajos bloqueados por él y sus dependientes directos, con sus cadenas; sin resueltos. */
function queBloquea(inst: Instantanea, t: Trabajo): string[] {
  const trabajos = porId(inst.trabajos);
  const directos = [
    ...inst.trabajos.filter((x) => x.bloqueadoPorId === t.id).map((x) => x.id),
    ...dependientesDirectos(inst, t.id),
  ];
  const vistos = new Set<string>([t.id]);
  const res: string[] = [];
  for (const d of directos) {
    for (const id of [d, ...cadenaDependientes(inst, d)]) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      if (trabajos.get(id)?.estado !== 'resuelto') res.push(id);
    }
  }
  return res;
}

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
): Efecto {
  return {
    tipo: 'accion',
    accion: { en: inst.ahora, tipo, motivo, hechoOrigen, trabajoIds: [t.id], decisionId: null, destinatarioId, capturaId: null },
    aviso: { personaId: destinatarioId, en: inst.ahora, titulo, cuerpo, trabajoIds: [t.id] },
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
  };
  const plazo = formatearFecha(t.plazo);
  return [
    { tipo: 'crear_seguimiento', seguimiento },
    efectoAccion(
      inst,
      'pedir_estado',
      t.responsableId,
      t,
      `Venció el plazo de ${t.id} (${plazo}) y no está resuelto: se pide el estado a ${nombre(inst, t.responsableId)} (R1).`,
      `Plazo vencido de ${t.id} · ${plazo}`,
      `¿Cómo va ${t.id}?`,
      `Venció el plazo de «${t.titulo}» (${t.id}) el ${plazo}. Cuéntale a Nexo cómo va: responde o cambia el estado.`,
    ),
  ];
}

/** Pasa un seguimiento pendiente vencido al nivel siguiente (o lo agota si no queda a quién escalar). */
function avanzar(inst: Instantanea, s: Seguimiento, t: Trabajo): Efecto[] {
  const programado = s.proximoEn;
  const proximoEn = siguienteNivelEn(programado, s.urgente);
  const responsable = t.responsableId;
  const jefe = jefeDe(inst, responsable);
  const jefe2 = jefeDe(inst, jefe);
  const actualizar = (cambios: Partial<Seguimiento>): Efecto => ({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios });
  const desde = desdeTexto(s, t);
  const hecho = `Sin respuesta sobre ${t.id} desde ${desde}`;

  if (s.nivel === 0) {
    const siguiente = jefe ? { estado: 'pendiente' as const, proximoEn } : { estado: 'agotado' as const };
    return [
      actualizar({ nivel: 1, destinatarioId: responsable, ...siguiente }),
      efectoAccion(
        inst,
        'recordatorio',
        responsable,
        t,
        `${t.id} sigue sin respuesta ${intervaloTexto(s.urgente)} después de pedir el estado: recordatorio a ${nombre(inst, responsable)} (R2).`,
        hecho,
        `Recordatorio: ${t.id} sigue sin respuesta`,
        `«${t.titulo}» (${t.id}) sigue sin respuesta desde ${desde}. Plazo: ${formatearFecha(t.plazo)}. Responde o cambia el estado para cerrar el seguimiento.`,
      ),
    ];
  }

  const nivelNuevo = (s.nivel + 1) as NivelSeguimiento;
  const destinatario = s.nivel === 1 ? jefe : s.nivel === 2 ? jefe2 : null;
  if (!destinatario) return [actualizar({ estado: 'agotado' })];

  const queda = nivelNuevo === 2 && jefe2 ? { estado: 'pendiente' as const, proximoEn } : { estado: 'agotado' as const };
  const solicitante = t.solicitadoPorId ? `Lo pidió ${nombre(inst, t.solicitadoPorId)}. ` : '';
  const bloquea = queBloquea(inst, t);
  const bloqueaTexto = bloquea.length > 0 ? `Bloquea: ${bloquea.join(', ')}. ` : 'No bloquea otros trabajos. ';
  const previo = nivelNuevo === 3 ? ` Ya se escaló a ${nombre(inst, jefe)} sin respuesta.` : '';
  return [
    actualizar({ nivel: nivelNuevo, destinatarioId: destinatario, ...queda }),
    efectoAccion(
      inst,
      'escalamiento',
      destinatario,
      t,
      `${t.id} de ${nombre(inst, responsable)} sigue sin respuesta tras el ${nivelNuevo === 2 ? 'recordatorio' : 'primer escalamiento'}: escalamiento ${nivelNuevo - 1} a ${nombre(inst, destinatario)} (R3).`,
      hecho,
      `${t.id} sin respuesta de ${nombre(inst, responsable)}`,
      `«${t.titulo}» (${t.id}), a cargo de ${nombre(inst, responsable)}, sigue sin respuesta desde ${desde}. ${solicitante}${bloqueaTexto}Plazo: ${formatearFecha(t.plazo)}.${previo}`,
    ),
  ];
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

type Pendiente = { en: Date; trabajo: Trabajo; seguimiento: Seguimiento | null };

/**
 * Todo lo que el seguimiento tiene programado, en orden (instante, trabajo, solicitud antes que nivel):
 *  - R1: trabajo no resuelto sin seguimiento para su plazo actual y sin otro seguimiento pendiente → en = plazo;
 *  - nivel siguiente de cada seguimiento pendiente de un trabajo no resuelto → en = proximoEn.
 */
function agenda(inst: Instantanea): Pendiente[] {
  const trabajos = porId(inst.trabajos);
  const res: Pendiente[] = [];
  const conPendiente = new Set(inst.seguimientos.filter((s) => s.estado === 'pendiente').map((s) => s.trabajoId));
  for (const t of inst.trabajos) {
    if (t.estado === 'resuelto' || conPendiente.has(t.id)) continue;
    const yaPedido = inst.seguimientos.some((s) => s.trabajoId === t.id && s.plazoReferencia.getTime() === t.plazo.getTime());
    if (!yaPedido) res.push({ en: t.plazo, trabajo: t, seguimiento: null });
  }
  for (const s of inst.seguimientos) {
    const t = trabajos.get(s.trabajoId);
    if (s.estado === 'pendiente' && t && t.estado !== 'resuelto') res.push({ en: s.proximoEn, trabajo: t, seguimiento: s });
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
 * sobre la instantánea ya actualizada no produce nada. Cierra (`respondido`) los seguimientos pendientes de
 * trabajos ya resueltos o cuyo plazo se movió al futuro. Las acciones llevan `en` = inst.ahora (cuándo actuó Nexo).
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
      t.plazo.getTime() > inst.ahora.getTime() &&
      s.plazoReferencia.getTime() !== t.plazo.getTime() &&
      s.plazoReferencia.getTime() !== t.creadoEn.getTime();
    if (t.estado === 'resuelto' || plazoMovido) {
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
  if (!t) throw new ErrorDominio(`No existe el trabajo ${trabajoId} para iniciar su seguimiento.`);
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
  };
  return [{ tipo: 'crear_seguimiento', seguimiento }];
}

/**
 * Respuesta de `personaId` sobre `trabajoId`: cierra (`respondido`) los seguimientos pendientes del trabajo si la
 * persona es el responsable o alguien de la cadena a quien ya se escaló, y registra el evento `respuesta_seguimiento`
 * (actor = la persona). Devuelve [] si no hay seguimiento pendiente o la persona no es de la cadena.
 */
export function registrarRespuesta(inst: Instantanea, trabajoId: string, personaId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) return [];
  const jefe = jefeDe(inst, t.responsableId);
  const jefe2 = jefeDe(inst, jefe);
  const efectos: Efecto[] = [];
  for (const s of inst.seguimientos) {
    if (s.trabajoId !== trabajoId || s.estado !== 'pendiente') continue;
    const cadena = [t.responsableId, s.nivel >= 2 ? jefe : null, s.nivel >= 3 ? jefe2 : null];
    if (!cadena.includes(personaId)) continue;
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
