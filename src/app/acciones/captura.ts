'use server';
// Caja de captura (useActionState). Tarea 2.5.
import { revalidatePath } from 'next/cache';
import { ErrorDominio } from '@/dominio/tipos';
import { capturar, responderCaptura } from '@/servicios/captura';
import { obtenerTrabajo } from '@/servicios/consultas-trabajos';
import type { ContextoServicio } from '@/servicios/contexto';
import { listarPersonas } from '@/servicios/personas';
import type { ResultadoCaptura, TrabajoVista } from '@/servicios/vistas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/**
 * Estado del formulario de captura: último resultado o error.
 * `trabajos` (opcional) trae los trabajos creados, actualizados o duplicados ya cargados,
 * para que la tarjeta muestre proyecto, responsable, plazo y bloqueos sin pedir más datos.
 */
export type EstadoFormularioCaptura = {
  resultado: ResultadoCaptura | null;
  error: string | null;
  trabajos?: TrabajoVista[];
};

const MAX_TEXTO = 1000;

function mensajeDe(e: unknown): string {
  if (e instanceof ErrorDominio && e.message) return e.message;
  console.error('[captura] error interno', e);
  return 'Algo falló al procesar esto. Inténtalo de nuevo.';
}

/** Carga las vistas de los trabajos que cita el resultado; lo que falle simplemente se omite. */
async function cargarTrabajos(ctx: ContextoServicio, r: ResultadoCaptura): Promise<TrabajoVista[]> {
  let ids: string[] = [];
  if (r.estado === 'aplicada') ids = [...r.trabajosCreados, ...r.trabajosActualizados];
  else if (r.estado === 'duplicado') ids = [r.trabajoId];
  const unicos = [...new Set(ids)];
  const vistas = await Promise.all(unicos.map((id) => obtenerTrabajo(ctx, id).catch(() => null)));
  return vistas.filter((v): v is TrabajoVista => v !== null);
}

/** `avisosA` trae ids de persona; la tarjeta muestra nombres. */
async function conNombres(ctx: ContextoServicio, r: ResultadoCaptura): Promise<ResultadoCaptura> {
  if (r.estado !== 'aplicada' || r.avisosA.length === 0) return r;
  const personas = await listarPersonas(ctx);
  return { ...r, avisosA: r.avisosA.map((id) => personas.find((p) => p.id === id)?.nombre ?? id) };
}

async function terminar(ctx: ContextoServicio, r: ResultadoCaptura): Promise<EstadoFormularioCaptura> {
  if (r.estado === 'aplicada') revalidatePath('/', 'layout');
  return { resultado: await conNombres(ctx, r), error: null, trabajos: await cargarTrabajos(ctx, r) };
}

export async function accionCapturar(
  prev: EstadoFormularioCaptura,
  formData: FormData,
): Promise<EstadoFormularioCaptura> {
  const bruto = formData.get('texto');
  const texto = typeof bruto === 'string' ? bruto.trim() : '';
  if (!texto) return { ...prev, error: 'Escribe una frase para capturar.' };
  if (texto.length > MAX_TEXTO) {
    return { ...prev, error: `La frase es muy larga (máximo ${MAX_TEXTO} caracteres).` };
  }
  try {
    const ctx = await obtenerContextoApp();
    const autorId = await personaActual();
    return await terminar(ctx, await capturar(ctx, autorId, texto));
  } catch (e) {
    return { resultado: null, error: mensajeDe(e) };
  }
}

export async function accionResponderCaptura(
  prev: EstadoFormularioCaptura,
  formData: FormData,
): Promise<EstadoFormularioCaptura> {
  const id = Number(formData.get('capturaId'));
  const bruto = formData.get('respuesta');
  const respuesta = typeof bruto === 'string' ? bruto.trim() : '';
  if (!Number.isInteger(id) || id <= 0) return { ...prev, error: 'No se encontró la captura a responder.' };
  if (!respuesta) return { ...prev, error: 'Escribe o elige una respuesta.' };
  try {
    const ctx = await obtenerContextoApp();
    return await terminar(ctx, await responderCaptura(ctx, id, respuesta));
  } catch (e) {
    return { ...prev, error: mensajeDe(e) };
  }
}
