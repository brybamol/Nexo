// Instantánea del estado y sus índices puros. ARCHIVO DE CONTRATO (§4.0 de docs/05): completo desde la tarea 1.1.
// Reformas v2 (docs/08 §4, tarea R2): evidencias, descartados, ids de correo y la instantánea visible.
import { PREFIJO_TRABAJO_CORREO } from '@/dominio/constantes';
import { crearNombrador, type Nombrador } from '@/dominio/nombres';
import type {
  Decision,
  Dependencia,
  EvidenciaTrabajo,
  NecesidadRepuesto,
  Persona,
  Proyecto,
  Repuesto,
  Seguimiento,
  Trabajo,
  TrabajoDescartado,
} from '@/dominio/tipos';

/** Todo lo que el motor necesita para decidir. La carga db/instantanea.ts (1.5); el motor nunca toca la base. */
export interface Instantanea {
  ahora: Date;
  personas: Persona[];
  proyectos: Proyecto[];
  /** Propuestos y confirmados; NUNCA los descartados (están en `descartados`). */
  trabajos: Trabajo[];
  /** Sin las filas que tocan a un descartado. */
  dependencias: Dependencia[];
  repuestos: Repuesto[];
  /** Sin las de los descartados. */
  necesidades: NecesidadRepuesto[];
  /** Sin los de los descartados. */
  seguimientos: Seguimiento[];
  decisiones: Decision[];
  /** Todas las evidencias guardadas (también las de los descartados), por id ascendente. */
  evidencias: EvidenciaTrabajo[];
  /** Trabajos descartados: fuera del modelo, pero su id y su número quedan ocupados (regla 16). */
  descartados: TrabajoDescartado[];
}

export function porId<T extends { id: string }>(xs: T[]): Map<string, T> {
  return new Map(xs.map((x) => [x.id, x]));
}

/** Trabajos que dependen directamente de `trabajoId` (filas de `dependencias`), en el orden de la instantánea. */
export function dependientesDirectos(inst: Instantanea, trabajoId: string): string[] {
  const vistos = new Set<string>();
  const res: string[] = [];
  for (const d of inst.dependencias) {
    if (d.dependeDeId === trabajoId && !vistos.has(d.trabajoId)) {
      vistos.add(d.trabajoId);
      res.push(d.trabajoId);
    }
  }
  return res;
}

/** Cadena transitiva de dependientes de `trabajoId`, en orden BFS, sin repetir y sin incluir el propio trabajo. */
export function cadenaDependientes(inst: Instantanea, trabajoId: string): string[] {
  const vistos = new Set<string>([trabajoId]);
  const res: string[] = [];
  const cola: string[] = [trabajoId];
  while (cola.length > 0) {
    const actual = cola.shift() as string;
    for (const dep of dependientesDirectos(inst, actual)) {
      if (!vistos.has(dep)) {
        vistos.add(dep);
        res.push(dep);
        cola.push(dep);
      }
    }
  }
  return res;
}

function siguienteId(ids: string[], prefijo: string, ancho: number): string {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefijo)) continue;
    const n = Number(id.slice(prefijo.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return prefijo + String(max + 1).padStart(ancho, '0');
}

/** Ids de todos los trabajos, también los descartados (un id nunca se reutiliza). */
function idsTrabajos(inst: Instantanea): string[] {
  return [...inst.trabajos.map((t) => t.id), ...inst.descartados.map((t) => t.id)];
}

/** 'T31' si el máximo es T30. Cuenta también los descartados. */
export function siguienteIdTrabajo(inst: Instantanea): string {
  return siguienteId(idsTrabajos(inst), 'T', 2);
}

/** Trabajos nacidos del correo: 'M01', 'M02'… (prefijo propio: no consume T31). Cuenta también los descartados. */
export function siguienteIdTrabajoCorreo(inst: Instantanea): string {
  return siguienteId(idsTrabajos(inst), PREFIJO_TRABAJO_CORREO, 2);
}

/** 'D01', 'D02'… */
export function siguienteIdDecision(inst: Instantanea): string {
  return siguienteId(
    inst.decisiones.map((d) => d.id),
    'D',
    2,
  );
}

/** 'S1', 'S2'… */
export function siguienteIdSeguimiento(inst: Instantanea): string {
  return siguienteId(
    inst.seguimientos.map((s) => s.id),
    'S',
    1,
  );
}

/**
 * Número del próximo trabajo de `proyectoId` (máximo del proyecto + 1). Se calcula en la misma transacción que lo crea.
 * Cuenta también los descartados: su número queda ocupado (regla 16). Sirve igual para los trabajos del correo.
 */
export function siguienteNumeroTrabajo(inst: Instantanea, proyectoId: string): number {
  const numeros = [...inst.trabajos, ...inst.descartados].filter((t) => t.proyectoId === proyectoId).map((t) => t.numero ?? 0);
  return Math.max(0, ...numeros) + 1;
}

/** Número de la próxima decisión de `proyectoId`: COLINA-D1, COLINA-D2… */
export function siguienteNumeroDecision(inst: Instantanea, proyectoId: string): number {
  return Math.max(0, ...inst.decisiones.filter((d) => d.proyectoId === proyectoId).map((d) => d.numero ?? 0)) + 1;
}

/** Cómo se nombran ante las personas los trabajos y decisiones de esta instantánea (dominio/nombres.ts). */
export function nombrador(inst: Instantanea): Nombrador {
  return crearNombrador(inst);
}

// ─── Visibilidad (docs/08 regla 18) ───────────────────────────────────────────
// Viven aquí porque son parte del contrato de la instantánea; motor/confianza.ts las reexporta.

/**
 * ¿Ve `personaId` el trabajo? Confirmado → todos; propuesto → solo su dueño; descartado → nadie.
 * `personaId = null` es la vista general (listados, proyectos, Preguntar, IA): solo confirmados.
 */
export function visiblePara(t: Pick<Trabajo, 'confirmacion' | 'duenoPropuestaId'>, personaId: string | null): boolean {
  if (t.confirmacion === 'confirmado') return true;
  if (t.confirmacion === 'propuesto') return personaId !== null && t.duenoPropuestaId === personaId;
  return false;
}

/**
 * La instantánea tal como la ve `personaId` (null = vista general, sin propuestos): quita los trabajos que no ve y
 * todo lo que cuelga de ellos (dependencias con cualquiera de sus dos extremos ocultos, necesidades, seguimientos y
 * evidencias; también las evidencias de los descartados). Personas, proyectos, repuestos, decisiones y `descartados`
 * (solo id y número) no cambian. Pura: devuelve una copia superficial y no modifica `inst`.
 * Es para LEER (vistas y marcas): las mutaciones calculan siempre sobre la instantánea completa.
 */
export function instantaneaVisible(inst: Instantanea, personaId: string | null): Instantanea {
  const ocultos = new Set([
    ...inst.trabajos.filter((t) => !visiblePara(t, personaId)).map((t) => t.id),
    ...inst.descartados.map((t) => t.id),
  ]);
  return {
    ...inst,
    trabajos: inst.trabajos.filter((t) => !ocultos.has(t.id)),
    dependencias: inst.dependencias.filter((d) => !ocultos.has(d.trabajoId) && !ocultos.has(d.dependeDeId)),
    necesidades: inst.necesidades.filter((n) => !ocultos.has(n.trabajoId)),
    seguimientos: inst.seguimientos.filter((s) => !ocultos.has(s.trabajoId)),
    evidencias: inst.evidencias.filter((e) => !ocultos.has(e.trabajoId)),
  };
}
