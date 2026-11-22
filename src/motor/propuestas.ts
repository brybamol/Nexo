// Propuestas de Nexo: seguimiento y revisión (docs/08 reglas 15–17). Puro. Esqueleto de R2; lo implementa R3.
//
// Quién revisa (regla 16): el dueño, mientras está propuesto; una parte (solicitante o responsable), si está confirmado
// por dos fuentes y aún no tiene revisión humana. «Sin revisión humana» se lee de `confirmadoPorId === null`: toda
// confirmación o corrección de una persona lo llena, y un descarte lo saca de la instantánea.
import { HORAS_REVISION_PROPUESTA } from '@/dominio/constantes';
import { formatearFecha } from '@/dominio/formato';
import { sumarHorasLaborales } from '@/dominio/tiempo';
import {
  ErrorDominio,
  type CampoCorregible,
  type DatosRevisionCaptura,
  type EntradaRevision,
  type EntradaRevisionPropuesta,
  type RevisionNueva,
  type Seguimiento,
  type Trabajo,
  type ValoresPropuesta,
} from '@/dominio/tipos';
import { aplicarEnMemoria, type CambiosTrabajo, type Efecto } from '@/motor/efectos';
import { nombrador, siguienteIdSeguimiento, siguienteNumeroTrabajo, type Instantanea } from '@/motor/instantanea';
import { siguienteNivelEn } from '@/motor/seguimiento';

// ─── Seguimiento de la propuesta (regla 15) ───────────────────────────────────

/**
 * Regla 15: al crearse una propuesta, su seguimiento `tipo = 'propuesta'` (nivel 0, destinatario = dueño,
 * `plazoReferencia` = `iniciadoEn` = creación, `proximoEn` = creación + HORAS_REVISION_PROPUESTA laborales).
 * Solo crea el seguimiento (nivel 0 sin acción). `inst` ya debe contener el trabajo.
 * Devuelve [] si el trabajo no está propuesto (o no tiene dueño) o ya tiene un seguimiento de propuesta pendiente.
 * El recordatorio al vencer lo hace `tick` (motor/seguimiento.ts).
 */
export function seguimientoDePropuesta(inst: Instantanea, trabajoId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) throw new ErrorDominio('No existe el trabajo para iniciar el seguimiento de su propuesta.');
  if (t.confirmacion !== 'propuesto' || t.duenoPropuestaId === null) return [];
  if (inst.seguimientos.some((s) => s.trabajoId === t.id && s.tipo === 'propuesta' && s.estado === 'pendiente')) return [];
  const seguimiento: Seguimiento = {
    id: siguienteIdSeguimiento(inst),
    trabajoId: t.id,
    plazoReferencia: t.creadoEn,
    nivel: 0,
    destinatarioId: t.duenoPropuestaId,
    urgente: false,
    proximoEn: sumarHorasLaborales(t.creadoEn, HORAS_REVISION_PROPUESTA),
    estado: 'pendiente',
    iniciadoEn: t.creadoEn,
    escaladosA: [],
    tipo: 'propuesta',
  };
  return [{ tipo: 'crear_seguimiento', seguimiento }];
}

// ─── Revisión (regla 16) ──────────────────────────────────────────────────────

const ORDEN_CAMPOS: CampoCorregible[] = ['titulo', 'responsable', 'plazo', 'proyecto'];

const valores = (t: Pick<Trabajo, 'titulo' | 'responsableId' | 'plazo' | 'proyectoId'>): ValoresPropuesta => ({
  titulo: t.titulo,
  responsableId: t.responsableId,
  plazo: t.plazo,
  proyectoId: t.proyectoId,
});

function nombre(inst: Instantanea, personaId: string): string {
  return inst.personas.find((p) => p.id === personaId)?.nombre ?? personaId;
}

/** Partes de un trabajo (solicitante primero), sin repetir. */
const partes = (t: Trabajo): string[] => [...new Set([t.solicitadoPorId, t.responsableId].filter((p): p is string => p !== null))];

