// Camino del escalamiento (R3 reformada) y quién puede actuar sobre un trabajo (regla 2 de la reforma). Puro.
//
// El escalamiento sigue al TRABAJO, no a los cargos (el jefe directo, `jefeId`, ya no interviene):
//   paso 1 → el responsable del PROYECTO del trabajo (el dueño del resultado);
//   paso 2 → los responsables de los OTROS proyectos con trabajos en riesgo o bloqueados por él (los perjudicados),
//            uno por persona; si no hay ninguno, el responsable de la operación (constantes.ts).
// Nunca se escala al propio responsable del trabajo ni dos veces a la misma persona por el mismo seguimiento: un paso
// que se queda sin nadie se salta (si el responsable del proyecto es el del trabajo, el primer escalamiento ya va al
// paso 2 y no queda otro). Como máximo dos niveles tras el recordatorio.
import { RESPONSABLE_OPERACION } from '@/dominio/constantes';
import type { Seguimiento, Trabajo } from '@/dominio/tipos';
import { cadenaDependientes, dependientesDirectos, porId, type Instantanea } from '@/motor/instantanea';
import { calcularMarcas } from '@/motor/marcas';

/** Por qué alguien recibe un escalamiento (o puede actuar sobre un trabajo). */
export type Razon = 'proyecto' | 'perjudicado' | 'operacion' | 'escalado';

export interface Destino {
  personaId: string;
  razon: Exclude<Razon, 'escalado'>;
  /** Perjudicado: su proyecto y sus trabajos en riesgo o bloqueados por el trabajo escalado. */
  proyectoId: string | null;
  trabajoIds: string[];
}

/** El responsable de la operación si existe en la instantánea; null si no (empresa sin ese dato). */
export function responsableOperacion(inst: Instantanea): string | null {
  return inst.personas.some((p) => p.id === RESPONSABLE_OPERACION) ? RESPONSABLE_OPERACION : null;
}

/** Qué deja parado un trabajo: los bloqueados por él y sus dependientes, con sus cadenas; sin resueltos ni repetir. */
export function queBloquea(inst: Instantanea, t: Trabajo): string[] {
  const trabajos = porId(inst.trabajos);
  const directos = [...inst.trabajos.filter((x) => x.bloqueadoPorId === t.id).map((x) => x.id), ...dependientesDirectos(inst, t.id)];
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

/**
 * Perjudicados de `t`, en orden de aparición: por cada OTRO proyecto con trabajos en riesgo o bloqueados por `t`
 * (de lo que `t` deja parado), su responsable y esos trabajos. Agrupado por persona (R5).
 */
export function perjudicados(inst: Instantanea, t: Trabajo): Destino[] {
  const marcas = calcularMarcas(inst);
  const trabajos = porId(inst.trabajos);
  const proyectos = porId(inst.proyectos);
  const porPersona = new Map<string, Destino>();
  for (const id of queBloquea(inst, t)) {
    const x = trabajos.get(id);
    if (!x || x.proyectoId === t.proyectoId) continue;
    if (x.estado !== 'bloqueado' && !marcas.get(id)?.enRiesgo) continue;
    const responsable = proyectos.get(x.proyectoId)?.responsableId;
    if (!responsable) continue;
    const d = porPersona.get(responsable) ?? { personaId: responsable, razon: 'perjudicado' as const, proyectoId: x.proyectoId, trabajoIds: [] };
    d.trabajoIds.push(id);
    porPersona.set(responsable, d);
  }
  return [...porPersona.values()];
}

/**
 * Los pasos del escalamiento de `t` que quedan para el seguimiento `s` (sin las personas ya escaladas en él ni el
 * responsable del trabajo), calculados con la instantánea actual. Cada paso es una lista de destinos.
 */
export function pasosEscalamiento(inst: Instantanea, t: Trabajo, s: Pick<Seguimiento, 'escaladosA'>): Destino[][] {
  const responsableProyecto = inst.proyectos.find((p) => p.id === t.proyectoId)?.responsableId ?? null;
  // ¿Ya se hizo el paso 2? Sí si hubo más de un escalado, o uno solo que no era el dueño del resultado (se saltó el 1).
  const yaHuboPaso2 = s.escaladosA.length > 1 || (s.escaladosA.length === 1 && s.escaladosA[0] !== responsableProyecto);
  if (yaHuboPaso2) return [];

  const fuera = new Set<string>([t.responsableId, ...s.escaladosA]);
  const pasos: Destino[][] = [];
  // Paso 1: el dueño del resultado. Solo antes del primer escalamiento.
  if (s.escaladosA.length === 0 && responsableProyecto && !fuera.has(responsableProyecto)) {
    pasos.push([{ personaId: responsableProyecto, razon: 'proyecto', proyectoId: t.proyectoId, trabajoIds: [] }]);
    fuera.add(responsableProyecto);
  }
  // Paso 2: los perjudicados de otros proyectos o, si no hay, el responsable de la operación.
  const perj = perjudicados(inst, t).filter((d) => !fuera.has(d.personaId));
  if (perj.length > 0) pasos.push(perj);
  else {
    const op = responsableOperacion(inst);
    if (op && !fuera.has(op)) pasos.push([{ personaId: op, razon: 'operacion', proyectoId: null, trabajoIds: [] }]);
  }
  return pasos;
}

/**
 * Quiénes pueden actuar sobre un trabajo (reasignar, mover el plazo, declarar bloqueo) y por qué: el responsable de su
 * proyecto, las personas a las que ya se escaló ese trabajo (en cualquier seguimiento) y el responsable de la operación.
 * Sin repetir; el orden es ese.
 */
export function autorizadosParaActuar(inst: Instantanea, trabajoId: string): { personaId: string; razon: Razon }[] {
  const t = inst.trabajos.find((x) => x.id === trabajoId);
  if (!t) return [];
  const res: { personaId: string; razon: Razon }[] = [];
  const agregar = (personaId: string | null | undefined, razon: Razon) => {
    if (personaId && !res.some((r) => r.personaId === personaId)) res.push({ personaId, razon });
  };
  agregar(inst.proyectos.find((p) => p.id === t.proyectoId)?.responsableId, 'proyecto');
  for (const s of inst.seguimientos) if (s.trabajoId === t.id) for (const p of s.escaladosA) agregar(p, 'escalado');
  agregar(responsableOperacion(inst), 'operacion');
  return res;
}
