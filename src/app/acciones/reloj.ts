'use server';
// Botones del reloj: +5 min, +30 min y «Siguiente evento». Tarea 1.7.
import { revalidatePath } from 'next/cache';
import { avanzarReloj, irAlSiguienteEvento } from '@/servicios/reloj';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import type { ResultadoTick } from '@/servicios/vistas';

export async function avanzar(minutos: number): Promise<ResultadoTick> {
  if (!Number.isFinite(minutos) || minutos <= 0) {
    throw new Error('Los minutos a avanzar deben ser un número positivo.');
  }
  const ctx = await obtenerContextoApp();
  const resultado = await avanzarReloj(ctx, Math.floor(minutos));
  revalidatePath('/', 'layout');
  return resultado;
}

export async function siguienteEvento(): Promise<ResultadoTick> {
  const ctx = await obtenerContextoApp();
  const resultado = await irAlSiguienteEvento(ctx);
  revalidatePath('/', 'layout');
  return resultado;
}
