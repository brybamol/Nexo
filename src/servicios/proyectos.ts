// Resumen y detalle de proyectos. Tarea 1.6.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { ProyectoDetalle, ResumenProyecto } from '@/servicios/vistas';

const N = 'servicios/proyectos.ts (1.6)';

export async function listarProyectos(ctx: ContextoServicio): Promise<ResumenProyecto[]> {
  void ctx;
  throw new NoImplementado(N);
}

export async function obtenerProyecto(ctx: ContextoServicio, id: string): Promise<ProyectoDetalle | null> {
  void ctx;
  void id;
  throw new NoImplementado(N);
}
