
import { NextResponse } from 'next/server';
import { obtenerGmail } from '@/lib/google/gmail';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import {
  leerMapaRemitentes,
  procesarCorreoEntrante,
} from '@/servicios/correo-entrante';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ParteCorreo = {
  mimeType?: string | null;
  body?: {
    data?: string | null;
  } | null;
  parts?: ParteCorreo[] | null;
};

function extraerCuerpos(parte?: ParteCorreo): {
  texto: string[];
  html: string[];
} {
  const resultado = { texto: [] as string[], html: [] as string[] };

  if (!parte) return resultado;

  const datos = parte.body?.data;

  if (datos) {
    const contenido = Buffer.from(datos, 'base64url').toString('utf8');

    if (parte.mimeType === 'text/plain') {
      resultado.texto.push(contenido);
    } else if (parte.mimeType === 'text/html') {
      resultado.html.push(contenido);
    }
  }

  for (const hijo of parte.parts ?? []) {
    const extraido = extraerCuerpos(hijo);
    resultado.texto.push(...extraido.texto);
    resultado.html.push(...extraido.html);
  }

  return resultado;
}

function extraerEmail(remitente: string): string {
  const coincidencia = remitente.match(/<([^>]+)>/);
  return (coincidencia?.[1] ?? remitente).trim().toLowerCase();
}

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const gmail = await obtenerGmail();

    const lista = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'in:inbox from:carlosedosellsaenz@gmail.com',
    });

    const mensajes = lista.data.messages ?? [];

    const ctx = await obtenerContextoApp();
    const remitentes = leerMapaRemitentes(
      process.env.NEXO_EMAIL_REMITENTES,
    );

    const resultados = [];

    for (const mensaje of mensajes) {
      if (!mensaje.id) continue;

      const detalle = await gmail.users.messages.get({
        userId: 'me',
        id: mensaje.id,
        format: 'full',
      });

      const encabezados = detalle.data.payload?.headers ?? [];

      const obtenerEncabezado = (nombre: string) =>
        encabezados.find(
          (encabezado) =>
            encabezado.name?.toLowerCase() === nombre.toLowerCase(),
        )?.value ?? '';

      const remitente = obtenerEncabezado('From');
      const cuerpos = extraerCuerpos(
        detalle.data.payload as ParteCorreo | undefined,
      );

      const texto = cuerpos.texto.join('\n').trim();
      const html = cuerpos.html.join('\n').trim();

      const payload = {
        MessageID: detalle.data.id ?? mensaje.id,
        From: remitente,
        FromFull: {
          Email: extraerEmail(remitente),
        },
        Subject: obtenerEncabezado('Subject'),
        Date: obtenerEncabezado('Date'),
        TextBody: texto,
        HtmlBody: html,
      };

      const resultado = await procesarCorreoEntrante(
        ctx,
        payload,
        remitentes,
      );

      resultados.push({
        messageId: payload.MessageID,
        asunto: payload.Subject,
        remitente,
        resultado,
      });
    }

    return NextResponse.json({
      correcto: true,
      encontrados: mensajes.length,
      procesados: resultados.length,
      resultados,
    });
  } catch (error) {
    console.error('[gmail-procesar] Error:', error);

    return NextResponse.json(
      {
        correcto: false,
        mensaje: 'No se pudieron procesar los correos de Gmail.',
      },
      { status: 500 },
    );
  }
}
