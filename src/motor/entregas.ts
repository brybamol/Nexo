// Entrega y resolución con evidencia (docs/08 reglas 19–20). Puro. Tarea R4.
//
// «Resuelto» necesita evidencia. Si otra persona pidió el trabajo, su responsable no lo resuelve: lo declara ENTREGADO
// (campo `entrega`, no un estado) y quien lo pidió confirma que lo recibió (→ Resuelto) o rechaza la entrega. Quien lo
// pidió puede resolverlo directamente. Sin solicitante (o pedido a sí mismo), el responsable lo resuelve con una nota.
// La falta de confirmación de recibido no escala: aviso (nivel 0) y recordatorio (nivel 1, lo hace el tick), y nada más.
//
// También viven aquí, porque los comparte motor/actualizacion.ts, la agrupación de avisos por persona (R5) y la
// resolución de un trabajo con su liberación (regla 5 de docs/05 §4.2).
import { HORAS_LABORALES_NORMAL, MAX_CITA_EVIDENCIA, MIN_URGENTE } from '@/dominio/constantes';
import { formatearFecha } from '@/dominio/formato';
import { sumarHorasLaborales, sumarMinutos } from '@/dominio/tiempo';
import {
  ErrorDominio,
  type Entrega,
  type FuenteEvidencia,
  type Seguimiento,
  type TipoEvidencia,
  type Trabajo,
} from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { dependientesDirectos, nombrador, porId, siguienteIdSeguimiento, type Instantanea } from '@/motor/instantanea';

/** Mensaje de regla 19 cuando falta la evidencia (botón sin nota ni enlace). */
export const SIN_EVIDENCIA = 'Escribe qué entregaste o pega el enlace.';

// ─── Utilidades compartidas ───────────────────────────────────────────────────

const nombreDe = (inst: Instantanea, personaId: string | null): string =>
  personaId ? (inst.personas.find((p) => p.id === personaId)?.nombre ?? personaId) : '';

/** Intervalo de R2 (urgente 30 min; normal 4 horas laborales). Igual que siguienteNivelEn de motor/seguimiento.ts. */
const intervaloDesde = (desde: Date, urgente: boolean): Date =>
  urgente ? sumarMinutos(desde, MIN_URGENTE) : sumarHorasLaborales(desde, HORAS_LABORALES_NORMAL);

const limpio = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
};

/** Cita de una evidencia: como mucho MAX_CITA_EVIDENCIA caracteres. */
export const recortarCita = (s: string): string =>
  s.length <= MAX_CITA_EVIDENCIA ? s : `${s.slice(0, MAX_CITA_EVIDENCIA - 1)}…`;
const recortar = recortarCita;

/** ¿Tiene el trabajo un solicitante distinto de su responsable? */
const conOtroSolicitante = (t: Trabajo): t is Trabajo & { solicitadoPorId: string } =>
  t.solicitadoPorId !== null && t.solicitadoPorId !== t.responsableId;

function buscar(inst: Instantanea, trabajoId: string): Trabajo {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) throw new ErrorDominio('Ese trabajo no existe.');
  return t;
}

function exigirNoResuelto(inst: Instantanea, t: Trabajo): void {
  if (t.estado === 'resuelto') throw new ErrorDominio(`${nombrador(inst).cita(t.id)} ya está resuelto.`);
}

function evidencia(
  t: Trabajo,
  tipo: TipoEvidencia,
  fuente: FuenteEvidencia,
  autorId: string,
  en: Date,
  cita: string,
): Efecto {
  return {
    tipo: 'agregar_evidencia',
    evidencia: { trabajoId: t.id, tipo, fuente, compromisoClave: null, mensajeId: null, buzones: [], enlaces: {}, autorId, en, cita: recortar(cita) },
  };
}

/**
 * R5: todo lo que un mismo hecho le cambia a una persona va en un solo aviso. Excluye al autor. Regla 15: un propuesto
 * no recibe ni genera avisos (`silencio` = el trabajo del hecho es propuesto; `propuestos` = líneas sobre propuestos).
 */
export class AvisosPorPersona {
  private readonly porPersona = new Map<string, { trabajoIds: string[]; lineas: string[]; titulo: string | null }>();
  private readonly propuestos: ReadonlySet<string>;