/** Quién puede revisar `t` ahora (regla 16); [] si nadie. */
function revisores(t: Trabajo): string[] {
  if (t.confirmacion === 'propuesto') return t.duenoPropuestaId ? [t.duenoPropuestaId] : [];
  if (t.confirmacion === 'confirmado' && t.origen === 'correo' && t.confirmadoPorId === null) return partes(t);
  return [];
}

function comprobarRevisor(inst: Instantanea, t: Trabajo, personaId: string): void {
  const cita = nombrador(inst).cita(t.id);
  const pueden = revisores(t);
  if (pueden.includes(personaId)) return;
  if (pueden.length > 0) {
    const quienes = pueden.map((p) => nombre(inst, p)).join(' o ');
    throw new ErrorDominio(`Solo ${quienes} puede revisar ${cita}.`);
  }
  if (t.confirmadoPorId !== null) throw new ErrorDominio(`${cita} ya lo confirmó ${nombre(inst, t.confirmadoPorId)}: no hay nada que revisar.`);
  throw new ErrorDominio(`${cita} no es una propuesta de Nexo: no hay nada que revisar.`);
}

/** Lo necesario para rehacer el caso: el primer pedido del correo (o, si no hay, la primera evidencia). */
function entradaDe(inst: Instantanea, t: Trabajo): EntradaRevision {
  const propias = inst.evidencias.filter((e) => e.trabajoId === t.id);
  const e = propias.find((x) => x.tipo === 'pedido') ?? propias[0];
  if (!e) return { cita: '' };
  return { cita: e.cita, deId: e.autorId, enviado: e.en };
}

/** Cambios reales de una corrección, validados, en el orden fijo de los campos. */
function cambiosReales(
  inst: Instantanea,
  t: Trabajo,
  c: Extract<EntradaRevisionPropuesta, { tipo: 'corregir' }>['cambios'],
): { campos: CampoCorregible[]; cambios: CambiosTrabajo } {
  const cambios: CambiosTrabajo = {};
  const campos = new Set<CampoCorregible>();
  if (c.titulo !== undefined) {
    const titulo = c.titulo.trim();
    if (titulo === '') throw new ErrorDominio('El título no puede quedar vacío.');
    if (titulo !== t.titulo) {
      cambios.titulo = titulo;
      campos.add('titulo');
    }
  }
  if (c.responsableId !== undefined && c.responsableId !== t.responsableId) {
    if (!inst.personas.some((p) => p.id === c.responsableId)) throw new ErrorDominio('Esa persona no está en Nexo.');
    cambios.responsableId = c.responsableId;
    campos.add('responsable');
  }
  if (c.plazo !== undefined) {
    if (Number.isNaN(c.plazo.getTime())) throw new ErrorDominio('El plazo no es una fecha válida.');
    if (c.plazo.getTime() !== t.plazo.getTime()) {
      cambios.plazo = c.plazo;
      campos.add('plazo');
    }
  }
  if (c.proyectoId !== undefined && c.proyectoId !== t.proyectoId) {
    if (!inst.proyectos.some((p) => p.id === c.proyectoId)) throw new ErrorDominio('Ese proyecto no está en Nexo.');
    cambios.proyectoId = c.proyectoId;
    // Única excepción a «el número no cambia», y solo mientras no tenía revisión humana (regla 16).
    cambios.numero = siguienteNumeroTrabajo(inst, c.proyectoId);
    campos.add('proyecto');
  }
  if (campos.size === 0) throw new ErrorDominio('No cambiaste nada: si está bien así, confírmalo.');
  return { campos: ORDEN_CAMPOS.filter((x) => campos.has(x)), cambios };
}

