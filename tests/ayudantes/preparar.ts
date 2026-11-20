// Ayudantes de prueba (§6 de docs/05). Tarea 1.5.
import { NoImplementado } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';

export interface Demo {
  ctx: ContextoServicio;
  cerrar(): Promise<void>;
}

/** PGlite en memoria, DDL, semilla, intérprete Local y reloj fijado SIN tick a esa hora del mié 25 (por defecto 07:05). */
export async function prepararDemo(opciones?: { hora?: string }): Promise<Demo> {
  void opciones;
  throw new NoImplementado('tests/ayudantes/preparar.ts (1.5)');
}

/** Instantánea de la semilla sin base, para pruebas puras (ahora = mié 25 7:00). */
export function instantaneaDesdeSemilla(): Instantanea {
  throw new NoImplementado('tests/ayudantes/preparar.ts (1.5)');
}
