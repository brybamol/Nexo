// El dueño del resultado puede actuar, no solo enterarse (reforma de escalamiento, regla 2). Puro.
// Tres acciones sobre un trabajo no resuelto: reasignarlo, mover su plazo (con motivo) y declararlo bloqueado (con
// motivo). Solo las hacen el responsable del proyecto, las personas a las que ya se escaló el trabajo y el responsable
// de la operación (motor/escalamiento.ts): se comprueba aquí y, por tanto, en el servidor.
// Cada una: cambia el trabajo, cierra sus seguimientos abiertos (la persona que podía destrabarlo ya actuó) y, al
// reasignar un trabajo vencido, abre uno nuevo para el nuevo responsable; registra la acción con su motivo y el hecho
// (R10) y avisa, uno por persona (R5), al responsable anterior y al nuevo, a los dependientes cuyo riesgo cambia y a
// quienes tenían el escalamiento. Las acciones salen con capturaId = null.
import { formatearFecha } from '@/dominio/formato';
import { ErrorDominio, type Seguimiento, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import { autorizadosParaActuar, queBloquea, type Razon } from '@/motor/escalamiento';
import { nombrador, siguienteIdSeguimiento, type Instantanea } from '@/motor/instantanea';
import { calcularMarcas } from '@/motor/marcas';
import { explicarRiesgo } from '@/motor/propagacion';
import { siguienteNivelEn } from '@/motor/seguimiento';

const RAZON_TEXTO: Record<Razon, string> = {
  proyecto: 'responsable del proyecto',
  perjudicado: 'responsable de un proyecto perjudicado',
  escalado: 'a quien se escaló el trabajo',
  operacion: 'responsable de la operación',
};

type Via = 'reasignar' | 'mover_plazo' | 'declarar_bloqueo';

/** R5: lo que una misma acción le cambia a cada persona va en un solo aviso. Excluye al autor. */
class Avisos {
  private readonly grupos = new Map<string, { trabajoIds: string[]; lineas: string[] }>();
  constructor(private readonly autorId: string) {}
  agregar(personaId: string, trabajoIds: string[], linea: string): void {
    if (personaId === this.autorId) return;
    const g = this.grupos.get(personaId) ?? { trabajoIds: [], lineas: [] };
    for (const id of trabajoIds) if (!g.trabajoIds.includes(id)) g.trabajoIds.push(id);
    if (!g.lineas.includes(linea)) g.lineas.push(linea);
    this.grupos.set(personaId, g);
  }
  tiene(personaId: string): boolean {
    return this.grupos.has(personaId);
  }
  entradas() {
    return [...this.grupos.entries()];
  }
}

const nombreDe = (inst: Instantanea, id: string) => inst.personas.find((p) => p.id === id)?.nombre ?? id;

/** El trabajo, si existe, no está resuelto y `autorId` puede actuar sobre él; si no, ErrorDominio con el motivo. */
function comprobar(inst: Instantanea, trabajoId: string, autorId: string): { t: Trabajo; razon: Razon } {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) throw new ErrorDominio('No existe ese trabajo.');
  if (!inst.personas.some((p) => p.id === autorId)) throw new ErrorDominio(`No existe la persona ${autorId}.`);
  const cita = nombrador(inst).cita(t.id);
  if (t.estado === 'resuelto') throw new ErrorDominio(`${cita} ya está resuelto: no hay nada que destrabar.`);
  const permiso = autorizadosParaActuar(inst, t.id).find((a) => a.personaId === autorId);
  if (!permiso) {
    throw new ErrorDominio(
      `${nombreDe(inst, autorId)} no puede actuar sobre ${cita}: solo el responsable del proyecto, las personas a las que se escaló y el responsable de la operación.`,
    );
  }
  return { t, razon: permiso.razon };
}

function motivoObligatorio(motivo: string): string {
  const m = motivo.trim();
  if (!m) throw new ErrorDominio('Escribe el motivo: queda en el registro y se le cuenta a quien corresponde.');
  return m;
}

/** Cierra los seguimientos del trabajo que nadie había respondido (pendientes o agotados) y dice a quiénes se escalaron. */
function cerrarSeguimientos(inst: Instantanea, t: Trabajo, autorId: string, via: Via): { efectos: Efecto[]; escalados: string[]; cerrados: Seguimiento[] } {
  const efectos: Efecto[] = [];
  const escalados: string[] = [];
  const cerrados = inst.seguimientos.filter((s) => s.trabajoId === t.id && s.estado !== 'respondido');
  for (const s of cerrados) {
    efectos.push(
      { tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } },
      {
        tipo: 'evento',
        evento: { en: inst.ahora, actorId: autorId, tipo: 'respuesta_seguimiento', trabajoId: t.id, decisionId: null, datos: { seguimientoId: s.id, nivel: s.nivel, via } },
      },
    );
    for (const p of s.escaladosA) if (!escalados.includes(p)) escalados.push(p);
  }
  return { efectos, escalados, cerrados };
}

/**
 * Completa una intervención: líneas por cambio de riesgo (comparando marcas antes/después de `cambios`), aviso de
 * «ya actuó» a los escalados y al responsable del proyecto que no recibieron otra línea, la acción de registro y los
 * avisos agrupados.
 */
