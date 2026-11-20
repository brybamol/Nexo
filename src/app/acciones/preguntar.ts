'use server';
// Formulario de /preguntar (useActionState). Tarea 4.3.
import { NoImplementado } from '@/dominio/tipos';
import type { RespuestaPregunta } from '@/servicios/vistas';

export type EstadoFormularioPregunta = { respuesta: RespuestaPregunta | null; error: string | null };

export async function accionPreguntar(
  prev: EstadoFormularioPregunta,
  formData: FormData,
): Promise<EstadoFormularioPregunta> {
  void prev;
  void formData;
  throw new NoImplementado('app/acciones/preguntar.ts (4.3)');
}
