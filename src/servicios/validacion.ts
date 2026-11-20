// Validación pura de la interpretación de la IA (§4.3 de docs/05). Tarea 2.3.
// La IA solo propone: aquí se comprueba contra la instantánea y se decide la ÚNICA pregunta (R9).
import { minusculaInicial } from '@/dominio/texto';
import { resolverPlazo } from '@/dominio/tiempo';
import type { Persona, Plan, PlazoPropuesto, Trabajo } from '@/dominio/tipos';
import type { Interpretacion, InterpretacionDe } from '@/ia/interprete';
import { porId, type Instantanea } from '@/motor/instantanea';
import type { OpcionRespuesta } from '@/servicios/vistas';

export type ResultadoValidacion =
  | { tipo: 'plan'; plan: Plan }
  | { tipo: 'pregunta'; texto: string; opciones: OpcionRespuesta[] }
  | { tipo: 'error'; mensaje: string };

const error = (mensaje: string): ResultadoValidacion => ({ tipo: 'error', mensaje });
const plan = (p: Plan): ResultadoValidacion => ({ tipo: 'plan', plan: p });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Instante del plazo propuesto, o null si el día o la hora no son válidos. */
function plazoValido(p: PlazoPropuesto, urgente: boolean, ahora: Date): Date | null {
  if (p.dia !== 'hoy' && p.dia !== 'manana') {
    if (!FECHA.test(p.dia)) return null;
    const [a, m, d] = p.dia.split('-').map(Number) as [number, number, number];
    const dia = new Date(Date.UTC(a, m - 1, d));
    if (dia.getUTCFullYear() !== a || dia.getUTCMonth() !== m - 1 || dia.getUTCDate() !== d) return null;
  }
  if (p.hora !== undefined && !HORA.test(p.hora)) return null;
  const r = resolverPlazo(p, urgente, ahora);
  return Number.isNaN(r.getTime()) ? null : r;
}

const etiquetaPersona = (p: Persona) => `${p.nombre} (${p.rol})`;

/** Opciones de responsable: la propuesta primero, luego el responsable del proyecto, el jefe del autor y el autor. */
function opcionesResponsable(inst: Instantanea, propuestoId: string, proyectoId: string, autorId: string): OpcionRespuesta[] {
  const personas = porId(inst.personas);
  const candidatos = [
    propuestoId,
    inst.proyectos.find((p) => p.id === proyectoId)?.responsableId,
    personas.get(autorId)?.jefeId,
    autorId,
  ];
  const opciones: OpcionRespuesta[] = [];
  for (const id of candidatos) {
    const p = id ? personas.get(id) : undefined;
    if (p && !opciones.some((o) => o.valor === p.id)) opciones.push({ valor: p.id, etiqueta: etiquetaPersona(p) });
  }
  return opciones;
}

function validarTrabajoNuevo(inst: Instantanea, i: InterpretacionDe<'trabajo_nuevo'>, autorId: string): ResultadoValidacion {
  const proyecto = inst.proyectos.find((p) => p.id === i.proyectoId);
  if (!proyecto) return error(`No reconozco el proyecto ${i.proyectoId}. No creé nada.`);
  const trabajos = porId(inst.trabajos);
  for (const id of i.relacionados) {
    if (!trabajos.has(id)) return error(`No existe el trabajo ${id}. No creé nada.`);
  }
  for (const id of i.bloquea) {
    const t = trabajos.get(id);
    if (!t) return error(`No existe el trabajo ${id}. No creé nada.`);
    if (t.estado === 'resuelto') return error(`${id} ya está resuelto: no puede quedar bloqueado. No creé nada.`);
  }
  const repuestoId = i.repuestoFaltante?.repuestoId ?? null;
  if (repuestoId && !inst.repuestos.some((r) => r.id === repuestoId)) {
    return error(`No reconozco el repuesto ${repuestoId}. No creé nada.`);
  }
  // Frase repetida: si lo que bloquearía ya está bloqueado por un trabajo no resuelto (en particular, uno que consigue
  // el mismo repuesto), es ese trabajo. No se crea otro ni se cambia el bloqueante.
  for (const id of i.bloquea) {
    const bloqueanteId = trabajos.get(id)?.bloqueadoPorId;
    const bloqueante = bloqueanteId ? trabajos.get(bloqueanteId) : undefined;
    if (bloqueante && bloqueante.estado !== 'resuelto') return plan({ tipo: 'duplicado', trabajoId: bloqueante.id });
  }
  const plazo = plazoValido(i.plazo, i.urgente, inst.ahora);
  if (!plazo) return error('No entendí el plazo. No creé nada.');

  // R9: sin responsable seguro no hay trabajo; se propone uno y se pregunta (una sola pregunta).
  const responsable = inst.personas.find((p) => p.id === i.responsableId);
  if (!responsable || !i.responsableSeguro) {
    const propuestoId = responsable ? responsable.id : proyecto.responsableId;
    const opciones = opcionesResponsable(inst, propuestoId, proyecto.id, autorId);
    const propuesto = inst.personas.find((p) => p.id === propuestoId);
    return {
      tipo: 'pregunta',
      texto: `¿Quién se encarga de «${i.titulo}»? Propongo a ${propuesto?.nombre ?? 'alguien'}.`,
      opciones,
    };
  }

  return plan({
    tipo: 'trabajo_nuevo',
    titulo: i.titulo.trim(),
    proyectoId: proyecto.id,
    responsableId: responsable.id,
    plazo,
    urgente: i.urgente,
    conCostoProbable: i.conCostoProbable,
    relacionados: [...new Set(i.relacionados)],
    bloquea: [...new Set(i.bloquea)],
    repuestoFaltanteId: repuestoId,
  });
}

