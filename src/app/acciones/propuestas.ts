'use server';
// Propuestas de Nexo y entregas desde la interfaz (docs/08 reglas 16, 19 y 20; tarea R7b).
// La persona sale siempre de personaActual() en el servidor: el formulario nunca dice quién actúa. Los errores de dominio
// vuelven como texto en español; cualquier otro error se registra y devuelve un mensaje genérico.
import { revalidatePath } from 'next/cache';
import { enCR } from '@/dominio/tiempo';
import { ErrorDominio, type CambiosPropuesta, type EntradaRevisionPropuesta } from '@/dominio/tipos';
import type { ContextoServicio } from '@/servicios/contexto';
import { cambiarEstado, confirmarRecepcion, declararEntrega, rechazarEntrega } from '@/servicios/estado-trabajos';
import { revisarPropuesta } from '@/servicios/propuestas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/** Resultado serializable: `error` trae el motivo en español si no se pudo. */
export type ResultadoPropuesta = { ok: boolean; error: string | null };

const MAX_TEXTO = 1000;
const MAX_TITULO = 200;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
const ENLACE = /^https?:\/\/\S+$/i;

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo);
  return typeof v === 'string' ? v.trim() : '';
}

const fallo = (error: string): ResultadoPropuesta => ({ ok: false, error });

async function ejecutar(hacer: (ctx: ContextoServicio, personaId: string) => Promise<void>): Promise<ResultadoPropuesta> {
  try {
    const ctx = await obtenerContextoApp();
    const personaId = await personaActual();
    await hacer(ctx, personaId);
  } catch (e) {
    if (e instanceof ErrorDominio) return fallo(e.message);
    console.error('[acciones/propuestas]', e);
    return fallo('No se pudo registrar el cambio. Intenta de nuevo.');
  }
  revalidatePath('/', 'layout');
  return { ok: true, error: null };
}

/**
 * Campos: `trabajoId`; `tipo` ('confirmar' | 'corregir' | 'descartar'). Para corregir, solo los campos cambiados:
 * `titulo`, `responsableId`, `fecha` + `hora` (plazo en hora de Costa Rica), `proyectoId`. Para descartar, `motivo` opcional.
 */
export async function accionRevisarPropuesta(formData: FormData): Promise<ResultadoPropuesta> {
  const trabajoId = texto(formData, 'trabajoId');
  const tipo = texto(formData, 'tipo');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  let entrada: EntradaRevisionPropuesta;
  if (tipo === 'confirmar') {
    entrada = { tipo: 'confirmar' };
  } else if (tipo === 'descartar') {
    const motivo = texto(formData, 'motivo');
    if (motivo.length > MAX_TEXTO) return fallo(`El motivo es muy largo (máximo ${MAX_TEXTO} caracteres).`);
    entrada = { tipo: 'descartar', motivo: motivo || null };
  } else if (tipo === 'corregir') {
    const cambios: CambiosPropuesta = {};
    const titulo = texto(formData, 'titulo');
    const responsableId = texto(formData, 'responsableId');
    const proyectoId = texto(formData, 'proyectoId');
    const fecha = texto(formData, 'fecha');
    const hora = texto(formData, 'hora');
    if (formData.has('titulo')) {
      if (!titulo) return fallo('El título no puede quedar vacío.');
      if (titulo.length > MAX_TITULO) return fallo(`El título es muy largo (máximo ${MAX_TITULO} caracteres).`);
      cambios.titulo = titulo;
    }
    if (responsableId) cambios.responsableId = responsableId;
    if (proyectoId) cambios.proyectoId = proyectoId;
    if (fecha || hora) {
      if (!FECHA.test(fecha) || !HORA.test(hora)) return fallo('Indica la fecha y la hora del plazo.');
      const plazo = enCR(fecha, hora);
      if (Number.isNaN(plazo.getTime())) return fallo('La fecha del plazo no es válida.');
      cambios.plazo = plazo;
    }
    entrada = { tipo: 'corregir', cambios };
  } else {
    return fallo('No se entendió qué hacer con la propuesta.');
  }
  return ejecutar((ctx, personaId) => revisarPropuesta(ctx, trabajoId, personaId, entrada));
}

/** Campos: `trabajoId`, `nota` y/o `enlace` (al menos uno). El responsable declara que entregó. */
export async function accionDeclararEntrega(formData: FormData): Promise<ResultadoPropuesta> {
  const trabajoId = texto(formData, 'trabajoId');
  const nota = texto(formData, 'nota');
  const enlace = texto(formData, 'enlace');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  if (!nota && !enlace) return fallo('Escribe qué entregaste o pega el enlace.');
  if (nota.length > MAX_TEXTO) return fallo(`La nota es muy larga (máximo ${MAX_TEXTO} caracteres).`);
  if (enlace && !ENLACE.test(enlace)) return fallo('El enlace debe empezar con http:// o https://.');
  return ejecutar((ctx, personaId) =>
    declararEntrega(ctx, trabajoId, personaId, { ...(nota ? { nota } : {}), ...(enlace ? { enlace } : {}) }),
  );
}

/** Campos: `trabajoId`, `nota` (obligatoria). Quien puede darlo por resuelto lo resuelve con esa evidencia. */
export async function accionResolverConNota(formData: FormData): Promise<ResultadoPropuesta> {
  const trabajoId = texto(formData, 'trabajoId');
  const nota = texto(formData, 'nota');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  if (!nota) return fallo('Escribe qué entregaste o pega el enlace.');
  if (nota.length > MAX_TEXTO) return fallo(`La nota es muy larga (máximo ${MAX_TEXTO} caracteres).`);
  return ejecutar((ctx, personaId) => cambiarEstado(ctx, trabajoId, personaId, 'resuelto', nota));
}

/** Campos: `trabajoId`, `nota` opcional. Quien lo pidió confirma que lo recibió: queda Resuelto. */
export async function accionConfirmarRecepcion(formData: FormData): Promise<ResultadoPropuesta> {
  const trabajoId = texto(formData, 'trabajoId');
  const nota = texto(formData, 'nota');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  if (nota.length > MAX_TEXTO) return fallo(`La nota es muy larga (máximo ${MAX_TEXTO} caracteres).`);
  return ejecutar((ctx, personaId) => confirmarRecepcion(ctx, trabajoId, personaId, nota || undefined));
}

/** Campos: `trabajoId`, `motivo` (obligatorio). Quien lo pidió rechaza la entrega. */
export async function accionRechazarEntrega(formData: FormData): Promise<ResultadoPropuesta> {
  const trabajoId = texto(formData, 'trabajoId');
  const motivo = texto(formData, 'motivo');
  if (!trabajoId) return fallo('No se indicó el trabajo.');
  if (!motivo) return fallo('Escribe por qué no está bien.');
  if (motivo.length > MAX_TEXTO) return fallo(`El motivo es muy largo (máximo ${MAX_TEXTO} caracteres).`);
  return ejecutar((ctx, personaId) => rechazarEntrega(ctx, trabajoId, personaId, motivo));
}
