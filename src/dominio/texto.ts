// Normalización y similitud de textos. Tarea 1.3.
import { NoImplementado } from '@/dominio/tipos';

const N = 'dominio/texto.ts (1.3)';

/** Minúsculas, sin tildes ni puntuación, espacios simples. */
export function normalizar(s: string): string {
  void s;
  throw new NoImplementado(N);
}

/** Dice de bigramas sobre textos normalizados, 0..1. */
export function similitud(a: string, b: string): number {
  void a;
  void b;
  throw new NoImplementado(N);
}
