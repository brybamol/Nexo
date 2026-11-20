// Contexto de la aplicación (singleton del proceso) y persona actual (cookie). Tarea 1.5.
// Solo servidor: lo usan páginas y server actions, nunca el motor ni los servicios.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';

const N = 'servidor/contexto-app.ts (1.5)';

/** Conexión única (obtenerConexion) + crearInterprete(); carga la semilla si `personas` está vacía. */
export async function obtenerContextoApp(): Promise<ContextoServicio> {
  throw new NoImplementado(N);
}

/** Id de la persona de la cookie COOKIE_PERSONA, o PERSONA_POR_DEFECTO. */
export async function personaActual(): Promise<string> {
  throw new NoImplementado(N);
}
