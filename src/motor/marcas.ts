// Marcas calculadas: atrasado, en riesgo y causas (§4.2 regla 1). Puro. Tarea 2.4.
import type { CausaRiesgo, Marcas, Trabajo } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/**
 * Una entrada por trabajo. Las marcas se calculan siempre y nunca se guardan.
 *
 * Atrasado = no resuelto y `ahora >= plazo` (vence en su minuto exacto).
 * Fuentes de riesgo (trabajo no resuelto): (a) atrasado; (b) bloqueado sin fecha de solución o con fecha > plazo;
 * (c) con una necesidad no atendida de un repuesto con existencia 0 o faltante reportado, salvo que llegue a tiempo.
 * En riesgo = no resuelto ni bloqueado, y fuente (c) o dependiente (transitivo) de una fuente o de otro en riesgo.
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
    const plazo = t.plazo.getTime();
    if (ahora >= plazo) atrasado.add(t.id);
    if (t.estado === 'bloqueado' && (t.fechaSolucion === null || t.fechaSolucion.getTime() > plazo)) bloqueoFuente.add(t.id);
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

  // Predecesores de cada trabajo (ids inexistentes se ignoran).
  const predecesores = new Map<string, string[]>();
  for (const d of inst.dependencias) {
    if (!trabajos.has(d.trabajoId) || !trabajos.has(d.dependeDeId) || d.trabajoId === d.dependeDeId) continue;
    const lista = predecesores.get(d.trabajoId) ?? [];
    if (!lista.includes(d.dependeDeId)) lista.push(d.dependeDeId);
    predecesores.set(d.trabajoId, lista);
  }

  const enRiesgo = new Set<string>();
  const sinResolver = (id: string) => trabajos.get(id)!.estado !== 'resuelto';
  const emite = (p: string) => sinResolver(p) && (atrasado.has(p) || bloqueoFuente.has(p) || enRiesgo.has(p));
  const causasDe = (t: Trabajo): CausaRiesgo[] => {
    const causas: CausaRiesgo[] = [...(causasPropias.get(t.id) ?? [])];
    for (const p of predecesores.get(t.id) ?? []) {
      if (!sinResolver(p)) continue;
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
