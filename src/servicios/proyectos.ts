// Resumen y detalle de proyectos (tarea 1.6) y su recorrido como secuencia (rediseño de proyectos).
import type { TrabajoRef } from '@/dominio/nombres';
import type { Persona, Proyecto } from '@/dominio/tipos';
import { nombrador, type Instantanea } from '@/motor/instantanea';
import {
  calcularSecuencia,
  etiquetaDia,
  ordenarPorProximidad,
  proximidad,
  type EstadoEtapa,
  type Proximidad,
} from '@/motor/secuencia';
import type { ContextoServicio } from '@/servicios/contexto';
import { cargarVistasTrabajos } from '@/servicios/consultas-trabajos';
import type { ProyectoDetalle, ResumenProyecto, TrabajoVista } from '@/servicios/vistas';

function resumir(
  proyecto: { id: string; clave: string; nombre: string; fecha: Date | null },
  responsable: Persona,
  trabajos: TrabajoVista[],
): ResumenProyecto {
  const cuenta = (e: TrabajoVista['estado']) => trabajos.filter((t) => t.estado === e).length;
  return {
    id: proyecto.id,
    clave: proyecto.clave,
    nombre: proyecto.nombre,
    responsable: { id: responsable.id, nombre: responsable.nombre, rol: responsable.rol, area: responsable.area },
    fecha: proyecto.fecha,
    total: trabajos.length,
    abiertos: cuenta('abierto'),
    enCurso: cuenta('en_curso'),
    bloqueados: cuenta('bloqueado'),
    resueltos: cuenta('resuelto'),
    atrasados: trabajos.filter((t) => t.marcas.atrasado).length,
    enRiesgo: trabajos.filter((t) => t.marcas.enRiesgo).length,
  };
}

/** Un resumen por proyecto, en el orden de la semilla (P1…P4 y Operación diaria). */
export async function listarProyectos(ctx: ContextoServicio): Promise<ResumenProyecto[]> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  return inst.proyectos.map((p) => {
    const responsable = inst.personas.find((x) => x.id === p.responsableId);
    if (!responsable) throw new Error(`Responsable desconocido en la base: ${p.responsableId}`);
    return resumir(p, responsable, vistas.filter((v) => v.proyecto.id === p.id));
  });
}

/** El resumen más sus trabajos (por plazo ascendente); null si el proyecto no existe. */
export async function obtenerProyecto(ctx: ContextoServicio, id: string): Promise<ProyectoDetalle | null> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  const p = inst.proyectos.find((x) => x.id === id);
  if (!p) return null;
  const responsable = inst.personas.find((x) => x.id === p.responsableId);
  if (!responsable) throw new Error(`Responsable desconocido en la base: ${p.responsableId}`);
  const trabajos = vistas.filter((v) => v.proyecto.id === id);
  return { ...resumir(p, responsable, trabajos), trabajos };
}

// ─── Recorrido: el proyecto como secuencia (motor/secuencia.ts) ────────────────

/** Un trabajo dentro de la secuencia, con lo que espera dentro y fuera del proyecto. */
export interface PasoRecorrido {
  trabajo: TrabajoVista;
  /** Trabajos del mismo proyecto que van antes (dependencias y bloqueo), en el orden de la secuencia. */
  antes: (TrabajoRef & { resuelto: boolean })[];
  /** Trabajos de OTROS proyectos a los que espera, con su proyecto. */
  fuera: (TrabajoRef & { resuelto: boolean; proyecto: { id: string; nombre: string } })[];
  motivoBloqueo: string | null;
}

export interface EtapaRecorrido {
  estado: EstadoEtapa;
  /** 'YYYY-MM-DD' en modo 'dias'. */
  dia: string | null;
  /** «Etapa 3», «Hoy, mié 25 nov» o «Dependencias en círculo». */
  etiqueta: string;
  ciclo: boolean;
  pasos: PasoRecorrido[];
}

export interface ProyectoRecorrido extends ResumenProyecto {
  resultado: string;
  /** Hora del reloj de la demo con la que se calculó. */
  ahora: Date;
  /** Tiene trabajos y todos están resueltos. */
  terminado: boolean;
  proximidad: Proximidad;
  modo: 'etapas' | 'dias';
  etapas: EtapaRecorrido[];
  /** Índice de la etapa actual; null si está vacío o terminado. */
  etapaActual: number | null;
  /** Pasos sin resolver de la etapa actual: dónde va el proyecto. */
  ahoraEn: PasoRecorrido[];
  /** Pasos sin resolver bloqueados, atrasados o en riesgo: bloqueados primero, luego atrasados, luego en riesgo. */
  frenos: PasoRecorrido[];
}

