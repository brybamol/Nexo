'use server';
// Responder un seguimiento y marcar avisos como leídos (Mi día). Tarea 4.1. Reasignar, mover el plazo y declarar
// bloqueo (reforma de escalamiento).
import { revalidatePath } from 'next/cache';
import { formatearFecha } from '@/dominio/formato';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type EstadoTrabajo } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { declararBloqueoTrabajo, moverPlazoTrabajo, reasignarTrabajo, responderSeguimiento } from '@/servicios/estado-trabajos';
import { marcarAvisosLeidos } from '@/servicios/mi-dia';
import { listarPersonas } from '@/servicios/personas';
import { cargarNombrador } from '@/servicios/registro';
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

// ─── El dueño del resultado actúa (reforma de escalamiento, regla 2) ───────────
// La interfaz solo muestra los botones a quien puede usarlos, pero la autorización la valida el servicio (motor) con la
// persona de «ver como» leída en el servidor: el formulario nunca dice quién actúa.

/** Resultado serializable: `mensaje` dice qué quedó hecho; `avisosA` son nombres; `error`, el motivo si no se pudo. */
export type ResultadoIntervencionUI = { ok: boolean; error: string | null; mensaje: string | null; avisosA: string[] };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

function fallo(error: string): ResultadoIntervencionUI {
  return { ok: false, error, mensaje: null, avisosA: [] };
}

async function intervenir(
  formData: FormData,
  hacer: (ctx: ContextoServicio, trabajoId: string, personaId: string) => Promise<{ avisosA: string[] }>,
  mensaje: (nombres: { titulo: string; persona: (id: string) => string }) => string,
): Promise<ResultadoIntervencionUI> {
  const trabajoId = texto(formData, 'trabajoId');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    const r = await hacer(ctx, trabajoId, personaId);
    const [personas, nombres] = await Promise.all([listarPersonas(ctx), cargarNombrador(ctx.db)]);
    const persona = (id: string) => personas.find((p) => p.id === id)?.nombre ?? id;
    revalidatePath('/', 'layout');
    return { ok: true, error: null, mensaje: mensaje({ titulo: nombres.cita(trabajoId), persona }), avisosA: r.avisosA.map(persona) };
  } catch (e) {
    if (e instanceof ErrorDominio) return fallo(e.message);
    return fallo('No se pudo registrar el cambio. Intenta de nuevo.');
  }
}

/** Campos: `trabajoId`, `responsableId` (la persona nueva), `motivo` opcional. */
export async function accionReasignar(formData: FormData): Promise<ResultadoIntervencionUI> {
  const responsableId = texto(formData, 'responsableId');
  const motivo = texto(formData, 'motivo');
  if (!responsableId) return fallo('Elige a quién reasignar el trabajo.');
  if (motivo.length > MAX_NOTA) return fallo(`El motivo es muy largo (máximo ${MAX_NOTA} caracteres).`);
  return intervenir(
    formData,
    (ctx, trabajoId, personaId) => reasignarTrabajo(ctx, trabajoId, personaId, responsableId, motivo),
    ({ titulo, persona }) => `${titulo} ahora está a cargo de ${persona(responsableId)}.`,
  );
}

/** Campos: `trabajoId`, `fecha` (AAAA-MM-DD), `hora` (HH:mm, hora de Costa Rica) y `motivo` (obligatorio). */
export async function accionMoverPlazo(formData: FormData): Promise<ResultadoIntervencionUI> {
  const fecha = texto(formData, 'fecha');
  const hora = texto(formData, 'hora');
  const motivo = texto(formData, 'motivo');
  if (!FECHA.test(fecha) || !HORA.test(hora)) return fallo('Indica la fecha y la hora del plazo nuevo.');
  if (!motivo) return fallo('Escribe el motivo del cambio de plazo.');
  if (motivo.length > MAX_NOTA) return fallo(`El motivo es muy largo (máximo ${MAX_NOTA} caracteres).`);
  const plazo = enCR(fecha, hora);
  if (Number.isNaN(plazo.getTime())) return fallo('La fecha del plazo no es válida.');
  return intervenir(
    formData,
    (ctx, trabajoId, personaId) => moverPlazoTrabajo(ctx, trabajoId, personaId, plazo, motivo),
    ({ titulo }) => `El plazo de ${titulo} pasó al ${formatearFecha(plazo)}.`,
  );
}

/** Campos: `trabajoId` y `motivo` (obligatorio). */
export async function accionDeclararBloqueo(formData: FormData): Promise<ResultadoIntervencionUI> {
  const motivo = texto(formData, 'motivo');
  if (!motivo) return fallo('Escribe el motivo del bloqueo.');
  if (motivo.length > MAX_NOTA) return fallo(`El motivo es muy largo (máximo ${MAX_NOTA} caracteres).`);
  return intervenir(
    formData,
    (ctx, trabajoId, personaId) => declararBloqueoTrabajo(ctx, trabajoId, personaId, motivo),
    ({ titulo }) => `${titulo} quedó bloqueado.`,
  );
}

/** Marca como leídos los avisos de la persona de «ver como». */
export async function accionMarcarLeidos(): Promise<void> {
  const ctx = await obtenerContextoApp();
  await marcarAvisosLeidos(ctx, await personaActual());
  revalidatePath('/', 'layout');
}
