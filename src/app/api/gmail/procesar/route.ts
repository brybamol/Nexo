// Procesa el correo reciente de la cuenta conectada (solo el administrador). Solo lee mensajes de los remitentes
// registrados en NEXO_EMAIL_REMITENTES: del resto, Nexo ni siquiera pide el cuerpo.
import { NextResponse } from 'next/server';
import { leerMensajes, obtenerGmail } from '@/lib/google/gmail';
import { exigirAdmin } from '@/servidor/acceso-basico';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import { leerMapaRemitentes, procesarCorreoEntrante } from '@/servicios/correo-entrante';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAXIMO = 10;

function extraerEmail(remitente: string): string {
  const coincidencia = remitente.match(/<([^>]+)>/);
  return (coincidencia?.[1] ?? remitente).trim().toLowerCase();
}

export async function POST(request: Request) {
  const rechazo = exigirAdmin(request);
  if (rechazo) return rechazo;

  try {
    const remitentes = leerMapaRemitentes(process.env.NEXO_EMAIL_REMITENTES);
    const correos = Object.keys(remitentes);
    if (correos.length === 0) {
      return NextResponse.json(
        { correcto: false, mensaje: 'No hay remitentes registrados en NEXO_EMAIL_REMITENTES.' },
        { status: 400 },
      );
    }

    const ctx = await obtenerContextoApp();
    const { gmail } = await obtenerGmail(ctx.db);
    const mensajes = await leerMensajes(gmail, `in:inbox from:(${correos.join(' OR ')})`, MAXIMO);

    const resultados = [];
    for (const m of mensajes) {
      const resultado = await procesarCorreoEntrante(
        ctx,
        {
          MessageID: m.id,
          From: m.remitente,
          FromFull: { Email: extraerEmail(m.remitente) },
          Subject: m.asunto,
          Date: m.fecha,
          TextBody: m.texto,
        },
        remitentes,
      );
      resultados.push({ messageId: m.id, asunto: m.asunto, remitente: m.remitente, resultado });
    }

    return NextResponse.json({ correcto: true, procesados: resultados.length, resultados });
  } catch (error) {
    console.error('[gmail-procesar] Error:', error);
    return NextResponse.json({ correcto: false, mensaje: 'No se pudieron procesar los correos de Gmail.' }, { status: 500 });
  }
}