  constructor(
    private readonly autorId: string,
    inst?: Instantanea,
    private readonly silencio = false,
  ) {
    this.propuestos = new Set((inst?.trabajos ?? []).filter((t) => t.confirmacion === 'propuesto').map((t) => t.id));
  }

  /** `titulo`: el del aviso de esa persona si esta es su primera línea con título propio. */
  agregar(personaId: string, trabajoIds: string[], linea: string, titulo?: string): void {
    if (personaId === this.autorId || this.silencio) return;
    if (trabajoIds.some((id) => this.propuestos.has(id))) return;
    let g = this.porPersona.get(personaId);
    if (!g) {
      g = { trabajoIds: [], lineas: [], titulo: null };
      this.porPersona.set(personaId, g);
    }
    for (const id of trabajoIds) if (!g.trabajoIds.includes(id)) g.trabajoIds.push(id);
    if (!g.lineas.includes(linea)) g.lineas.push(linea);
    if (titulo && !g.titulo) g.titulo = titulo;
  }

  entradas() {
    return [...this.porPersona.entries()];
  }

  /** Una acción `aviso` por persona, con su aviso. `titulo` = el de quien no tiene uno propio. */
  efectos(en: Date, hechoOrigen: string, titulo: string): Efecto[] {
    return this.entradas().map(([personaId, g]) => {
      const cuerpo = g.lineas.join(' ');
      return {
        tipo: 'accion',
        accion: { en, tipo: 'aviso', motivo: cuerpo, hechoOrigen, trabajoIds: g.trabajoIds, decisionId: null, destinatarioId: personaId, capturaId: null },
        aviso: { personaId, en, titulo: g.titulo ?? titulo, cuerpo, trabajoIds: g.trabajoIds },
      };
    });
  }
}

/** Regla 5: X pasó a resuelto o salió de bloqueado → avisar a los responsables de sus dependientes directos. */
export function avisarLiberacion(inst: Instantanea, t: Trabajo, como: string, avisos: AvisosPorPersona): void {
  const trabajos = porId(inst.trabajos);
  const { cita } = nombrador(inst);
  for (const depId of dependientesDirectos(inst, t.id)) {
    const d = trabajos.get(depId);
    if (!d || d.estado === 'resuelto') continue;
    avisos.agregar(d.responsableId, [d.id], `${cita(t.id)} ${como}: ${cita(d.id)} puede avanzar.`);
  }
}

/**
 * Resolver X (docs/05 §4.2 reglas 3 y 5): estado resuelto con `resueltoEn = ahora`, aviso a sus dependientes, los
 * bloqueados por X vuelven a en curso (con su necesidad del repuesto de X atendida) y se cierran los seguimientos
 * pendientes de X que `previos` no haya cerrado ya. Devuelve los efectos, los trabajos tocados (sin X) y los textos.
 */
export function efectosResolver(
  inst: Instantanea,
  x: Trabajo,
  autorId: string,
  avisos: AvisosPorPersona,
  previos: Efecto[] = [],
): { efectos: Efecto[]; tocados: string[]; textos: string[] } {
  const { cita } = nombrador(inst);
  const efectos: Efecto[] = [];
  const tocados: string[] = [];
  const textos: string[] = [];
  const saleDeBloqueo = x.estado === 'bloqueado';
  efectos.push({
    tipo: 'actualizar_trabajo',
    trabajoId: x.id,
    cambios: {
      estado: 'resuelto',
      resueltoEn: inst.ahora,
      ...(saleDeBloqueo ? { bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null } : {}),
    },
    actorId: autorId,
  });
  textos.push(`${cita(x.id)} pasó a resuelto`);
  avisarLiberacion(inst, x, 'quedó resuelto', avisos);

  for (const t of inst.trabajos) {
    if (t.bloqueadoPorId !== x.id || t.estado !== 'bloqueado') continue;
    efectos.push({
      tipo: 'actualizar_trabajo',
      trabajoId: t.id,
      cambios: { estado: 'en_curso', bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null },
      actorId: autorId,
    });
    avisos.agregar(t.responsableId, [t.id], `${cita(x.id)} quedó resuelto: ${cita(t.id)} ya no está bloqueado.`);
    for (const n of inst.necesidades) {
      if (x.repuestoId && n.trabajoId === t.id && n.repuestoId === x.repuestoId && !n.atendida) {
        efectos.push({ tipo: 'actualizar_necesidad', trabajoId: t.id, repuestoId: n.repuestoId, cambios: { atendida: true } });
      }
    }
    if (!tocados.includes(t.id)) tocados.push(t.id);
    textos.push(`${cita(t.id)} vuelve a en curso`);
    avisarLiberacion(inst, t, 'ya no está bloqueado', avisos);
  }

  const despues = aplicarEnMemoria(inst, [...previos, ...efectos]);
  for (const s of despues.seguimientos) {
    if (s.trabajoId === x.id && s.estado === 'pendiente') {
      efectos.push({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } });
    }
  }
  return { efectos, tocados, textos };
}

