// Desplazamiento de plazos en cadena por días hábiles (§4.2 regla 8). Puro. Tarea 3.3.
import { diasHabilesEntre, sumarDiasHabiles } from '@/dominio/tiempo';
import type { CambioFecha } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Incluye los cambios de `nuevos` (solo los que de verdad cambian el plazo). Cada dependiente no resuelto se
 * mueve los mismos días hábiles que su predecesor más desplazado (conserva la hora). Orden: el de la instantánea.
 */
export function desplazarCadena(inst: Instantanea, nuevos: Map<string, Date>): CambioFecha[] {
  const trabajos = new Map(inst.trabajos.map((t) => [t.id, t]));
  const desplazamiento = new Map<string, number>();
  for (const [id, fecha] of nuevos) {
    const t = trabajos.get(id);
    if (!t || fecha.getTime() <= t.plazo.getTime()) continue;
    desplazamiento.set(id, diasHabilesEntre(t.plazo, fecha));
  }

  // Punto fijo: el desplazamiento de cada dependiente solo crece y está acotado (tolera ciclos).
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const d of inst.dependencias) {
      const dep = trabajos.get(d.trabajoId);
      const previo = desplazamiento.get(d.dependeDeId) ?? 0;
      if (!dep || dep.estado === 'resuelto' || nuevos.has(dep.id) || previo <= 0) continue;
      if (previo > (desplazamiento.get(dep.id) ?? 0)) {
        desplazamiento.set(dep.id, previo);
        cambio = true;
      }
    }
  }

  const res: CambioFecha[] = [];
  for (const t of inst.trabajos) {
    const fijo = nuevos.get(t.id);
    if (fijo) {
      if (fijo.getTime() !== t.plazo.getTime()) res.push({ trabajoId: t.id, de: t.plazo, a: fijo });
      continue;
    }
    const n = desplazamiento.get(t.id) ?? 0;
    if (n > 0) res.push({ trabajoId: t.id, de: t.plazo, a: sumarDiasHabiles(t.plazo, n) });
  }
  return res;
}
