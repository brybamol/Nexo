// Las tres cifras de la demo. Tarea 4.4.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { Cifras } from '@/servicios/vistas';

export async function obtenerCifras(ctx: ContextoServicio): Promise<Cifras> {
  void ctx;
  throw new NoImplementado('servicios/cifras.ts (4.4)');
}