// ─── Regla 19 ─────────────────────────────────────────────────────────────────

/** Regla 19: quien lo pidió resuelve; el responsable con otro solicitante entrega; el que se lo pidió a sí mismo (o sin
 * solicitante) resuelve con nota; nadie más puede. */
export function modoResolucion(t: Trabajo, personaId: string): 'resolver' | 'entregar' | 'prohibido' {
  if (conOtroSolicitante(t)) {
    if (personaId === t.solicitadoPorId) return 'resolver';
    if (personaId === t.responsableId) return 'entregar';
    return 'prohibido';
  }
  return personaId === t.responsableId ? 'resolver' : 'prohibido';
}

/** «Solo … puede darlo por resuelto» (regla 19), con nombres. Empieza en mayúscula y sin punto final. */
export function quienPuedeResolver(inst: Instantanea, t: Trabajo): string {
  const responsable = nombreDe(inst, t.responsableId);
  if (conOtroSolicitante(t)) {
    return `Solo ${nombreDe(inst, t.solicitadoPorId)}, que lo pidió, puede darlo por resuelto; ${responsable}, su responsable, puede declararlo entregado`;
  }
  return `Solo ${responsable}, su responsable, puede darlo por resuelto`;
}

/**
 * Por qué `personaId` no puede declarar entregado X (null si puede). No mira la nota. Regla 19: solo el responsable con
 * otro solicitante, sobre un trabajo no resuelto, sin entrega pendiente y no bloqueado por otro sin resolver.
 */
export function impedimentoEntrega(inst: Instantanea, x: Trabajo, personaId: string): string | null {
  const { cita } = nombrador(inst);
  if (x.estado === 'resuelto') return `${cita(x.id)} ya está resuelto.`;
  if (!conOtroSolicitante(x)) {
    return `Como nadie más lo pidió, ${nombreDe(inst, x.responsableId)} da por resuelto ${cita(x.id)} con una nota: no hay entrega que confirmar.`;
  }
  if (personaId === x.solicitadoPorId) {
    return `${nombreDe(inst, personaId)} lo pidió: puede darlo por resuelto directamente; solo ${nombreDe(inst, x.responsableId)}, su responsable, puede declararlo entregado.`;
  }
  if (personaId !== x.responsableId) return `Solo ${nombreDe(inst, x.responsableId)}, su responsable, puede declararlo entregado.`;
  if (x.entrega) {
    return `${cita(x.id)} ya está entregado: falta que ${nombreDe(inst, x.solicitadoPorId)} confirme que lo recibió.`;
  }
  const bloqueante = x.estado === 'bloqueado' && x.bloqueadoPorId ? inst.trabajos.find((t) => t.id === x.bloqueadoPorId) : undefined;
  if (bloqueante && bloqueante.estado !== 'resuelto') {
    return `${cita(x.id)} está bloqueado por ${cita(bloqueante.id)}: no puede declararse entregado.`;
  }
  return null;
}

// ─── Regla 20: entrega ────────────────────────────────────────────────────────

/**
 * Núcleo de la entrega, ya validada: efectos sin avisos (la línea al solicitante va a `avisos`, con su título).
 * Lo usan efectosEntrega y efectosActualizacion (captura del responsable).
 */
