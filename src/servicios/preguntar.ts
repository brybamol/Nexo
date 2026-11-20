// Preguntas sobre el estado de la empresa (C13). Tarea 4.3.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import type { RespuestaPregunta } from '@/servicios/vistas';

export async function preguntar(ctx: ContextoServicio, personaId: string, texto: string): Promise<RespuestaPregunta> {
  void ctx;
  void personaId;
  void texto;
  throw new NoImplementado('servicios/preguntar.ts (4.3)');
}
