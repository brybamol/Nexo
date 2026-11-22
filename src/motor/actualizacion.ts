// Efectos de una actualización: notas con problema, liberación, reprogramación (§4.2 reglas 3, 5–7). Puro. Tarea 2.3.
// Reformas v2 (R4): con `evidencia`, la regla 19 de docs/08 decide quién puede dar el trabajo por resuelto.
// Las acciones salen con capturaId = null: servicios/aplicar.ts les pone la captura de origen.
import { formatearFecha } from '@/dominio/formato';
import { ErrorDominio, type FuenteEvidencia, type PlanActualizacion, type Trabajo } from '@/dominio/tipos';
import { aplicarEnMemoria, type Efecto } from '@/motor/efectos';
import {
  AvisosPorPersona,
  avisarLiberacion,
  efectosResolver,
  impedimentoEntrega,
  modoResolucion,
  nucleoEntrega,
  nucleoRecepcion,
  quienPuedeResolver,
  recortarCita,
  SIN_EVIDENCIA,
} from '@/motor/entregas';
import { dependientesDirectos, nombrador, porId, type Instantanea } from '@/motor/instantanea';
import { registrarRespuesta } from '@/motor/seguimiento';

const ESTADO_TEXTO: Record<Trabajo['estado'], string> = {
  abierto: 'abierto',
  en_curso: 'en curso',
  bloqueado: 'bloqueado',
  resuelto: 'resuelto',
};

/** Qué hace una petición de pasar a resuelto según la regla 19. */
type Resolucion =
  /** Resolver (con su evidencia; null = llamada sin evidencia, como antes de R4). */
  | { tipo: 'resolver'; evidencia: { tipo: 'entrega' | 'recepcion'; texto: string } | null }
  /** Quien lo pidió lo da por resuelto tras una entrega: es su confirmación de recibido. */
  | { tipo: 'recepcion'; texto: string }
  /** El responsable con otro solicitante: declara la entrega. */
  | { tipo: 'entregar'; texto: string }
  | { tipo: 'ninguna' };

/**
 * Reformas v2 (R4): `evidencia` es el texto con el que la persona resuelve (la captura, la nota del botón) y su fuente.
 * Con ella se aplica la regla 19 de docs/08 a una petición de pasar a resuelto:
 *  - quien lo pidió lo resuelve directamente (evidencia `recepcion`); si ya estaba entregado, es su confirmación de
 *    recibido (acción `confirmar_recepcion` y aviso al responsable, como efectosRecepcion);
 *  - el responsable sin otro solicitante lo resuelve con el texto como evidencia (`entrega`); sin texto → ErrorDominio;
 *  - el responsable con otro solicitante no lo resuelve: declara la entrega con ese texto (como efectosEntrega);
 *  - nadie más: desde la interfaz, ErrorDominio; desde la captura o el correo se aplica lo demás sin el cambio de
 *    estado y el motivo de la acción lo dice (igual si la entrega no es posible, p. ej. bloqueado por otro).
 * El texto de la evidencia es `evidencia.texto` o, si está vacío, `plan.nota`.
 * Sin `evidencia` (llamadas anteriores a R6b) el cambio de estado es el de siempre: no se aplica la regla 19.
 */
