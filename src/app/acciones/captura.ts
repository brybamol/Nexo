'use server';
// Caja de captura (useActionState). Tarea 2.5.
import { NoImplementado } from '@/dominio/tipos';
import type { ResultadoCaptura } from '@/servicios/vistas';

/** Estado del formulario de captura: último resultado o error. */
export type EstadoFormularioCaptura = { resultado: ResultadoCaptura | null; error: string | null };

export async function accionCapturar(
  prev: EstadoFormularioCaptura,
  formData: FormData,
): Promise<EstadoFormularioCaptura> {
  void prev;
  void formData;
  throw new NoImplementado('app/acciones/captura.ts (2.5)');
}

export async function accionResponderCaptura(
  prev: EstadoFormularioCaptura,
  formData: FormData,
): Promise<EstadoFormularioCaptura> {
  void prev;
  void formData;
  throw new NoImplementado('app/acciones/captura.ts (2.5)');
}
