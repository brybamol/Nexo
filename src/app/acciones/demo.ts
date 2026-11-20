'use server';
// Botón «Reiniciar demo». Tarea 1.7.
import { revalidatePath } from 'next/cache';
import { reiniciarDemo } from '@/servicios/demo';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export async function reiniciar(): Promise<void> {
  const ctx = await obtenerContextoApp();
  await reiniciarDemo(ctx);
  revalidatePath('/', 'layout');
}
