// Vista «Mi día» por persona. Tarea 4.1.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { MiDia } from '@/servicios/vistas';

const N = 'servicios/mi-dia.ts (4.1)';

export async function obtenerMiDia(ctx: ContextoServicio, personaId: string): Promise<MiDia> {
  void ctx;
  void personaId;
  throw new NoImplementado(N);
}

export async function marcarAvisosLeidos(ctx: ContextoServicio, personaId: string): Promise<void> {
  void ctx;
  void personaId;
  throw new NoImplementado(N);
}
