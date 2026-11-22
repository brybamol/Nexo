// Secuencia de un proyecto (en qué orden ocurren sus trabajos) y orden de proyectos por proximidad. Puro y determinista:
// sin base, sin red, sin hora real (el «ahora» viene de la instantánea o de quien llama).
//
// Reglas de etapas (modo 'etapas'):
//  - Un trabajo espera a otro del MISMO proyecto si depende de él (tabla dependencias) o si está bloqueado por él.
//  - Etapa de un trabajo = 1 + la etapa más alta de lo que espera (lo más pronto posible). Lo que comparte etapa puede ir
//    a la vez.
//  - Un trabajo que no espera a nadie pero del que otros esperan se coloca justo antes del primero que lo espera (lo más
//    tarde posible): así «Conseguir el compresor» aparece junto antes de la instalación, no junto a la visita técnica.
//  - Un trabajo suelto (nadie espera de él y él no espera a nadie) va por su plazo: en la última etapa cuyo plazo más
//    temprano ya llegó a ese plazo (o en la primera).
//  - Dentro de una etapa: plazo, luego número del trabajo, luego id.
//  - Esperas hacia trabajos de OTRO proyecto no mueven las etapas: se informan en `fuera`. Las que apuntan a trabajos
//    inexistentes se ignoran.
//  - Ciclos: lo que queda atrapado en un ciclo va en una etapa final marcada `ciclo`, en el orden de arriba.
// Modo 'dias': si menos de la mitad de los trabajos espera a otro del proyecto, la secuencia es temporal: una etapa por
// día de calendario de Costa Rica del plazo.
// Etapa actual: en 'etapas', la primera que no está hecha; en 'dias', la de hoy si tiene algo pendiente, si no la primera
// pendiente desde hoy y, si todo lo pendiente ya venció, la última pendiente. Una etapa pendiente anterior a la actual
// está «rezagada».
import { partesCR } from '@/dominio/tiempo';
import type { Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

export type EstadoEtapa = 'hecha' | 'rezagada' | 'actual' | 'pendiente';

export interface EtapaSecuencia {
  trabajoIds: string[];
  estado: EstadoEtapa;
  /** 'YYYY-MM-DD' (Costa Rica) en modo 'dias'; null en modo 'etapas'. */
  dia: string | null;
  /** true solo en la etapa final con trabajos atrapados en un ciclo de dependencias. */
  ciclo: boolean;
}

export interface Secuencia {
  modo: 'etapas' | 'dias';
  etapas: EtapaSecuencia[];
  /** Índice (desde 0) de la etapa actual; null si el proyecto está vacío o todo está resuelto. */
  etapaActual: number | null;
  completo: boolean;
  hechos: number;
  total: number;
  /** Por trabajo: trabajos del mismo proyecto a los que espera (dependencias y bloqueo), en el orden de la secuencia. */
  antes: Record<string, string[]>;
  /** Por trabajo: trabajos de otros proyectos a los que espera (dependencias y bloqueo). */
  fuera: Record<string, string[]>;
}

function comparar(a: Trabajo, b: Trabajo): number {
  return a.plazo.getTime() - b.plazo.getTime() || (a.numero ?? 0) - (b.numero ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function calcularSecuencia(inst: Instantanea, proyectoId: string): Secuencia {
  const propios = inst.trabajos.filter((t) => t.proyectoId === proyectoId).sort(comparar);
  const todos = new Map(inst.trabajos.map((t) => [t.id, t]));
  const propiosIds = new Set(propios.map((t) => t.id));

  // Esperas de cada trabajo, sin repetir.
  const antesSet = new Map<string, Set<string>>(propios.map((t) => [t.id, new Set<string>()]));
  const fueraSet = new Map<string, Set<string>>(propios.map((t) => [t.id, new Set<string>()]));
  const anotar = (trabajoId: string, otroId: string) => {
    if (otroId === trabajoId || !todos.has(otroId)) return;
    (propiosIds.has(otroId) ? antesSet : fueraSet).get(trabajoId)?.add(otroId);
  };
  for (const d of inst.dependencias) if (propiosIds.has(d.trabajoId)) anotar(d.trabajoId, d.dependeDeId);
  for (const t of propios) if (t.bloqueadoPorId) anotar(t.id, t.bloqueadoPorId);

  const despues = new Map<string, string[]>(propios.map((t) => [t.id, []]));
  for (const t of propios) for (const a of antesSet.get(t.id) ?? []) despues.get(a)?.push(t.id);

  const conEspera = propios.filter((t) => (antesSet.get(t.id)?.size ?? 0) > 0).length;
  const modo: Secuencia['modo'] = propios.length > 0 && conEspera * 2 < propios.length ? 'dias' : 'etapas';

  const grupos: { ids: Trabajo[]; dia: string | null; ciclo: boolean }[] =
    modo === 'dias' ? porDia(propios) : porEtapas(propios, antesSet, despues);

  // Orden global (para ordenar las esperas por secuencia).
  const posicion = new Map<string, number>();
  grupos.forEach((g, i) => g.ids.forEach((t, j) => posicion.set(t.id, i * 10_000 + j)));
  const porPosicion = (xs: Iterable<string>) => [...xs].sort((a, b) => (posicion.get(a) ?? 0) - (posicion.get(b) ?? 0));
  const porTrabajo = (xs: Iterable<string>) =>
    [...xs].sort((a, b) => comparar(todos.get(a) as Trabajo, todos.get(b) as Trabajo));

  const hechaGrupo = (g: { ids: Trabajo[] }) => g.ids.every((t) => t.estado === 'resuelto');
  const etapaActual = modo === 'dias' ? actualPorDia(grupos, inst.ahora, hechaGrupo) : actualPorEtapas(grupos, hechaGrupo);

  const etapas: EtapaSecuencia[] = grupos.map((g, i) => ({
    trabajoIds: g.ids.map((t) => t.id),
    dia: g.dia,
    ciclo: g.ciclo,
    estado: hechaGrupo(g)
      ? 'hecha'
      : etapaActual === null
        ? 'pendiente'
        : i === etapaActual
          ? 'actual'
          : i < etapaActual
            ? 'rezagada'
            : 'pendiente',
  }));

  const hechos = propios.filter((t) => t.estado === 'resuelto').length;
  return {
    modo,
    etapas,
    etapaActual,
    completo: propios.length > 0 && hechos === propios.length,
    hechos,
    total: propios.length,
    antes: Object.fromEntries(propios.map((t) => [t.id, porPosicion(antesSet.get(t.id) ?? [])])),
    fuera: Object.fromEntries(propios.map((t) => [t.id, porTrabajo(fueraSet.get(t.id) ?? [])])),
  };
}

function porDia(propios: Trabajo[]): { ids: Trabajo[]; dia: string | null; ciclo: boolean }[] {
  const dias = new Map<string, Trabajo[]>();
  for (const t of propios) {
    const dia = partesCR(t.plazo).fecha;
    const lista = dias.get(dia) ?? [];
    lista.push(t);
    dias.set(dia, lista);
  }
  return [...dias.keys()].sort().map((dia) => ({ ids: dias.get(dia) as Trabajo[], dia, ciclo: false }));
}

function porEtapas(
  propios: Trabajo[],
  antes: Map<string, Set<string>>,
  despues: Map<string, string[]>,
): { ids: Trabajo[]; dia: string | null; ciclo: boolean }[] {
  // Kahn por niveles: etapa = 1 + máxima etapa de lo que espera.
  const etapa = new Map<string, number>();
  const faltan = new Map(propios.map((t) => [t.id, antes.get(t.id)?.size ?? 0]));
  let frente = propios.filter((t) => faltan.get(t.id) === 0).map((t) => t.id);
  while (frente.length > 0) {
    const siguiente: string[] = [];
    for (const id of frente) {
      const nivel = Math.max(0, ...[...(antes.get(id) ?? [])].map((a) => (etapa.get(a) ?? -1) + 1));
      etapa.set(id, nivel);
      for (const d of despues.get(id) ?? []) {
        const n = (faltan.get(d) ?? 0) - 1;
        faltan.set(d, n);
        if (n === 0) siguiente.push(d);
      }
    }
    frente = siguiente;
  }

  // Fuentes con sucesores ya colocados: justo antes del primero que las espera.
  for (const t of propios) {
    if ((antes.get(t.id)?.size ?? 0) > 0 || !etapa.has(t.id)) continue;
    const sucesores = (despues.get(t.id) ?? []).map((d) => etapa.get(d)).filter((n): n is number => n !== undefined);
    if (sucesores.length > 0) etapa.set(t.id, Math.min(...sucesores) - 1);
  }

  // Sueltos: por plazo, en la última etapa cuyo plazo más temprano ya llegó al suyo.
  const sueltos = new Set(
    propios.filter((t) => (antes.get(t.id)?.size ?? 0) === 0 && (despues.get(t.id) ?? []).length === 0).map((t) => t.id),
  );
  const minimo = new Map<number, number>();
  for (const t of propios) {
    const n = etapa.get(t.id);
    if (n === undefined || sueltos.has(t.id)) continue;
    minimo.set(n, Math.min(minimo.get(n) ?? Infinity, t.plazo.getTime()));
  }
  for (const t of propios) {
    if (!sueltos.has(t.id)) continue;
    let destino = 0;
    for (const [n, m] of minimo) if (m <= t.plazo.getTime() && n > destino) destino = n;
    etapa.set(t.id, destino);
  }

  const niveles = [...new Set(etapa.values())].sort((a, b) => a - b);
  const grupos = niveles.map((n) => ({ ids: propios.filter((t) => etapa.get(t.id) === n), dia: null, ciclo: false }));
  const atrapados = propios.filter((t) => !etapa.has(t.id));
  if (atrapados.length > 0) grupos.push({ ids: atrapados, dia: null, ciclo: true });
  return grupos;
}

function actualPorEtapas(grupos: { ids: Trabajo[] }[], hecha: (g: { ids: Trabajo[] }) => boolean): number | null {
  const i = grupos.findIndex((g) => !hecha(g));
  return i < 0 ? null : i;
}

function actualPorDia(
  grupos: { ids: Trabajo[]; dia: string | null }[],
  ahora: Date,
  hecha: (g: { ids: Trabajo[] }) => boolean,
): number | null {
  const hoy = partesCR(ahora).fecha;
  const desdeHoy = grupos.findIndex((g) => (g.dia ?? '') >= hoy && !hecha(g));
  if (desdeHoy >= 0) return desdeHoy;
  for (let i = grupos.length - 1; i >= 0; i -= 1) if (!hecha(grupos[i] as { ids: Trabajo[] })) return i;
  return null;
}

// ─── Proximidad de una fecha ──────────────────────────────────────────────────

export interface Proximidad {
  /** Días de calendario (Costa Rica) desde hoy hasta la fecha; negativo si ya pasó; null sin fecha. */
  dias: number | null;
  vencido: boolean;
  /** «vence hoy», «vence mañana», «vence en 2 días», «venció ayer», «venció hace 3 días», «sin fecha». */
  texto: string;
}

const MS_DIA = 86_400_000;

function diaJuliano(fecha: string): number {
  return Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / MS_DIA;
}

export function proximidad(fecha: Date | null, ahora: Date): Proximidad {
  if (!fecha) return { dias: null, vencido: false, texto: 'sin fecha' };
  const dias = diaJuliano(partesCR(fecha).fecha) - diaJuliano(partesCR(ahora).fecha);
  const vencido = fecha.getTime() < ahora.getTime();
  let texto: string;
  if (dias === 0) texto = vencido ? 'venció hoy' : 'vence hoy';
  else if (dias === 1) texto = 'vence mañana';
  else if (dias > 1) texto = `vence en ${dias} días`;
  else if (dias === -1) texto = 'venció ayer';
  else texto = `venció hace ${-dias} días`;
  return { dias, vencido, texto };
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-11-25' con hoy = mié 25 → 'Hoy, mié 25 nov'; también 'Ayer, …' y 'Mañana, …'; el resto 'lun 23 nov'. */
export function etiquetaDia(dia: string, ahora: Date): string {
  const semana = new Date(Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10))).getUTCDay();
  const base = `${DIAS[semana]} ${Number(dia.slice(8, 10))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;
  const diferencia = diaJuliano(dia) - diaJuliano(partesCR(ahora).fecha);
  if (diferencia === 0) return `Hoy, ${base}`;
  if (diferencia === -1) return `Ayer, ${base}`;
  if (diferencia === 1) return `Mañana, ${base}`;
  return base;
}

// ─── Orden de proyectos por proximidad ────────────────────────────────────────

export interface ProyectoOrdenable {
  id: string;
  fecha: Date | null;
  total: number;
  resueltos: number;
  /** Trabajos sin resolver que están bloqueados, atrasados o en riesgo (cada uno cuenta una vez). */
  frenados: number;
}

/**
 * Primero los proyectos activos con fecha, de la más temprana a la más tardía (lo vencido queda delante); luego los
 * activos sin fecha (incluidos los vacíos); al final los terminados (todos sus trabajos resueltos), por fecha.
 * Desempate: más trabajos frenados primero; después, el orden de entrada. No muta la lista.
 */
export function ordenarPorProximidad<T extends ProyectoOrdenable>(proyectos: readonly T[]): T[] {
  const grupo = (p: T) => (p.total > 0 && p.resueltos === p.total ? 2 : p.fecha ? 0 : 1);
  const tiempo = (p: T) => p.fecha?.getTime() ?? Infinity;
  return proyectos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => grupo(a.p) - grupo(b.p) || tiempo(a.p) - tiempo(b.p) || b.p.frenados - a.p.frenados || a.i - b.i)
    .map((x) => x.p);
}