export function efectosActualizacion(
  inst: Instantanea,
  plan: PlanActualizacion,
  autorId: string,
  evidencia?: { texto: string; fuente: FuenteEvidencia },
): Efecto[] {
  const trabajos = porId(inst.trabajos);
  const personas = porId(inst.personas);
  const proyectos = porId(inst.proyectos);
  const x = trabajos.get(plan.trabajoId);
  if (!x) return [];
  const autor = personas.get(autorId)?.nombre ?? autorId;
  const ahora = inst.ahora;
  const { cita } = nombrador(inst);

  const efectos: Efecto[] = [];
  const tocados: string[] = [x.id];
  const tocar = (id: string) => {
    if (!tocados.includes(id)) tocados.push(id);
  };
  // Regla 15: lo que le pasa a un propuesto no avisa a nadie.
  const avisos = new AvisosPorPersona(autorId, inst, x.confirmacion === 'propuesto');
  const cambiosTexto: string[] = [];

  // Cambio de estado. Un trabajo bloqueado por otro que sigue sin resolver no sale de bloqueado por una respuesta
  // («sigo con…»): lo libera resolver su bloqueante (regla 5). Resolverlo directamente sí se permite.
  const pedido = plan.nuevoEstado && plan.nuevoEstado !== x.estado ? plan.nuevoEstado : null;
  const bloqueante = x.estado === 'bloqueado' && x.bloqueadoPorId ? trabajos.get(x.bloqueadoPorId) : undefined;
  const sigueBloqueado = pedido !== null && pedido !== 'resuelto' && bloqueante !== undefined && bloqueante.estado !== 'resuelto';
  const nuevo = sigueBloqueado ? null : pedido;

  // Regla 19, antes de producir nada (desde la interfaz puede lanzar ErrorDominio).
  let resolucion: Resolucion = { tipo: 'ninguna' };
  const textosRegla19: string[] = [];
  if (nuevo === 'resuelto') {
    if (!evidencia) {
      resolucion = { tipo: 'resolver', evidencia: null };
    } else {
      const texto = evidencia.texto.trim() || (plan.nota ?? '').trim();
      const suave = evidencia.fuente !== 'interfaz';
      const modo = modoResolucion(x, autorId);
      if (modo === 'prohibido') {
        const motivo = quienPuedeResolver(inst, x);
        if (!suave) throw new ErrorDominio(`${motivo}.`);
        textosRegla19.push(`${cita(x.id)} no cambió de estado: ${minuscula(motivo)}`);
      } else if (modo === 'entregar') {
        const impedimento = impedimentoEntrega(inst, x, autorId);
        if (impedimento) {
          if (!suave) throw new ErrorDominio(impedimento);
          textosRegla19.push(`${cita(x.id)} no cambió de estado: ${minuscula(impedimento.replace(/\.$/, ''))}`);
        } else {
          if (!texto) throw new ErrorDominio(SIN_EVIDENCIA);
          resolucion = { tipo: 'entregar', texto };
        }
      } else if (x.solicitadoPorId === autorId && x.responsableId !== autorId) {
        resolucion = x.entrega ? { tipo: 'recepcion', texto } : { tipo: 'resolver', evidencia: { tipo: 'recepcion', texto } };
      } else {
        if (!texto) throw new ErrorDominio(SIN_EVIDENCIA);
        resolucion = { tipo: 'resolver', evidencia: { tipo: 'entrega', texto } };
      }
    }
  }

  // Regla 3: la actualización del responsable (o de un destinatario de la cadena) responde al seguimiento.
  efectos.push(...registrarRespuesta(inst, x.id, autorId));

  if (sigueBloqueado && bloqueante) {
    cambiosTexto.push(`${cita(x.id)} sigue bloqueado por ${cita(bloqueante.id)}: no cambió su estado`);
  }
  cambiosTexto.push(...textosRegla19);

  if (resolucion.tipo === 'entregar' && x.solicitadoPorId && evidencia) {
    // Sobre la instantánea ya respondida: los seguimientos que cerró registrarRespuesta no se cierran dos veces.
    efectos.push(
      ...nucleoEntrega(
        aplicarEnMemoria(inst, efectos),
        { ...x, solicitadoPorId: x.solicitadoPorId },
        autorId,
        { nota: resolucion.texto, enlace: null, fuente: evidencia.fuente },
        avisos,
      ),
    );
    cambiosTexto.push(`${cita(x.id)} quedó entregado: falta que ${personas.get(x.solicitadoPorId)?.nombre ?? ''} confirme que lo recibió`);
  } else if (resolucion.tipo === 'recepcion' && evidencia) {
    const r = nucleoRecepcion(inst, x, autorId, resolucion.texto, evidencia.fuente, avisos, efectos);
    efectos.push(...r.efectos);
    r.tocados.forEach(tocar);
    cambiosTexto.push(...r.textos);
  } else if (resolucion.tipo === 'resolver') {
    const r = efectosResolver(inst, x, autorId, avisos, efectos);
    efectos.push(...r.efectos);
    r.tocados.forEach(tocar);
    cambiosTexto.push(...r.textos);
    if (resolucion.evidencia && evidencia) {
      efectos.push({
        tipo: 'agregar_evidencia',
        evidencia: {
          trabajoId: x.id,
          tipo: resolucion.evidencia.tipo,
          fuente: evidencia.fuente,
          compromisoClave: null,
          mensajeId: null,
          buzones: [],
          enlaces: {},
          autorId,
          en: ahora,
          cita: recortarCita(resolucion.evidencia.texto),
        },
      });
    }
  } else if (nuevo && nuevo !== 'resuelto') {
    const saleDeBloqueo = x.estado === 'bloqueado';
    efectos.push({
      tipo: 'actualizar_trabajo',
      trabajoId: x.id,
      cambios: { estado: nuevo, ...(saleDeBloqueo ? { bloqueadoPorId: null, motivoBloqueo: null, fechaSolucion: null } : {}) },
      actorId: autorId,
    });
    cambiosTexto.push(`${cita(x.id)} pasó a ${ESTADO_TEXTO[nuevo]}`);
    if (saleDeBloqueo) avisarLiberacion(inst, x, 'ya no está bloqueado', avisos);
  }

  // Nota en el propio trabajo.
  if (plan.nota) {
    efectos.push({ tipo: 'agregar_nota', trabajoId: x.id, autorId, texto: plan.nota });
    cambiosTexto.push(`nota en ${cita(x.id)}`);
  }

  // Regla 6: nota con problema.
  if (plan.hayProblema) {
    const detalle = plan.nota ? `: «${plan.nota}»` : '.';
    for (const dep of inst.dependencias) {
      if (dep.trabajoId !== x.id) continue;
      const p = trabajos.get(dep.dependeDeId);
      if (!p || p.estado === 'resuelto') continue;
      avisos.agregar(p.responsableId, [x.id, p.id], `${autor} reportó un problema en ${cita(x.id)}, que depende de ${cita(p.id)}${detalle}`);
    }
    for (const depId of dependientesDirectos(inst, x.id)) {
      const d = trabajos.get(depId);
      if (!d || d.estado === 'resuelto') continue;
      const responsableProyecto = proyectos.get(d.proyectoId)?.responsableId;
      if (!responsableProyecto) continue;
      avisos.agregar(
        responsableProyecto,
        [x.id, d.id],
        `${autor} reportó un problema en ${cita(x.id)}; de él depende ${cita(d.id)}${detalle}`,
      );
    }
  }

  // Regla 7: reprogramación por alguien que no es el responsable → aviso al responsable.
  for (const r of plan.reprogramar) {
    const t = trabajos.get(r.trabajoId);
    if (!t || t.plazo.getTime() === r.plazo.getTime()) continue;
    efectos.push({ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { plazo: r.plazo }, actorId: autorId });
    tocar(t.id);
    cambiosTexto.push(`plazo de ${cita(t.id)} a ${formatearFecha(r.plazo)}`);
    if (t.responsableId !== autorId) {
      avisos.agregar(
        t.responsableId,
        [t.id],
        `${autor} movió el plazo de ${cita(t.id)} de ${formatearFecha(t.plazo)} a ${formatearFecha(r.plazo)}.`,
      );
    }
  }

  // Notas en trabajos relacionados: no avisan.
  for (const n of plan.notasRelacionadas) {
    efectos.push({ tipo: 'agregar_nota', trabajoId: n.trabajoId, autorId, texto: n.nota });
    tocar(n.trabajoId);
    cambiosTexto.push(`nota en ${cita(n.trabajoId)}`);
  }

  const hechoOrigen = `${autor} actualizó ${cita(x.id)}${plan.nota ? `: «${plan.nota}»` : ''}`;

  // R10: registro de lo que hizo Nexo con la actualización.
  efectos.push({
    tipo: 'accion',
    accion: {
      en: ahora,
      tipo: 'actualizar_trabajo',
      motivo: `${autor} informó un cambio: ${cambiosTexto.join('; ')}.`,
      hechoOrigen,
      trabajoIds: tocados,
      decisionId: null,
      destinatarioId: null,
      capturaId: null,
    },
    aviso: null,
  });

  efectos.push(...avisos.efectos(ahora, hechoOrigen, `${autor} actualizó «${x.titulo}»`));
  return efectos;
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
