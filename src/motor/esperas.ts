// Quién espera a quién (docs/08 regla 23). Puro.
// Sustituye a las cadenas y cuellos de correo/modelo.ts (que retira R9).
import type { CadenaEspera, CuelloBotella, Esperas, Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Cadenas de espera y cuellos de botella sobre `inst` (ya la visible para quien mira).
 *
 * Arista «A espera a B» si A depende de B (`dependencias`) o A está bloqueado por B, los dos sin resolver. Una cadena
 * es un camino máximo (de dos o más trabajos, sin repetir) desde un trabajo al que nadie espera hasta uno que no espera
 * a nadie; si un trabajo espera a varios, sale una cadena por cada camino. Personas: el solicitante del primero (o su
 * responsable si no tiene) y el responsable de cada eslabón, sin repetir seguidas. Proyectos: los de sus trabajos, en
 * orden y sin repetir.
 *
 * Cuello de botella: responsable del último eslabón de cadenas que, juntas, tocan dos o más proyectos y tienen dos o
 * más personas distintas esperando detrás (sin contarse a sí misma). Orden: cadenas por el orden de los trabajos en
 * `inst`; cuellos por su primera cadena.
 */
export function calcularEsperas(inst: Instantanea): Esperas {
  const vivos = new Map(inst.trabajos.filter((t) => t.estado !== 'resuelto').map((t) => [t.id, t]));
  const espera = new Map<string, string[]>();
  const agregar = (a: string, b: string) => {
    if (a === b || !vivos.has(a) || !vivos.has(b)) return;
    const lista = espera.get(a) ?? [];
    if (!lista.includes(b)) lista.push(b);
    espera.set(a, lista);
  };
  for (const d of inst.dependencias) agregar(d.trabajoId, d.dependeDeId);
  for (const t of vivos.values()) if (t.estado === 'bloqueado' && t.bloqueadoPorId) agregar(t.id, t.bloqueadoPorId);

  const esperados = new Set([...espera.values()].flat());
  const caminos: string[][] = [];
  const recorrer = (camino: string[]) => {
    const siguientes = (espera.get(camino.at(-1)!) ?? []).filter((x) => !camino.includes(x));
    if (siguientes.length === 0) {
      if (camino.length >= 2) caminos.push(camino);
      return;
    }
    for (const s of siguientes) recorrer([...camino, s]);
  };
  for (const t of vivos.values()) if (!esperados.has(t.id) && espera.has(t.id)) recorrer([t.id]);

  const cadenas: CadenaEspera[] = caminos.map((ids) => {
    const ts = ids.map((id) => vivos.get(id) as Trabajo);
    const personas = [ts[0]!.solicitadoPorId ?? ts[0]!.responsableId, ...ts.map((t) => t.responsableId)];
    return {
      trabajoIds: ids,
      personaIds: personas.filter((p, i) => p !== personas[i - 1]),
      proyectoIds: [...new Set(ts.map((t) => t.proyectoId))],
    };
  });

  const porFinal = new Map<string, { proyectos: string[]; esperando: string[] }>();
  for (const c of cadenas) {
    const final = vivos.get(c.trabajoIds.at(-1)!)!.responsableId;
    const g = porFinal.get(final) ?? { proyectos: [], esperando: [] };
    for (const p of c.proyectoIds) if (!g.proyectos.includes(p)) g.proyectos.push(p);
    for (const p of c.personaIds) if (p !== final && !g.esperando.includes(p)) g.esperando.push(p);
    porFinal.set(final, g);
  }
  const cuellos: CuelloBotella[] = [...porFinal.entries()]
    .filter(([, g]) => g.proyectos.length >= 2 && g.esperando.length >= 2)
    .map(([personaId, g]) => ({ personaId, proyectoIds: g.proyectos, esperando: g.esperando }));

  return { cadenas, cuellos };
}
