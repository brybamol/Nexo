'use server';
// Aprobar o rechazar una decisión desde la bandeja. Tarea 4.2.
import { revalidatePath } from 'next/cache';
import type { TrabajoRef } from '@/dominio/nombres';
import { ErrorDominio, type LetraOpcion } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { aprobarDecision, rechazarDecision } from '@/servicios/decisiones';
import { listarPersonas } from '@/servicios/personas';
import { cargarNombrador } from '@/servicios/registro';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/**
 * Resultado serializable: `error` trae el motivo en español si no se pudo.
 * `avisosA` son nombres de personas (no ids); `trabajosCreados` llevan el id (para el enlace), el título y la referencia.
 */
export type ResultadoDecision =
  | { ok: true; error: null; trabajosCreados: TrabajoRef[]; avisosA: string[] }
  | { ok: false; error: string; trabajosCreados: TrabajoRef[]; avisosA: string[] };

function fallo(error: string): ResultadoDecision {
  return { ok: false, error, trabajosCreados: [], avisosA: [] };
}

async function nombres(ctx: ContextoServicio, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const personas = await listarPersonas(ctx);
  return ids.map((id) => personas.find((p) => p.id === id)?.nombre ?? id);
}

const LETRAS: readonly string[] = ['A', 'B', 'C'];

export async function accionAprobar(decisionId: string, letra: LetraOpcion): Promise<ResultadoDecision> {
  if (typeof decisionId !== 'string' || !decisionId) return fallo('No se indicó la decisión.');
  if (!LETRAS.includes(letra)) return fallo('La opción debe ser A, B o C.');
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    const r = await aprobarDecision(ctx, decisionId, letra, personaId);
    const avisosA = await nombres(ctx, r.avisosA);
    const trabajosCreados = (await cargarNombrador(ctx.db)).refs(r.trabajosCreados);
    revalidatePath('/', 'layout');
    return { ok: true, error: null, trabajosCreados, avisosA };
  } catch (e) {
    if (e instanceof ErrorDominio) return fallo(e.message);
    return fallo('No se pudo aprobar la decisión. Intenta de nuevo.');
  }
}

export async function accionRechazar(decisionId: string, motivo: string): Promise<ResultadoDecision> {
  if (typeof decisionId !== 'string' || !decisionId) return fallo('No se indicó la decisión.');
  const limpio = typeof motivo === 'string' ? motivo.trim() : '';
  if (!limpio) return fallo('Escribe el motivo del rechazo.');
  if (limpio.length > 1000) return fallo('El motivo es muy largo (máximo 1000 caracteres).');
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    const r = await rechazarDecision(ctx, decisionId, personaId, limpio);
    const avisosA = await nombres(ctx, r.avisosA);
    revalidatePath('/', 'layout');
    return { ok: true, error: null, trabajosCreados: [], avisosA };
  } catch (e) {
    if (e instanceof ErrorDominio) return fallo(e.message);
    return fallo('No se pudo rechazar la decisión. Intenta de nuevo.');
  }
}
