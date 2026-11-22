// Cuánto se equivoca Nexo (docs/08 regla 22). Puro. Tarea R6b.
//
// Universo: los trabajos inferidos del correo (origen 'correo', también los descartados) y las capturas con pregunta de
// responsable respondida (revisiones de origen 'captura'). De cada uno cuenta solo su PRIMERA revisión humana.
//   revisadas = confirmadas + corregidas + descartadas
//   tasa      = revisadas = 0 ? null : round(100 × (corregidas + descartadas) / revisadas)
// Aparte: porCampo (cuántas corregidas cambiaron cada campo; una corrección suma en varios), confirmadasPorFuentes
// (confirmados por dos buzones sin revisión humana) y sinRevisar (propuestos vivos).
import type { CampoCorregible, CasoCorreccion, Confirmacion, RevisionPropuesta, TasaCorreccion } from '@/dominio/tipos';

/** De qué propuesta es una revisión: el trabajo (correo) o la captura (captura). */
function claveDe(r: RevisionPropuesta): string {
  if (r.origen === 'captura') return r.capturaId !== null ? `c:${r.capturaId}` : `t:${r.trabajoId ?? ''}`;
  return r.trabajoId !== null ? `t:${r.trabajoId}` : `c:${r.capturaId ?? ''}`;
}

const antes = (a: RevisionPropuesta, b: RevisionPropuesta) => a.en.getTime() - b.en.getTime() || a.id - b.id;

/** La primera revisión humana de cada propuesta, en orden (en, id). */
export function primerasRevisiones(revisiones: RevisionPropuesta[]): RevisionPropuesta[] {
  const vistas = new Set<string>();
  const primeras: RevisionPropuesta[] = [];
  for (const r of [...revisiones].sort(antes)) {
    const clave = claveDe(r);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    primeras.push(r);
  }
  return primeras;
}

/**
 * Regla 22. `revisiones`: todas (de correo y de captura); cuenta solo la PRIMERA revisión humana de cada trabajo o
 * captura. `inferidos`: los trabajos de origen correo (también los descartados).
 */
export function calcularTasaCorreccion(
  revisiones: RevisionPropuesta[],
  inferidos: { id: string; confirmacion: Confirmacion; confirmadoPorId: string | null }[],
): TasaCorreccion {
  const primeras = primerasRevisiones(revisiones);
  const porCampo: Record<CampoCorregible, number> = { titulo: 0, responsable: 0, plazo: 0, proyecto: 0 };
  let confirmadas = 0;
  let corregidas = 0;
  let descartadas = 0;
  for (const r of primeras) {
    if (r.resultado === 'confirmada') confirmadas++;
    else if (r.resultado === 'descartada') descartadas++;
    else {
      corregidas++;
      for (const c of new Set(r.campos)) porCampo[c]++;
    }
  }
  const revisados = new Set(primeras.flatMap((r) => (r.trabajoId !== null ? [r.trabajoId] : [])));
  const confirmadasPorFuentes = inferidos.filter(
    (t) => t.confirmacion === 'confirmado' && t.confirmadoPorId === null && !revisados.has(t.id),
  ).length;
  const sinRevisar = inferidos.filter((t) => t.confirmacion === 'propuesto').length;
  const revisadas = confirmadas + corregidas + descartadas;
  return {
    inferidos: inferidos.length,
    revisadas,
    confirmadas,
    corregidas,
    descartadas,
    porCampo,
    confirmadasPorFuentes,
    sinRevisar,
    tasa: revisadas === 0 ? null : Math.round((100 * (corregidas + descartadas)) / revisadas),
  };
}

/** Caso de prueba: `{ entrada, propuesto, esperado: final, resultado }`. */
export function casoDePrueba(r: RevisionPropuesta): CasoCorreccion {
  return {
    entrada: structuredClone(r.entrada),
    propuesto: structuredClone(r.propuesto),
    esperado: r.final === null ? null : structuredClone(r.final),
    resultado: r.resultado,
  };
}
