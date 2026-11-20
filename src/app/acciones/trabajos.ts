'use server';
// Responder un seguimiento y marcar avisos como leídos (Mi día). Tarea 4.1.
import { revalidatePath } from 'next/cache';
import { ErrorDominio, type EstadoTrabajo } from '@/dominio/tipos';
import { responderSeguimiento } from '@/servicios/estado-trabajos';
import { marcarAvisosLeidos } from '@/servicios/mi-dia';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/** Resultado serializable de responder: `error` trae el motivo en español si no se pudo. */
export type ResultadoResponder = { ok: boolean; error: string | null };

const MAX_NOTA = 1000;
const ESTADOS_RESPUESTA: readonly EstadoTrabajo[] = ['en_curso', 'resuelto'];

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Campos del formulario: `trabajoId`; `estado` opcional ('en_curso' | 'resuelto'); `nota` opcional.
 * Responde como la persona de «ver como». Cierra el seguimiento pendiente (lo valida el servicio).
 */
export async function accionResponderSeguimiento(formData: FormData): Promise<ResultadoResponder> {
  const trabajoId = texto(formData, 'trabajoId');
  const estadoBruto = texto(formData, 'estado');
  const nota = texto(formData, 'nota');
  if (!trabajoId) return { ok: false, error: 'No se indicó el trabajo a responder.' };
  if (estadoBruto && !ESTADOS_RESPUESTA.includes(estadoBruto as EstadoTrabajo)) {
    return { ok: false, error: 'El estado debe ser «En curso» o «Resuelto».' };
  }
  if (nota.length > MAX_NOTA) return { ok: false, error: `La nota es muy larga (máximo ${MAX_NOTA} caracteres).` };
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    await responderSeguimiento(ctx, trabajoId, personaId, {
      ...(estadoBruto ? { estado: estadoBruto as EstadoTrabajo } : {}),
      ...(nota ? { nota } : {}),
    });
  } catch (e) {
    if (e instanceof ErrorDominio) return { ok: false, error: e.message };
    return { ok: false, error: 'No se pudo registrar la respuesta. Intenta de nuevo.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true, error: null };
}

/** Marca como leídos los avisos de la persona de «ver como». */
export async function accionMarcarLeidos(): Promise<void> {
  const ctx = await obtenerContextoApp();
  await marcarAvisosLeidos(ctx, await personaActual());
  revalidatePath('/', 'layout');
}
