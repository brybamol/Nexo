// Enlace entre hilos y proyectos (docs/06 §7): une cada espera con el compromiso que la resuelve, aunque esté en
// otro hilo y en otro buzón, y agrupa en proyectos los compromisos conectados.
import { normalizar, similitud } from '@/dominio/texto';
import type { Compromiso, EmpresaCorreo, PersonaCorreo } from '@/correo/tipos';

export const UMBRAL_ENLACE = 0.45;
const BONO_ACTOR = 0.25;

function primerNombre(p: PersonaCorreo): string {
  return normalizar(p.nombre.split(' ')[0] ?? p.nombre);
}

function actorCoincide(actor: string, p: PersonaCorreo | undefined): boolean {
  if (!p) return false;
  const a = normalizar(actor);
  return a === normalizar(p.departamento) || a === primerNombre(p);
}

/** Muta `esperaA.compromisoId` de cada compromiso. Sin candidato sobre el umbral queda en null («no lo sé»). */
export function enlazarEsperas(compromisos: Compromiso[], empresa: EmpresaCorreo): void {
  const personas = new Map(empresa.personas.map((p) => [p.id, p]));
  for (const c of compromisos) {
    const espera = c.esperaA;
    if (!espera) continue;
    const otros = compromisos.filter((o) => o.id !== c.id && o.esperaA?.compromisoId !== c.id);
    const pronominal = normalizar(espera.objeto) === '';

    if (pronominal) {
      // «en cuanto Pablo me los envíe»: lo que quien espera le pidió a esa persona.
      const candidato = otros
        .filter((o) => espera.actor !== null && actorCoincide(espera.actor, personas.get(o.responsableId ?? '')))
        .filter((o) => o.solicitanteId === c.responsableId)
        .at(-1);
      espera.compromisoId = candidato?.id ?? null;
      continue;
    }

    let mejor: { id: string; puntaje: number } | null = null;
    for (const o of otros) {
      let puntaje = similitud(espera.objeto, o.titulo);
      if (espera.actor && actorCoincide(espera.actor, personas.get(o.responsableId ?? ''))) puntaje += BONO_ACTOR;
      if (!mejor || puntaje > mejor.puntaje) mejor = { id: o.id, puntaje };
    }
    espera.compromisoId = mejor && mejor.puntaje >= UMBRAL_ENLACE ? mejor.id : null;
  }
}

const PALABRAS_COMUNES = new Set(['re', 'rv', 'fw', 'fwd', 'de', 'del', 'la', 'el', 'en']);

/** Nombres propios del asunto, sin contar la primera palabra: «Cotización cámara fría Hotel Mirador» → Hotel, Mirador. */
export function nombresPropios(asunto: string): string[] {
  return asunto
    .split(/\s+/)
    .slice(1)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((p) => p.length >= 3 && /^\p{Lu}/u.test(p) && !PALABRAS_COMUNES.has(p.toLowerCase()));
}

/** Asigna `proyecto` a cada compromiso: componentes conectados por esperas o por un nombre propio en el asunto. */
export function agruparProyectos(compromisos: Compromiso[]): void {
  const padre = new Map(compromisos.map((c) => [c.id, c.id]));
  const raiz = (id: string): string => {
    let r = id;
    while (padre.get(r) !== r) r = padre.get(r)!;
    padre.set(id, r);
    return r;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(rb, ra);
  };

  const porNombre = new Map<string, string>();
  for (const c of compromisos) {
    if (c.esperaA?.compromisoId && padre.has(c.esperaA.compromisoId)) unir(c.id, c.esperaA.compromisoId);
    for (const n of nombresPropios(c.asunto)) {
      const previo = porNombre.get(n);
      if (previo) unir(c.id, previo);
      else porNombre.set(n, c.id);
    }
  }

  const grupos = new Map<string, Compromiso[]>();
  for (const c of compromisos) {
    const r = raiz(c.id);
    grupos.set(r, [...(grupos.get(r) ?? []), c]);
  }
  for (const grupo of grupos.values()) {
    const cuenta = new Map<string, number>();
    for (const c of grupo) for (const n of new Set(nombresPropios(c.asunto))) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
    const nombre = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? grupo[0]!.asunto;
    for (const c of grupo) c.proyecto = nombre;
  }
}
