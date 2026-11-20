// Registro de acciones de Nexo. Tarea 4.4.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { AccionVista } from '@/servicios/vistas';

/** Más recientes primero. */
export async function listarAcciones(ctx: ContextoServicio, f?: { limite?: number }): Promise<AccionVista[]> {
  void ctx;
  void f;
  throw new NoImplementado('servicios/registro.ts (4.4)');
}
