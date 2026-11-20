// Respuestas a seguimientos y cambios de estado desde la interfaz. Tarea 3.4.
import { NoImplementado, type EstadoTrabajo } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';

const N = 'servicios/estado-trabajos.ts (3.4)';

export async function responderSeguimiento(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  r: { estado?: EstadoTrabajo; nota?: string },
): Promise<void> {
  void ctx;
  void trabajoId;
  void personaId;
  void r;
  throw new NoImplementado(N);
}

export async function cambiarEstado(
  ctx: ContextoServicio,
  trabajoId: string,
  personaId: string,
  estado: EstadoTrabajo,
): Promise<void> {
  void ctx;
  void trabajoId;
  void personaId;
  void estado;
  throw new NoImplementado(N);
}
