// Instantánea del estado y sus índices puros. ARCHIVO DE CONTRATO (§4.0 de docs/05): completo desde la tarea 1.1.
import type {
  Decision,
  Dependencia,
  NecesidadRepuesto,
  Persona,
  Proyecto,
  Repuesto,
  Seguimiento,
  Trabajo,
} from '@/dominio/tipos';

/** Todo lo que el motor necesita para decidir. La carga db/instantanea.ts (1.5); el motor nunca toca la base. */
export interface Instantanea {
  ahora: Date;
  personas: Persona[];
  proyectos: Proyecto[];
  trabajos: Trabajo[];
  dependencias: Dependencia[];
  repuestos: Repuesto[];
  necesidades: NecesidadRepuesto[];
  seguimientos: Seguimiento[];
  decisiones: Decision[];
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

/** 'T31' si el máximo es T30. */
export function siguienteIdTrabajo(inst: Instantanea): string {
  return siguienteId(
    inst.trabajos.map((t) => t.id),
    'T',
    2,
  );
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
