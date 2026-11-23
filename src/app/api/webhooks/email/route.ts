import { NextResponse } from 'next/server';
import { credencialesValidas } from '@/servidor/acceso-basico';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import { leerMapaRemitentes, procesarCorreoEntrante } from '@/servicios/correo-entrante';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 256 * 1024;

function autorizado(header: string | null): boolean {
  const usuario = process.env.NEXO_EMAIL_WEBHOOK_USER;
  const clave = process.env.NEXO_EMAIL_WEBHOOK_PASSWORD;
  return Boolean(usuario && clave && credencialesValidas(header, usuario, clave));
}

export async function POST(request: Request) {
  if (!process.env.NEXO_EMAIL_WEBHOOK_USER || !process.env.NEXO_EMAIL_WEBHOOK_PASSWORD) {
    return NextResponse.json({ error: 'El webhook de correo no está configurado.' }, { status: 503 });
  }
  if (!autorizado(request.headers.get('authorization'))) {
    return new Response('No autorizado', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Nexo inbound email"' } });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'El mensaje supera el tamaño permitido.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 });
  }

  try {
    const remitentes = leerMapaRemitentes(process.env.NEXO_EMAIL_REMITENTES);
    const ctx = await obtenerContextoApp();
    const resultado = await procesarCorreoEntrante(ctx, payload, remitentes);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error('[webhook-email] No se pudo procesar el mensaje:', error);
    return NextResponse.json({ error: 'No se pudo procesar el correo. Postmark puede reintentar.' }, { status: 500 });
  }
}
