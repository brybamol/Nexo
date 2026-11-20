// Personas para el selector «ver como». Tarea 1.5.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { PersonaBreve } from '@/servicios/vistas';

export async function listarPersonas(ctx: ContextoServicio): Promise<PersonaBreve[]> {
  void ctx;
  throw new NoImplementado('servicios/personas.ts (1.5)');
}
