'use server';
// Formulario de /preguntar (useActionState). Tarea 4.3.
import { revalidatePath } from 'next/cache';
import { ErrorDominio } from '@/dominio/tipos';
import { preguntar } from '@/servicios/preguntar';
import type { RespuestaPregunta } from '@/servicios/vistas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/** `pregunta` (opcional) es el texto que se envió, para mostrarlo junto a la respuesta. */
export type EstadoFormularioPregunta = { respuesta: RespuestaPregunta | null; error: string | null; pregunta?: string };

const MAX_TEXTO = 1000;

/** Un ejemplo (`ejemplo`, botón con la pregunta escrita) tiene prioridad sobre el campo `texto`. */
function textoDe(formData: FormData): string {
  for (const campo of ['ejemplo', 'texto']) {
    const bruto = formData.get(campo);
    if (typeof bruto === 'string' && bruto.trim()) return bruto.trim();
  }
  return '';
}

export async function accionPreguntar(
  prev: EstadoFormularioPregunta,
  formData: FormData,
): Promise<EstadoFormularioPregunta> {
  const texto = textoDe(formData);
  if (!texto) return { ...prev, error: 'Escribe una pregunta.' };
  if (texto.length > MAX_TEXTO) return { ...prev, error: `La pregunta es muy larga (máximo ${MAX_TEXTO} caracteres).` };
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    const respuesta = await preguntar(ctx, personaId, texto);
    revalidatePath('/', 'layout');
    return { respuesta, error: null, pregunta: texto };
  } catch (e) {
    if (e instanceof ErrorDominio && e.message) return { respuesta: null, error: e.message, pregunta: texto };
    console.error('[preguntar] error interno', e);
    return { respuesta: null, error: 'Algo falló al procesar esto. Inténtalo de nuevo.', pregunta: texto };
  }
}
