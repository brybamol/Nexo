// Captura: frase libre → IA → validación → efectos. Tarea 2.3.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { ResultadoCaptura } from '@/servicios/vistas';

const N = 'servicios/captura.ts (2.3)';

export async function capturar(ctx: ContextoServicio, autorId: string, texto: string): Promise<ResultadoCaptura> {
  void ctx;
  void autorId;
  void texto;
  throw new NoImplementado(N);
}

/** Responde la única pregunta que hizo Nexo sobre una captura (R9 o cantidad). */
export async function responderCaptura(
  ctx: ContextoServicio,
  capturaId: number,
  respuesta: string,
): Promise<ResultadoCaptura> {
  void ctx;
  void capturaId;
  void respuesta;
  throw new NoImplementado(N);
}
