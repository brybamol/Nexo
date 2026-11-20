// Formato para la interfaz. Tarea 1.3.
import { NoImplementado } from '@/dominio/tipos';

const N = 'dominio/formato.ts (1.3)';

/** 1380000 → '₡1.380.000' */
export function formatearColones(n: number): string {
  void n;
  throw new NoImplementado(N);
}

/** 'mié 25 nov, 15:00' (hora de Costa Rica) */
export function formatearFecha(d: Date): string {
  void d;
  throw new NoImplementado(N);
}

/** 205 → '3,4 h' */
export function formatearHoras(min: number): string {
  void min;
  throw new NoImplementado(N);
}