function terminar(
  inst: Instantanea,
  o: {
    t: Trabajo;
    autorId: string;
    cambios: Efecto[];
    avisos: Avisos;
    escalados: string[];
    hechoCorto: string;
    motivo: string;
    hecho: string;
    titulo: string;
  },
): Efecto[] {
  const nombres = nombrador(inst);
  const despues = aplicarEnMemoria(inst, o.cambios);
  const mAntes = calcularMarcas(inst);
  const mDespues = calcularMarcas(despues);
  for (const x of despues.trabajos) {
    if (x.id === o.t.id || x.estado === 'resuelto') continue;
    const antes = mAntes.get(x.id)?.enRiesgo ?? false;
    const ahora = mDespues.get(x.id)?.enRiesgo ?? false;
    if (!antes && ahora) {
      o.avisos.agregar(x.responsableId, [x.id], `${nombres.cita(x.id)} queda en riesgo: ${explicarRiesgo(mDespues.get(x.id)?.causas ?? [], despues)}.`);
    } else if (antes && !ahora) {
      o.avisos.agregar(x.responsableId, [x.id], `${nombres.cita(x.id)} ya no está en riesgo.`);
    }
  }
  const autor = nombreDe(inst, o.autorId);
  const responsableProyecto = inst.proyectos.find((p) => p.id === o.t.proyectoId)?.responsableId;
  for (const p of [...o.escalados, ...(responsableProyecto ? [responsableProyecto] : [])]) {
    if (!o.avisos.tiene(p)) o.avisos.agregar(p, [o.t.id], `${autor} ya actuó sobre ${nombres.cita(o.t.id)}: ${o.hechoCorto}. No hace falta que hagas nada más.`);
  }

  const efectos: Efecto[] = [
    ...o.cambios,
    {
      tipo: 'accion',
      accion: { en: inst.ahora, tipo: 'actualizar_trabajo', motivo: o.motivo, hechoOrigen: o.hecho, trabajoIds: [o.t.id], decisionId: null, destinatarioId: null, capturaId: null },
      aviso: null,
    },
  ];
  for (const [personaId, g] of o.avisos.entradas()) {
    const cuerpo = g.lineas.join(' ');
    efectos.push({
      tipo: 'accion',
      accion: { en: inst.ahora, tipo: 'aviso', motivo: cuerpo, hechoOrigen: o.hecho, trabajoIds: g.trabajoIds, decisionId: null, destinatarioId: personaId, capturaId: null },
      aviso: { personaId, en: inst.ahora, titulo: o.titulo, cuerpo, trabajoIds: g.trabajoIds },
    });
  }
  return efectos;
}

/** (a) Reasigna `trabajoId` a `nuevoResponsableId`. El motivo es opcional (si viene, queda en el registro y en los avisos). */
export function efectosReasignar(inst: Instantanea, trabajoId: string, autorId: string, nuevoResponsableId: string, motivo: string): Efecto[] {
  const { t, razon } = comprobar(inst, trabajoId, autorId);
  const nuevo = inst.personas.find((p) => p.id === nuevoResponsableId);
  if (!nuevo) throw new ErrorDominio('Elige a una persona de la empresa.');
  const nombres = nombrador(inst);
  const cita = nombres.cita(t.id);
  if (nuevo.id === t.responsableId) throw new ErrorDominio(`${nuevo.nombre} ya es responsable de ${cita}.`);
  const autor = nombreDe(inst, autorId);
  const anterior = nombreDe(inst, t.responsableId);
  const m = motivo.trim();
  const motivoTxt = m ? `: «${m}»` : '';

  const cierre = cerrarSeguimientos(inst, t, autorId, 'reasignar');
  const cambios: Efecto[] = [{ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { responsableId: nuevo.id }, actorId: autorId }, ...cierre.efectos];
  // Un trabajo ya vencido no volvería a pedir el estado (R1 ya lo pidió para ese plazo): el seguimiento sigue con el
  // nuevo responsable, y el aviso de asignación cuenta como la solicitud. Si aún no vence, R1 lo pedirá al vencer.
  const vencido = inst.ahora.getTime() >= t.plazo.getTime();
  if (vencido) {
    cambios.push({
      tipo: 'crear_seguimiento',
      seguimiento: {
        id: siguienteIdSeguimiento(inst),
        trabajoId: t.id,
        plazoReferencia: t.plazo,
        nivel: 0,
        destinatarioId: nuevo.id,
        urgente: t.urgente,
        proximoEn: siguienteNivelEn(inst.ahora, t.urgente),
        estado: 'pendiente',
        iniciadoEn: inst.ahora,
        escaladosA: [],
      },
    });
  }

  const avisos = new Avisos(autorId);
  const solicitante = t.solicitadoPorId ? ` Lo pidió ${nombreDe(inst, t.solicitadoPorId)}.` : '';
  const bloquea = queBloquea(inst, t);
  const bloqueaTxt = bloquea.length > 0 ? ` Bloquea: ${nombres.citas(bloquea)}.` : '';
  avisos.agregar(
    nuevo.id,
    [t.id],
    `${autor} te asignó ${cita}${motivoTxt}. Plazo: ${formatearFecha(t.plazo)}${vencido ? ' (vencido: cuéntale a Nexo cómo va)' : ''}.${solicitante}${bloqueaTxt}`,
  );
  avisos.agregar(t.responsableId, [t.id], `${autor} reasignó ${cita} a ${nuevo.nombre}${motivoTxt}. Ya no está a tu cargo.`);
  const seguimientoTxt = vencido
    ? ` Nexo sigue el trabajo con ${nuevo.nombre}.`
    : cierre.cerrados.length > 0
      ? ' Se cierra el seguimiento; Nexo pedirá el estado al vencer el plazo.'
      : '';
  return terminar(inst, {
    t,
    autorId,
    cambios,
    avisos,
    escalados: cierre.escalados,
    hechoCorto: `lo reasignó a ${nuevo.nombre}`,
    motivo: `${autor}, ${RAZON_TEXTO[razon]}, reasignó ${cita} de ${anterior} a ${nuevo.nombre}${m ? `: «${m}»` : ' (sin motivo escrito)'}.${seguimientoTxt}`,
    hecho: `${autor} reasignó ${cita} a ${nuevo.nombre}`,
    titulo: `${autor} reasignó «${t.titulo}»`,
  });
}