function validarActualizacion(inst: Instantanea, i: InterpretacionDe<'actualizacion'>): ResultadoValidacion {
  const trabajos = porId(inst.trabajos);
  const x = trabajos.get(i.trabajoId);
  if (!x) return error(`No existe el trabajo ${i.trabajoId}. No cambié nada.`);
  if (x.estado === 'resuelto') return error(`${x.id} «${x.titulo}» ya está resuelto. No cambié nada.`);

  const reprogramar: { trabajoId: string; plazo: Date }[] = [];
  for (const r of i.reprogramar) {
    const t: Trabajo | undefined = trabajos.get(r.trabajoId);
    if (!t) return error(`No existe el trabajo ${r.trabajoId}. No cambié nada.`);
    if (t.estado === 'resuelto') return error(`${t.id} ya está resuelto: no se puede mover su plazo. No cambié nada.`);
    const plazo = plazoValido(r.plazo, t.urgente, inst.ahora);
    if (!plazo) return error(`No entendí el nuevo plazo de ${t.id}. No cambié nada.`);
    reprogramar.push({ trabajoId: t.id, plazo });
  }
  for (const n of i.notasRelacionadas) {
    if (!trabajos.has(n.trabajoId)) return error(`No existe el trabajo ${n.trabajoId}. No cambié nada.`);
  }
  const nota = i.nota?.trim() ? i.nota.trim() : null;
  const nuevoEstado = i.nuevoEstado && i.nuevoEstado !== x.estado ? i.nuevoEstado : null;
  if (!nuevoEstado && !nota && reprogramar.length === 0 && i.notasRelacionadas.length === 0) {
    return error(`Entendí que hablas de ${x.id}, pero no qué cambió. No cambié nada.`);
  }
  return plan({
    tipo: 'actualizacion',
    trabajoId: x.id,
    nuevoEstado,
    nota,
    hayProblema: i.hayProblema,
    reprogramar,
    notasRelacionadas: i.notasRelacionadas.filter((n) => n.nota.trim() !== '').map((n) => ({ trabajoId: n.trabajoId, nota: n.nota.trim() })),
  });
}

function validarDecision(inst: Instantanea, i: InterpretacionDe<'decision'>): ResultadoValidacion {
  if (!inst.proyectos.some((p) => p.id === i.proyectoId)) return error(`No reconozco el proyecto ${i.proyectoId}. No creé nada.`);
  const repuesto = inst.repuestos.find((r) => r.id === i.compra.repuestoId);
  if (!repuesto) return error(`No reconozco el repuesto ${i.compra.repuestoId}. No creé nada.`);
  if (i.trabajoRelacionadoId !== null && !inst.trabajos.some((t) => t.id === i.trabajoRelacionadoId)) {
    return error(`No existe el trabajo ${i.trabajoRelacionadoId}. No creé nada.`);
  }
  // Propuesta repetida: una sola decisión pendiente por repuesto y proyecto.
  const yaPendiente = inst.decisiones.find(
    (d) => d.estado === 'pendiente' && d.repuestoId === repuesto.id && d.proyectoId === i.proyectoId,
  );
  if (yaPendiente) {
    const decisor = inst.personas.find((p) => p.id === yaPendiente.decisorId)?.nombre ?? yaPendiente.decisorId;
    return error(
      `Ya está pendiente la decisión ${yaPendiente.id} sobre ${minusculaInicial(repuesto.nombre)}, esperando a ${decisor}. No creé nada.`,
    );
  }
  if (i.compra.cantidad === null) {
    const unidad = repuesto.unidad === 'unidad' ? 'unidades' : `${repuesto.unidad}s`;
    return {
      tipo: 'pregunta',
      texto: `¿Cuántos ${unidad} de ${minusculaInicial(repuesto.nombre)} se van a comprar?`,
      opciones: [],
    };
  }
  return plan({
    tipo: 'decision',
    proyectoId: i.proyectoId,
    resumen: i.resumen,
    propuesta: {
      repuestoId: repuesto.id,
      cantidad: i.compra.cantidad,
      proveedor: i.compra.proveedor,
      ajustePrecioPct: i.compra.ajustePrecioPct,
      existenciaReal: i.existenciaReal,
    },
    trabajoRelacionadoId: i.trabajoRelacionadoId,
  });
}

/**
 * Comprueba que existan persona, proyecto, trabajos y repuesto; que el trabajo a actualizar no esté resuelto;
 * resuelve los plazos con inst.ahora y decide la ÚNICA pregunta (responsable no seguro → cantidad nula → nada).
 */
export function validarInterpretacion(inst: Instantanea, interp: Interpretacion, autorId: string): ResultadoValidacion {
  if (!inst.personas.some((p) => p.id === autorId)) return error(`No existe la persona ${autorId}.`);
  switch (interp.tipo) {
    case 'trabajo_nuevo':
      return validarTrabajoNuevo(inst, interp, autorId);
    case 'actualizacion':
      return validarActualizacion(inst, interp);
    case 'duplicado': {
      const t = inst.trabajos.find((x) => x.id === interp.trabajoId);
      return t ? plan({ tipo: 'duplicado', trabajoId: t.id }) : error(`No existe el trabajo ${interp.trabajoId}.`);
    }
    case 'decision':
      return validarDecision(inst, interp);
    case 'no_es_trabajo':
      return plan({ tipo: 'no_es_trabajo', motivo: interp.motivo });
    case 'pregunta':
      return plan({ tipo: 'pregunta', pregunta: interp.pregunta });
  }
}