/**
 * Regla 16: confirmar, corregir o descartar una propuesta. ErrorDominio si `personaId` no puede revisarla o si
 * «No cambiaste nada». Incluye la acción `revisar_propuesta`, el evento `propuesta_revisada`, el efecto
 * `registrar_revision`, el cierre del seguimiento `propuesta` y los avisos que correspondan.
 *
 * Tras confirmar o corregir: aviso de asignación al responsable si no es quien revisa y el trabajo no tiene entrega;
 * si tiene entrega y quien revisa es el solicitante, abre en silencio el seguimiento `recepcion` (regla 20). R1 aplica
 * desde ese momento (lo hace `tick`). Descartar no avisa a nadie.
 */
export function efectosRevision(inst: Instantanea, trabajoId: string, personaId: string, r: EntradaRevisionPropuesta): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) {
    if (inst.descartados.some((d) => d.id === trabajoId)) throw new ErrorDominio('Esa propuesta ya se descartó.');
    throw new ErrorDominio('No existe ese trabajo.');
  }
  comprobarRevisor(inst, t, personaId);

  const quien = nombre(inst, personaId);
  const citaAntes = nombrador(inst).cita(t.id);
  const propuesto = valores(t);
  const efectos: Efecto[] = [];

  // Cerrar el seguimiento de la propuesta (antes de un posible descarte, para que quede guardado como respondido).
  for (const s of inst.seguimientos) {
    if (s.trabajoId === t.id && s.tipo === 'propuesta' && s.estado === 'pendiente') {
      efectos.push({ tipo: 'actualizar_seguimiento', seguimientoId: s.id, cambios: { estado: 'respondido' } });
    }
  }

  let resultado: RevisionNueva['resultado'];
  let campos: CampoCorregible[] = [];
  let final: ValoresPropuesta | null;
  let motivo: string | null = null;
  let resumen: string;

  if (r.tipo === 'descartar') {
    resultado = 'descartada';
    motivo = r.motivo?.trim() || null;
    final = null;
    efectos.push({ tipo: 'actualizar_trabajo', trabajoId: t.id, cambios: { confirmacion: 'descartado' }, actorId: personaId });
    resumen = `${quien} descartó la propuesta ${citaAntes}${motivo ? `: «${motivo}»` : ' (sin motivo escrito)'}. Su número queda ocupado.`;
  } else {
    const correccion = r.tipo === 'corregir' ? cambiosReales(inst, t, r.cambios) : { campos: [], cambios: {} };
    campos = correccion.campos;
    resultado = r.tipo === 'corregir' ? 'corregida' : 'confirmada';
    efectos.push({
      tipo: 'actualizar_trabajo',
      trabajoId: t.id,
      cambios: { ...correccion.cambios, confirmacion: 'confirmado', confirmadoPorId: personaId },
      actorId: personaId,
    });
    final = valores({ ...t, ...correccion.cambios });
    const citaDespues = nombrador(aplicarEnMemoria(inst, efectos)).cita(t.id);
    resumen =
      r.tipo === 'corregir'
        ? `${quien} corrigió (${campos.map(etiquetaCampo).join(', ')}) y confirmó la propuesta ${citaDespues}.`
        : `${quien} confirmó la propuesta ${citaDespues} tal cual.`;
  }

  efectos.push(
    {
      tipo: 'accion',
      accion: {
        en: inst.ahora,
        tipo: 'revisar_propuesta',
        motivo: resumen,
        hechoOrigen: `Revisión de ${citaAntes} por ${quien}`,
        trabajoIds: [t.id],
        decisionId: null,
        destinatarioId: null,
        capturaId: null,
      },
      aviso: null,
    },
    {
      tipo: 'evento',
      evento: { en: inst.ahora, actorId: personaId, tipo: 'propuesta_revisada', trabajoId: t.id, decisionId: null, datos: { resultado, campos } },
    },
    {
      tipo: 'registrar_revision',
      revision: {
        en: inst.ahora,
        personaId,
        origen: t.origen === 'captura' ? 'captura' : 'correo',
        trabajoId: t.id,
        capturaId: t.capturaId,
        resultado,
        campos,
        propuesto,
        final,
        entrada: entradaDe(inst, t),
        motivo,
      },
    },
  );

  if (r.tipo !== 'descartar') efectos.push(...trasConfirmar(aplicarEnMemoria(inst, efectos), t.id, personaId));
  return efectos;
}

