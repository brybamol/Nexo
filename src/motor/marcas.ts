// Marcas calculadas: atrasado, en riesgo y causas (§4.2 regla 1). Puro. Tarea 2.4; reglas 15 y 21 de docs/08 (R3).
import type { CausaRiesgo, Marcas, Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/** Regla 21: no resuelto, `ahora >= plazo` y sin una entrega hecha a tiempo (`entrega.en <= plazo`). */
function estaAtrasado(t: Trabajo, ahora: number): boolean {
  if (t.estado === 'resuelto' || ahora < t.plazo.getTime()) return false;
  return !(t.entrega !== null && t.entrega.en.getTime() <= t.plazo.getTime());
}

/**
 * Una entrada por trabajo. Las marcas se calculan siempre y nunca se guardan.
 *
 * Atrasado = no resuelto, `ahora >= plazo` (vence en su minuto exacto) y sin entrega a tiempo (regla 21).
 * Fuentes de riesgo (trabajo no resuelto): (a) atrasado; (b) bloqueado sin fecha de solución o con fecha > plazo;
 * (c) con una necesidad no atendida de un repuesto con existencia 0 o faltante reportado, salvo que llegue a tiempo.
 * En riesgo = no resuelto ni bloqueado, y fuente (c) o dependiente (transitivo) de una fuente o de otro en riesgo.
 * Reformas v2: un trabajo entregado no es fuente de riesgo para sus dependientes (regla 21), y las aristas de un
 * propuesto hacia un confirmado se ignoran (regla 15: el propuesto sí recibe las marcas de sus predecesores).
 */
export function calcularMarcas(inst: Instantanea): Map<string, Marcas> {
  const ahora = inst.ahora.getTime();
  const trabajos = new Map<string, Trabajo>(inst.trabajos.map((t) => [t.id, t]));
  const repuestos = new Map(inst.repuestos.map((r) => [r.id, r]));

  const atrasado = new Set<string>();
  const bloqueoFuente = new Set<string>();
  const causasPropias = new Map<string, CausaRiesgo[]>(); // fuente (c): repuesto
  for (const t of inst.trabajos) {
    if (t.estado === 'resuelto') continue;
    if (estaAtrasado(t, ahora)) atrasado.add(t.id);
    if (t.estado === 'bloqueado' && (t.fechaSolucion === null || t.fechaSolucion.getTime() > t.plazo.getTime())) bloqueoFuente.add(t.id);
  }
  for (const n of inst.necesidades) {
    const t = trabajos.get(n.trabajoId);
    const r = repuestos.get(n.repuestoId);
    if (!t || !r || t.estado === 'resuelto' || n.atendida) continue;
    if (!(r.existencia <= 0 || r.faltanteReportadoEn !== null)) continue;
    if (n.fechaDisponible !== null && n.fechaDisponible.getTime() <= t.plazo.getTime()) continue;
    const lista = causasPropias.get(t.id) ?? [];
    lista.push({ tipo: 'repuesto', repuestoId: n.repuestoId });
    causasPropias.set(t.id, lista);
  }

  // Predecesores de cada trabajo (ids inexistentes se ignoran; también las aristas propuesto → confirmado).
  const predecesores = new Map<string, string[]>();
  for (const d of inst.dependencias) {
    const dependiente = trabajos.get(d.trabajoId);
    const predecesor = trabajos.get(d.dependeDeId);
    if (!dependiente || !predecesor || d.trabajoId === d.dependeDeId) continue;
    if (predecesor.confirmacion !== 'confirmado' && dependiente.confirmacion === 'confirmado') continue;
    const lista = predecesores.get(d.trabajoId) ?? [];
    if (!lista.includes(d.dependeDeId)) lista.push(d.dependeDeId);
    predecesores.set(d.trabajoId, lista);
  }

  const enRiesgo = new Set<string>();
  // Un predecesor emite riesgo si no está resuelto ni entregado (regla 21) y es fuente o está en riesgo.
  const emiteRiesgo = (id: string) => {
    const p = trabajos.get(id)!;
    return p.estado !== 'resuelto' && p.entrega === null;
  };
  const emite = (p: string) => emiteRiesgo(p) && (atrasado.has(p) || bloqueoFuente.has(p) || enRiesgo.has(p));
  const causasDe = (t: Trabajo): CausaRiesgo[] => {
    const causas: CausaRiesgo[] = [...(causasPropias.get(t.id) ?? [])];
    for (const p of predecesores.get(t.id) ?? []) {
      if (!emiteRiesgo(p)) continue;
      if (atrasado.has(p)) causas.push({ tipo: 'atrasado', trabajoId: p });
      if (bloqueoFuente.has(p)) causas.push({ tipo: 'bloqueado', trabajoId: p });
      if (enRiesgo.has(p)) causas.push({ tipo: 'cadena', trabajoId: p });
    }
    return causas;
  };

  // Punto fijo: termina porque `enRiesgo` solo crece y es finito (tolera ciclos).
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const t of inst.trabajos) {
      if (enRiesgo.has(t.id) || t.estado === 'resuelto' || t.estado === 'bloqueado') continue;
      const origen = causasPropias.has(t.id) || (predecesores.get(t.id) ?? []).some(emite);
      if (origen) {
        enRiesgo.add(t.id);
        cambio = true;
      }
    }
  }

  const res = new Map<string, Marcas>();
  for (const t of inst.trabajos) {
    const esRiesgo = enRiesgo.has(t.id);
    res.set(t.id, { atrasado: atrasado.has(t.id), enRiesgo: esRiesgo, causas: esRiesgo ? causasDe(t) : [] });
  }
  return res;
}