function recorrer(
  p: Proyecto,
  responsable: Persona,
  inst: Instantanea,
  vistas: TrabajoVista[],
  porIdVista: Map<string, TrabajoVista>,
): ProyectoRecorrido {
  const propias = vistas.filter((v) => v.proyecto.id === p.id);
  const resumen = resumir(p, responsable, propias);
  const s = calcularSecuencia(inst, p.id);
  const trabajos = new Map(inst.trabajos.map((t) => [t.id, t]));
  const nombres = nombrador(inst);
  const resuelto = (id: string) => trabajos.get(id)?.estado === 'resuelto';

  const paso = (id: string): PasoRecorrido => {
    const trabajo = porIdVista.get(id);
    if (!trabajo) throw new Error(`Trabajo sin vista: ${id}`);
    return {
      trabajo,
      antes: (s.antes[id] ?? []).map((a) => ({ ...nombres.ref(a), resuelto: resuelto(a) })),
      fuera: (s.fuera[id] ?? []).map((a) => {
        const proyectoId = trabajos.get(a)?.proyectoId ?? '';
        const proyecto = inst.proyectos.find((x) => x.id === proyectoId);
        return { ...nombres.ref(a), resuelto: resuelto(a), proyecto: { id: proyectoId, nombre: proyecto?.nombre ?? 'otro proyecto' } };
      }),
      motivoBloqueo: trabajo.estado === 'bloqueado' ? (trabajos.get(id)?.motivoBloqueo ?? null) : null,
    };
  };

  const etapas: EtapaRecorrido[] = s.etapas.map((e, i) => ({
    estado: e.estado,
    dia: e.dia,
    ciclo: e.ciclo,
    etiqueta: e.ciclo ? 'Dependencias en círculo' : e.dia ? etiquetaDia(e.dia, inst.ahora) : `Etapa ${i + 1}`,
    pasos: e.trabajoIds.map(paso),
  }));

  const pendientes = etapas.flatMap((e) => e.pasos).filter((x) => x.trabajo.estado !== 'resuelto');
  const peso = (x: PasoRecorrido) =>
    x.trabajo.estado === 'bloqueado' ? 0 : x.trabajo.marcas.atrasado ? 1 : x.trabajo.marcas.enRiesgo ? 2 : 3;
  const frenos = pendientes
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => peso(x) < 3)
    .sort((a, b) => peso(a.x) - peso(b.x) || a.i - b.i)
    .map(({ x }) => x);

  return {
    ...resumen,
    resultado: p.resultado,
    ahora: inst.ahora,
    terminado: s.completo,
    proximidad: proximidad(p.fecha, inst.ahora),
    modo: s.modo,
    etapas,
    etapaActual: s.etapaActual,
    ahoraEn: s.etapaActual === null ? [] : (etapas[s.etapaActual]?.pasos ?? []).filter((x) => x.trabajo.estado !== 'resuelto'),
    frenos,
  };
}

function responsableDe(inst: Instantanea, p: Proyecto): Persona {
  const responsable = inst.personas.find((x) => x.id === p.responsableId);
  if (!responsable) throw new Error(`Responsable desconocido en la base: ${p.responsableId}`);
  return responsable;
}

/**
 * Todos los proyectos como recorrido, ordenados por proximidad al reloj de la demo (motor/secuencia.ts,
 * ordenarPorProximidad): activos por fecha (lo vencido delante), luego sin fecha, al final los terminados;
 * a igual fecha, más trabajos frenados primero y después el orden de la semilla.
 */
export async function listarRecorridos(ctx: ContextoServicio): Promise<ProyectoRecorrido[]> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  const porIdVista = new Map(vistas.map((v) => [v.id, v]));
  const recorridos = inst.proyectos.map((p) => recorrer(p, responsableDe(inst, p), inst, vistas, porIdVista));
  return ordenarPorProximidad(
    recorridos.map((r) => ({ id: r.id, fecha: r.fecha, total: r.total, resueltos: r.resueltos, frenados: r.frenos.length, r })),
  ).map((x) => x.r);
}

/** Un proyecto como recorrido; null si no existe. */
export async function obtenerRecorrido(ctx: ContextoServicio, id: string): Promise<ProyectoRecorrido | null> {
  const { inst, vistas } = await cargarVistasTrabajos(ctx.db);
  const p = inst.proyectos.find((x) => x.id === id);
  if (!p) return null;
  return recorrer(p, responsableDe(inst, p), inst, vistas, new Map(vistas.map((v) => [v.id, v])));
}