export function nucleoEntrega(
  inst: Instantanea,
  x: Trabajo & { solicitadoPorId: string },
  personaId: string,
  e: { nota: string | null; enlace: string | null; fuente: FuenteEvidencia },
  avisos: AvisosPorPersona,
): Efecto[] {
  const ahora = inst.ahora;
  const { cita } = nombrador(inst);
  const responsable = nombreDe(inst, personaId);
  const solicitante = nombreDe(inst, x.solicitadoPorId);
  const entrega: Entrega = { en: ahora, porId: personaId, nota: e.nota, enlace: e.enlace, fuente: e.fuente };
  const efectos: Efecto[] = [
    { tipo: 'actualizar_trabajo', trabajoId: x.id, cambios: { entrega }, actorId: personaId },
    evidencia(x, 'entrega', e.fuente, personaId, ahora, e.nota ?? e.enlace ?? ''),
  ];

  // Cuenta como respuesta: cierra los seguimientos de estado pendientes (R1–R3).
  for (const s of inst.seguimientos) {
    if (s.trabajoId !== x.id || s.estado !== 'pendiente' || s.tipo !== 'estado') continue;
    efectos.push(
      { tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } },
      {
        tipo: 'evento',
        evento: {
          en: ahora,
          actorId: personaId,
          tipo: 'respuesta_seguimiento',
          trabajoId: x.id,
          decisionId: null,
          datos: { seguimientoId: s.id, nivel: s.nivel, via: 'entrega' },
        },
      },
    );
  }

  const detalle = [e.nota ? `«${e.nota}»` : null, e.enlace ? `enlace: ${e.enlace}` : null].filter(Boolean).join(' · ');
  efectos.push(
    {
      tipo: 'accion',
      accion: {
        en: ahora,
        tipo: 'registrar_entrega',
        motivo: `${responsable} declaró entregado ${cita(x.id)}${detalle ? ` (${detalle})` : ''}: falta que ${solicitante}, que lo pidió, confirme que lo recibió (regla 20).`,
        hechoOrigen: `${responsable} entregó ${cita(x.id)}`,
        trabajoIds: [x.id],
        decisionId: null,
        destinatarioId: null,
        capturaId: null,
      },
      aviso: null,
    },
    {
      tipo: 'evento',
      evento: {
        en: ahora,
        actorId: personaId,
        tipo: 'entrega_registrada',
        trabajoId: x.id,
        decisionId: null,
        datos: { fuente: e.fuente, nota: e.nota, enlace: e.enlace },
      },
    },
  );

  // Confirmado: aviso al solicitante (nivel 0) y seguimiento de recepción. Propuesto: lo ve su dueño, sin aviso.
  if (x.confirmacion === 'confirmado') {
    avisos.agregar(
      x.solicitadoPorId,
      [x.id],
      `${responsable} entregó ${cita(x.id)}${detalle ? `: ${detalle}` : ''}. ¿Lo recibiste? Confírmalo en Nexo o, si no está bien, rechaza la entrega con el motivo.`,
      `${responsable} entregó «${x.titulo}». ¿Lo recibiste?`,
    );
    const seguimiento: Seguimiento = {
      id: siguienteIdSeguimiento(aplicarEnMemoria(inst, efectos)),
      trabajoId: x.id,
      plazoReferencia: ahora,
      nivel: 0,
      destinatarioId: x.solicitadoPorId,
      urgente: x.urgente,
      proximoEn: intervaloDesde(ahora, x.urgente),
      estado: 'pendiente',
      iniciadoEn: ahora,
      escaladosA: [],
      tipo: 'recepcion',
    };
    efectos.push({ tipo: 'crear_seguimiento', seguimiento });
  }
  return efectos;
}

/** Regla 20: declarar la entrega (pone `entrega`, evidencia `entrega`, cierra seguimientos de estado, aviso y
 * seguimiento `recepcion` si está confirmado). ErrorDominio sin nota ni enlace o si está bloqueado por otro. */
