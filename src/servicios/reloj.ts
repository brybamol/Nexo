// Reloj de la demo: la única fuente de «ahora» (tabla reloj). Tarea 1.5.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { ResultadoTick } from '@/servicios/vistas';

const N = 'servicios/reloj.ts (1.5)';

export async function obtenerAhora(ctx: ContextoServicio): Promise<Date> {
  void ctx;
  throw new NoImplementado(N);
}

/** Suma `minutos` al reloj y ejecuta tick. */
export async function avanzarReloj(ctx: ContextoServicio, minutos: number): Promise<ResultadoTick> {
  void ctx;
  void minutos;
  throw new NoImplementado(N);
}

/** Va a siguienteEvento (o +30 min si no hay) y ejecuta tick. */
export async function irAlSiguienteEvento(ctx: ContextoServicio): Promise<ResultadoTick> {
  void ctx;
  throw new NoImplementado(N);
}

/** Solo pruebas; error si retrocede. Ejecuta tick. */
export async function fijarReloj(ctx: ContextoServicio, ahora: Date): Promise<ResultadoTick> {
  void ctx;
  void ahora;
  throw new NoImplementado(N);
}
