'use server';
// Selector «ver como»: guarda la cookie nexo_persona. Tarea 1.7.
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { COOKIE_PERSONA } from '@/dominio/constantes';
import { listarPersonas } from '@/servicios/personas';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export async function cambiarPersona(id: string): Promise<void> {
  const ctx = await obtenerContextoApp();
  const personas = await listarPersonas(ctx);
  if (!personas.some((p) => p.id === id)) return; // id desconocido: se ignora
  const almacen = await cookies();
  almacen.set(COOKIE_PERSONA, id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}
