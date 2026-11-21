'use server';
// Confirmar, corregir o descartar un compromiso extraído del correo (docs/06 §10).
import { revalidatePath } from 'next/cache';
import type { CambiosCorreccion, TipoCorreccion } from '@/correo/tipos';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type EstadoTrabajo } from '@/dominio/tipos';
import { registrarCorreccion } from '@/servicios/correo';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export type ResultadoCorreccion = { ok: boolean; error: string | null };

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Campos: `como` (persona de Grupo Altavista), `compromisoId`, `tipo` (confirmar | corregir | descartar) y, para
 * corregir, `titulo`, `responsableId`, `plazo` (AAAA-MM-DDTHH:MM, hora de Costa Rica) y `estado`.
 */
export async function accionRevisarCompromiso(formData: FormData): Promise<ResultadoCorreccion> {
  const tipo = texto(formData, 'tipo') as TipoCorreccion;
  const plazoTexto = texto(formData, 'plazo');
  const cambios: CambiosCorreccion = {};
  if (tipo === 'corregir') {
    const titulo = texto(formData, 'titulo');
    const responsableId = texto(formData, 'responsableId');
    const estado = texto(formData, 'estado');
    if (titulo) cambios.titulo = titulo;
    if (responsableId) cambios.responsableId = responsableId;
    if (estado) cambios.estado = estado as EstadoTrabajo;
    if (plazoTexto) {
      const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(plazoTexto);
      if (!m) return { ok: false, error: 'El plazo debe tener fecha y hora.' };
      cambios.plazo = enCR(m[1]!, m[2]!).toISOString();
    }
  }
  try {
    const ctx = await obtenerContextoApp();
    await registrarCorreccion(ctx, {
      compromisoId: texto(formData, 'compromisoId'),
      personaId: texto(formData, 'como'),
      tipo,
      cambios,
    });
  } catch (e) {
    if (e instanceof ErrorDominio) return { ok: false, error: e.message };
    return { ok: false, error: 'No se pudo guardar la revisión. Intenta de nuevo.' };
  }
  revalidatePath('/correo');
  return { ok: true, error: null };
}
