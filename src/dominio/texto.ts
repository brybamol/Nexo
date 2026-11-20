// Normalización y similitud de textos. Tarea 1.3.

/** Minúsculas, sin tildes ni puntuación, espacios simples. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice de bigramas sobre textos normalizados, 0..1. */
export function similitud(a: string, b: string): number {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bx = bigramas(x);
  const by = bigramas(y);
  let comunes = 0;
  for (const [g, n] of bx) comunes += Math.min(n, by.get(g) ?? 0);
  return (2 * comunes) / (x.length - 1 + (y.length - 1));
}
