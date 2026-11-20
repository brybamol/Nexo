'use server';
// Botones del reloj: +5 min, +30 min y «Siguiente evento». Tarea 1.7.
import { revalidatePath } from 'next/cache';
import { ErrorDominio } from '@/dominio/tipos';
import { avanzarReloj, irAlSiguienteEvento } from '@/servicios/reloj';
import { obtenerContextoApp } from '@/servidor/contexto-app';

/** Máximo que se puede avanzar de una vez: una semana. */
const MAX_MINUTOS = 10_080;

/** Resultado simple: el cliente solo necesita saber si salió bien y, si no, el motivo en español. */
export type ResultadoReloj = { ok: true; error: null } | { ok: false; error: string };

function fallo(e: unknown): ResultadoReloj {
  if (e instanceof ErrorDominio && e.message) return { ok: false, error: e.message };
  console.error('[reloj] error interno', e);
  return { ok: false, error: 'Algo falló al procesar esto. Inténtalo de nuevo.' };
}

export async function avanzar(minutos: number): Promise<ResultadoReloj> {
  if (typeof minutos !== 'number' || !Number.isInteger(minutos) || minutos <= 0 || minutos > MAX_MINUTOS) {
    return { ok: false, error: `Los minutos a avanzar deben ser un entero entre 1 y ${MAX_MINUTOS}.` };
  }
  try {
    const ctx = await obtenerContextoApp();
    await avanzarReloj(ctx, minutos);
    revalidatePath('/', 'layout');
    return { ok: true, error: null };
  } catch (e) {
    return fallo(e);
  }
}

export async function siguienteEvento(): Promise<ResultadoReloj> {
  try {
    const ctx = await obtenerContextoApp();
    await irAlSiguienteEvento(ctx);
    revalidatePath('/', 'layout');
    return { ok: true, error: null };
  } catch (e) {
    return fallo(e);
  }
}