const ETIQUETAS: Record<CampoCorregible, string> = { titulo: 'título', responsable: 'responsable', plazo: 'plazo', proyecto: 'proyecto' };
const etiquetaCampo = (c: CampoCorregible) => ETIQUETAS[c];

/** Aviso de asignación o seguimiento de recepción en silencio, sobre el trabajo ya confirmado (regla 16). */
function trasConfirmar(inst: Instantanea, trabajoId: string, personaId: string): Efecto[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId) as Trabajo;
  const nombres = nombrador(inst);
  const cita = nombres.cita(t.id);
  const quien = nombre(inst, personaId);

  if (t.entrega === null) {
    if (t.responsableId === personaId) return [];
    const pidio = t.solicitadoPorId && t.solicitadoPorId !== personaId ? ` Lo pidió ${nombre(inst, t.solicitadoPorId)}.` : '';
    return [
      {
        tipo: 'accion',
        accion: {
          en: inst.ahora,
          tipo: 'aviso',
          motivo: `Nuevo trabajo asignado a ${nombre(inst, t.responsableId)}: ${cita} (${quien} confirmó la propuesta de Nexo).`,
          hechoOrigen: `Revisión de ${cita} por ${quien}`,
          trabajoIds: [t.id],
          decisionId: null,
          destinatarioId: t.responsableId,
          capturaId: null,
        },
        aviso: {
          personaId: t.responsableId,
          en: inst.ahora,
          titulo: `Nuevo trabajo: ${t.titulo}`,
          cuerpo: `${quien} confirmó ${cita} a tu cargo. Plazo: ${formatearFecha(t.plazo)}.${pidio}`,
          trabajoIds: [t.id],
        },
      },
    ];
  }

  // Con entrega: si revisa quien lo pidió, Nexo esperará su «lo recibí» (regla 20), sin aviso (ya lo está viendo).
  if (personaId !== t.solicitadoPorId) return [];
  if (inst.seguimientos.some((s) => s.trabajoId === t.id && s.tipo === 'recepcion' && s.estado === 'pendiente')) return [];
  const seguimiento: Seguimiento = {
    id: siguienteIdSeguimiento(inst),
    trabajoId: t.id,
    plazoReferencia: t.entrega.en,
    nivel: 0,
    destinatarioId: personaId,
    urgente: t.urgente,
    proximoEn: siguienteNivelEn(inst.ahora, t.urgente),
    estado: 'pendiente',
    iniciadoEn: inst.ahora,
    escaladosA: [],
    tipo: 'recepcion',
  };
  return [{ tipo: 'crear_seguimiento', seguimiento }];
}

// ─── Captura insegura (regla 17) ──────────────────────────────────────────────

/**
 * Regla 17: revisión `origen = 'captura'` al responder la pregunta de responsable: `confirmada` si `elegidoId` es la
 * primera opción propuesta (`propuestoId`), `corregida` con `['responsable']` si es otra.
 */
export function revisionDeCaptura(propuestoId: string, elegidoId: string, datos: DatosRevisionCaptura): RevisionNueva {
  const base = { titulo: datos.titulo, plazo: datos.plazo, proyectoId: datos.proyectoId };
  const igual = propuestoId === elegidoId;
  return {
    en: datos.en,
    personaId: datos.personaId,
    origen: 'captura',
    trabajoId: datos.trabajoId,
    capturaId: datos.capturaId,
    resultado: igual ? 'confirmada' : 'corregida',
    campos: igual ? [] : ['responsable'],
    propuesto: { ...base, responsableId: propuestoId },
    final: { ...base, responsableId: elegidoId },
    entrada: { texto: datos.texto },
    motivo: null,
  };
}