/** (b) Mueve el plazo de `trabajoId` a `plazo` (futuro), con motivo. Nexo pedirá el estado al vencer el nuevo plazo. */
export function efectosMoverPlazo(inst: Instantanea, trabajoId: string, autorId: string, plazo: Date, motivo: string): Efecto[] {
  const { t, razon } = comprobar(inst, trabajoId, autorId);
  const nombres = nombrador(inst);
  const cita = nombres.cita(t.id);
  if (Number.isNaN(plazo.getTime())) throw new ErrorDominio('La fecha del plazo no es válida.');
  if (plazo.getTime() <= inst.ahora.getTime()) throw new ErrorDominio(`El plazo nuevo debe ser posterior a ahora (${formatearFecha(inst.ahora)}).`);
  if (plazo.getTime() === t.plazo.getTime()) throw new ErrorDominio(`${cita} ya tiene ese plazo.`);
  const m = motivoObligatorio(motivo);
  const autor = nombreDe(inst, autorId);
  const de = formatearFecha(t.plazo);
  const a = formatearFecha(plazo);

  const cierre = cerrarSeguimientos(inst, t, autorId, 'mover_plazo');
  const cambios: Efecto[] = [{ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { plazo }, actorId: autorId }, ...cierre.efectos];
  const avisos = new Avisos(autorId);
  avisos.agregar(t.responsableId, [t.id], `${autor} movió el plazo de ${cita} de ${de} a ${a}. Motivo: ${m}`);
  return terminar(inst, {
    t,
    autorId,
    cambios,
    avisos,
    escalados: cierre.escalados,
    hechoCorto: `movió el plazo al ${a}`,
    motivo: `${autor}, ${RAZON_TEXTO[razon]}, movió el plazo de ${cita} de ${de} a ${a}: «${m}».${cierre.cerrados.length > 0 ? ' Se cierra el seguimiento; Nexo pedirá el estado al vencer el plazo nuevo.' : ''}`,
    hecho: `${autor} movió el plazo de ${cita} al ${a}`,
    titulo: `${autor} movió el plazo de «${t.titulo}»`,
  });
}

/** (c) Declara bloqueado `trabajoId`, con motivo (sin trabajo bloqueante ni fecha de solución). Propaga el riesgo (R4). */
export function efectosDeclararBloqueo(inst: Instantanea, trabajoId: string, autorId: string, motivo: string): Efecto[] {
  const { t, razon } = comprobar(inst, trabajoId, autorId);
  const nombres = nombrador(inst);
  const cita = nombres.cita(t.id);
  if (t.estado === 'bloqueado') throw new ErrorDominio(`${cita} ya está bloqueado.`);
  const m = motivoObligatorio(motivo);
  const autor = nombreDe(inst, autorId);

  const cierre = cerrarSeguimientos(inst, t, autorId, 'declarar_bloqueo');
  const cambios: Efecto[] = [
    { tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { estado: 'bloqueado', bloqueadoPorId: null, motivoBloqueo: m, fechaSolucion: null }, actorId: autorId },
    ...cierre.efectos,
  ];
  const avisos = new Avisos(autorId);
  avisos.agregar(t.responsableId, [t.id], `${autor} declaró bloqueado ${cita}. Motivo: ${m}`);
  return terminar(inst, {
    t,
    autorId,
    cambios,
    avisos,
    escalados: cierre.escalados,
    hechoCorto: `lo declaró bloqueado («${m}»)`,
    motivo: `${autor}, ${RAZON_TEXTO[razon]}, declaró bloqueado ${cita}: «${m}».${cierre.cerrados.length > 0 ? ' Se cierra el seguimiento.' : ''}`,
    hecho: `${autor} declaró bloqueado ${cita}`,
    titulo: `${autor} declaró bloqueado «${t.titulo}»`,
  });
}
