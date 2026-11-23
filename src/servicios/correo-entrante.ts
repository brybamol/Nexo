// Recepción de correo entrante: normaliza el payload de Postmark, identifica al remitente
// mediante un mapa explícito y delega la interpretación en el servicio de captura existente.
import { and, eq } from 'drizzle-orm';
import { correosEntrantes, personas } from '@/db/esquema';
import { cargarInstantanea } from '@/db/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';
import { capturar } from '@/servicios/captura';
import { z } from 'zod';

const direccionSchema = z.object({ Email: z.string().email().optional() }).passthrough();
export const correoPostmarkSchema = z.object({
  MessageID: z.string().min(1).max(200),
  From: z.string().min(3).max(320),
  FromFull: direccionSchema.optional(),
  Subject: z.string().max(998).optional().default(''),
  StrippedTextReply: z.string().optional().default(''),
  TextBody: z.string().optional().default(''),
  HtmlBody: z.string().optional().default(''),
  Date: z.string().optional(),
}).passthrough();

export type CorreoPostmark = z.infer<typeof correoPostmarkSchema>;
export type ResultadoCorreo =
  | { estado: 'procesado'; messageId: string; capturaId: number; resultado: Awaited<ReturnType<typeof capturar>> }
  | { estado: 'remitente_no_registrado'; messageId: string }
  | { estado: 'duplicado'; messageId: string };

const MAX_TEXTO = 10_000;

function extraerEmail(valor: string): string | null {
  const entreAngulos = /<\s*([^<>\s]+@[^<>\s]+)\s*>/.exec(valor)?.[1];
  const candidato = entreAngulos ?? valor.trim();
  const email = candidato.toLowerCase();
  return z.string().email().safeParse(email).success ? email : null;
}

function htmlATexto(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, ' ')
    .replace(/<\/(p|div|li|br|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function textoDelCorreo(correo: CorreoPostmark): string {
  const cuerpo = correo.StrippedTextReply.trim() || correo.TextBody.trim() || htmlATexto(correo.HtmlBody);
  // El cuerpo conserva la frase tal como la escribió el empleado; usar el asunto como prefijo
  // puede alterar coincidencias exactas del intérprete Local. Si no hay cuerpo, se usa el asunto.
  const texto = cuerpo || correo.Subject.trim();
  if (!texto) throw new Error('El correo no contiene texto que Nexo pueda procesar.');
  if (texto.length > MAX_TEXTO) throw new Error(`El correo supera el máximo de ${MAX_TEXTO} caracteres.`);
  return texto;
}

async function reclamarMensaje(ctx: ContextoServicio, correo: CorreoPostmark, remitente: string) {
  const fechaRecibido = correo.Date && Number.isFinite(Date.parse(correo.Date))
    ? new Date(correo.Date)
    : (await cargarInstantanea(ctx.db)).ahora;
  const [nuevo] = await ctx.db
    .insert(correosEntrantes)
    .values({
      messageId: correo.MessageID,
      remitente,
      asunto: correo.Subject,
      recibidoEn: fechaRecibido,
      estado: 'procesando',
      capturaId: null,
      error: null,
    })
    .onConflictDoNothing()
    .returning({ messageId: correosEntrantes.messageId });

  if (nuevo) return true;

  const [existente] = await ctx.db
    .select({ estado: correosEntrantes.estado })
    .from(correosEntrantes)
    .where(eq(correosEntrantes.messageId, correo.MessageID))
    .limit(1);
  if (!existente || existente.estado !== 'error') return false;

  // Permite que Postmark reintente un mensaje cuyo procesamiento anterior falló.
  const [reclamado] = await ctx.db
    .update(correosEntrantes)
    .set({ estado: 'procesando', error: null })
    .where(and(eq(correosEntrantes.messageId, correo.MessageID), eq(correosEntrantes.estado, 'error')))
    .returning({ messageId: correosEntrantes.messageId });
  return Boolean(reclamado);
}

/** Procesa un mensaje de Postmark. `remitentes` asocia emails autorizados con IDs internos de personas. */
export async function procesarCorreoEntrante(
  ctx: ContextoServicio,
  entrada: unknown,
  remitentes: Record<string, string>,
): Promise<ResultadoCorreo> {
  const correo = correoPostmarkSchema.parse(entrada);
  const remitente = extraerEmail(correo.FromFull?.Email || correo.From);
  if (!remitente) throw new Error('Postmark envió una dirección de remitente no válida.');

  const reclamado = await reclamarMensaje(ctx, correo, remitente);
  if (!reclamado) return { estado: 'duplicado', messageId: correo.MessageID };

  try {
    const autorId = remitentes[remitente];
    if (!autorId) {
      await ctx.db.update(correosEntrantes)
        .set({ estado: 'rechazado', error: 'El remitente no está asociado a una persona de Nexo.' })
        .where(eq(correosEntrantes.messageId, correo.MessageID));
      return { estado: 'remitente_no_registrado', messageId: correo.MessageID };
    }

    const [persona] = await ctx.db.select({ id: personas.id }).from(personas).where(eq(personas.id, autorId)).limit(1);
    if (!persona) {
      await ctx.db.update(correosEntrantes)
        .set({ estado: 'rechazado', error: 'La persona asociada al remitente no existe en Nexo.' })
        .where(eq(correosEntrantes.messageId, correo.MessageID));
      return { estado: 'remitente_no_registrado', messageId: correo.MessageID };
    }

    const texto = textoDelCorreo(correo);
    const resultado = await capturar(ctx, persona.id, texto);
    await ctx.db.update(correosEntrantes)
      .set({ estado: 'procesado', capturaId: resultado.capturaId, error: null })
      .where(eq(correosEntrantes.messageId, correo.MessageID));
    return { estado: 'procesado', messageId: correo.MessageID, capturaId: resultado.capturaId, resultado };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al procesar el correo.';
    await ctx.db.update(correosEntrantes)
      .set({ estado: 'error', error: mensaje.slice(0, 1000) })
      .where(eq(correosEntrantes.messageId, correo.MessageID));
    throw error;
  }
}

/** Convierte la variable JSON de configuración en un mapa email → personaId. */
export function leerMapaRemitentes(valor: string | undefined): Record<string, string> {
  if (!valor?.trim()) return {};
  const dato: unknown = JSON.parse(valor);
  const mapa = z.record(z.string().email(), z.string().min(1)).parse(dato);
  return Object.fromEntries(Object.entries(mapa).map(([email, personaId]) => [email.toLowerCase(), personaId]));
}