export function efectosEntrega(
  inst: Instantanea,
  trabajoId: string,
  personaId: string,
  e: { nota: string | null; enlace: string | null; fuente: Entrega['fuente'] },
): Efecto[] {
  const x = buscar(inst, trabajoId);
  const impedimento = impedimentoEntrega(inst, x, personaId);
  if (impedimento) throw new ErrorDominio(impedimento);
  const nota = limpio(e.nota);
  const enlace = limpio(e.enlace);
  if (!nota && !enlace) throw new ErrorDominio(SIN_EVIDENCIA);
  if (!conOtroSolicitante(x)) throw new ErrorDominio(SIN_EVIDENCIA); // inalcanzable: lo descarta impedimentoEntrega

  const avisos = new AvisosPorPersona(personaId, inst);
  const efectos = nucleoEntrega(inst, x, personaId, { nota, enlace, fuente: e.fuente }, avisos);
  const quien = nombreDe(inst, personaId);
  return [...efectos, ...avisos.efectos(inst.ahora, `${quien} entregó ${nombrador(inst).cita(x.id)}`, `${quien} entregó «${x.titulo}»`)];
}

// ─── Regla 20: recepción ──────────────────────────────────────────────────────

/**
 * Núcleo de la recepción, ya validada: resolución (regla 5), evidencia `recepcion`, acción `confirmar_recepcion`,
 * evento `recepcion_confirmada` y la línea de aviso al responsable (en `avisos`).
 */
export function nucleoRecepcion(
  inst: Instantanea,
  x: Trabajo,
  personaId: string,
  cita: string,
  fuente: FuenteEvidencia,
  avisos: AvisosPorPersona,
  previos: Efecto[] = [],
): { efectos: Efecto[]; tocados: string[]; textos: string[] } {
  const ahora = inst.ahora;
  const citar = nombrador(inst).cita;
  const solicitante = nombreDe(inst, personaId);
  const texto = limpio(cita) ?? `${solicitante} confirmó que lo recibió.`;
  // La línea al responsable va primero: es lo principal de este hecho para él.
  avisos.agregar(x.responsableId, [x.id], `${solicitante} confirmó que recibió ${citar(x.id)}: quedó resuelto.`, `${solicitante} confirmó que recibió «${x.titulo}»`);
  const r = efectosResolver(inst, x, personaId, avisos, previos);
  const efectos: Efecto[] = [
    ...r.efectos,
    evidencia(x, 'recepcion', fuente, personaId, ahora, texto),
    {
      tipo: 'accion',
      accion: {
        en: ahora,
        tipo: 'confirmar_recepcion',
        motivo: `${solicitante}, que lo pidió, confirmó que recibió ${citar(x.id)}: queda resuelto (regla 20).`,
        hechoOrigen: `${solicitante} confirmó que recibió ${citar(x.id)}`,
        trabajoIds: [x.id, ...r.tocados],
        decisionId: null,
        destinatarioId: null,
        capturaId: null,
      },
      aviso: null,
    },
    { tipo: 'evento', evento: { en: ahora, actorId: personaId, tipo: 'recepcion_confirmada', trabajoId: x.id, decisionId: null, datos: { fuente } } },
  ];
  return { efectos, tocados: r.tocados, textos: r.textos };
}

/** Regla 20: el solicitante confirma que lo recibió → Resuelto, liberación (regla 5), aviso al responsable.
 * Regla 19: quien lo pidió lo resuelve con o sin entrega previa. */
export function efectosRecepcion(inst: Instantanea, trabajoId: string, personaId: string, cita: string, fuente: Entrega['fuente']): Efecto[] {
  const x = buscar(inst, trabajoId);
  exigirNoResuelto(inst, x);
  if (!conOtroSolicitante(x) || personaId !== x.solicitadoPorId) {
    throw new ErrorDominio(
      conOtroSolicitante(x)
        ? `Solo ${nombreDe(inst, x.solicitadoPorId)}, que lo pidió, puede confirmar que recibió ${nombrador(inst).cita(x.id)}.`
        : `Nadie más pidió ${nombrador(inst).cita(x.id)}: no hay recepción que confirmar.`,
    );
  }
  const avisos = new AvisosPorPersona(personaId, inst, x.confirmacion !== 'confirmado');
  const r = nucleoRecepcion(inst, x, personaId, cita, fuente, avisos);
  const quien = nombreDe(inst, personaId);
  return [
    ...r.efectos,
    ...avisos.efectos(inst.ahora, `${quien} confirmó que recibió ${nombrador(inst).cita(x.id)}`, `${quien} confirmó que recibió «${x.titulo}»`),
  ];
}

// ─── Regla 20: rechazo ────────────────────────────────────────────────────────

