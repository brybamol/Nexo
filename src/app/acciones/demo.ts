'use server';
// Botón «Reiniciar demo». Tarea 1.7.
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ErrorDominio } from '@/dominio/tipos';
import { reiniciarDemo } from '@/servicios/demo';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import type { ResultadoReloj } from './reloj';

export async function reiniciar(): Promise<ResultadoReloj> {
  try {
    const ctx = await obtenerContextoApp();
    await reiniciarDemo(ctx);
    // Contador de reinicios: el layout lo usa en la `key` del panel de Nexo para limpiar su hilo.
    const almacen = await cookies();
    const anterior = Number(almacen.get('nexo-reinicio')?.value ?? '0');
    almacen.set('nexo-reinicio', String((Number.isFinite(anterior) ? anterior : 0) + 1), { path: '/', sameSite: 'lax' });
    revalidatePath('/', 'layout');
    return { ok: true, error: null };
  } catch (e) {
    if (e instanceof ErrorDominio && e.message) return { ok: false, error: e.message };
    console.error('[demo] error interno al reiniciar', e);
    return { ok: false, error: 'Algo falló al procesar esto. Inténtalo de nuevo.' };
  }
}
