// Consultas de trabajos con marcas calculadas. Tarea 1.6.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { TrabajoVista } from '@/servicios/vistas';

const N = 'servicios/consultas-trabajos.ts (1.6)';

export async function obtenerTrabajo(ctx: ContextoServicio, id: string): Promise<TrabajoVista | null> {
  void ctx;
  void id;
  throw new NoImplementado(N);
}

export async function listarTrabajos(
  ctx: ContextoServicio,
  f?: { proyectoId?: string; responsableId?: string },
): Promise<TrabajoVista[]> {
  void ctx;
  void f;
  throw new NoImplementado(N);
}