/** Regla 20: el solicitante rechaza la entrega (motivo obligatorio) → `entrega = null`, nota, aviso, evento. */
export function efectosRechazoEntrega(inst: Instantanea, trabajoId: string, personaId: string, motivo: string): Efecto[] {
  const x = buscar(inst, trabajoId);
  const { cita } = nombrador(inst);
  exigirNoResuelto(inst, x);
  if (!x.entrega) throw new ErrorDominio(`${cita(x.id)} no tiene una entrega por confirmar.`);
  if (!conOtroSolicitante(x) || personaId !== x.solicitadoPorId) {
    throw new ErrorDominio(`Solo ${nombreDe(inst, x.solicitadoPorId ?? x.responsableId)}, que lo pidió, puede rechazar la entrega de ${cita(x.id)}.`);
  }
  const porQue = limpio(motivo);
  if (!porQue) throw new ErrorDominio('Escribe por qué la entrega no está bien.');

  const ahora = inst.ahora;
  const solicitante = nombreDe(inst, personaId);
  const confirmado = x.confirmacion === 'confirmado';
  const efectos: Efecto[] = [
    { tipo: 'actualizar_trabajo', trabajoId: x.id, cambios: { entrega: null }, actorId: personaId },
    { tipo: 'agregar_nota', trabajoId: x.id, autorId: personaId, texto: `Entrega rechazada: ${porQue}` },
  ];
  for (const s of inst.seguimientos) {
    if (s.trabajoId === x.id && s.estado === 'pendiente' && s.tipo === 'recepcion') {
      efectos.push({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } });
    }
  }

  // R1 vuelve a aplicar con el plazo: si ya venció, se pide el estado ahora (el aviso es la solicitud); si no, R1 lo
  // pedirá al vencer. Un propuesto no tiene seguimiento de estado (regla 15).
  const vencido = ahora.getTime() >= x.plazo.getTime();
  const conPendiente = aplicarEnMemoria(inst, efectos).seguimientos.some(
    (s) => s.trabajoId === x.id && s.estado === 'pendiente' && s.tipo === 'estado',
  );
  const pideEstado = confirmado && vencido && !conPendiente;
  if (pideEstado) {
    efectos.push({
      tipo: 'crear_seguimiento',
      seguimiento: {
        id: siguienteIdSeguimiento(aplicarEnMemoria(inst, efectos)),
        trabajoId: x.id,
        plazoReferencia: x.plazo,
        nivel: 0,
        destinatarioId: x.responsableId,
        urgente: x.urgente,
        proximoEn: intervaloDesde(ahora, x.urgente),
        estado: 'pendiente',
        iniciadoEn: ahora,
        escaladosA: [],
        tipo: 'estado',
      },
    });
  }

  const hechoOrigen = `${solicitante} rechazó la entrega de ${cita(x.id)}: «${porQue}»`;
  efectos.push(
    {
      tipo: 'accion',
      accion: {
        en: ahora,
        tipo: 'rechazar_entrega',
        motivo: `${solicitante}, que lo pidió, no dio por recibido ${cita(x.id)}: «${porQue}». Vuelve a ${nombreDe(inst, x.responsableId)} (regla 20).`,
        hechoOrigen,
        trabajoIds: [x.id],
        decisionId: null,
        destinatarioId: null,
        capturaId: null,
      },
      aviso: null,
    },
    { tipo: 'evento', evento: { en: ahora, actorId: personaId, tipo: 'entrega_rechazada', trabajoId: x.id, decisionId: null, datos: { motivo: porQue } } },
  );

  const avisos = new AvisosPorPersona(personaId, inst, !confirmado);
  const plazo = vencido
    ? `Su plazo venció el ${formatearFecha(x.plazo)}: cuéntale a Nexo cómo va.`
    : `Sigue a tu cargo; plazo: ${formatearFecha(x.plazo)}.`;
  avisos.agregar(
    x.responsableId,
    [x.id],
    `${solicitante} no dio por recibido ${cita(x.id)}: «${porQue}». ${plazo}`,
    `${solicitante} rechazó la entrega de «${x.titulo}»`,
  );
  return [...efectos, ...avisos.efectos(ahora, hechoOrigen, `${solicitante} rechazó la entrega de «${x.titulo}»`)];
}
