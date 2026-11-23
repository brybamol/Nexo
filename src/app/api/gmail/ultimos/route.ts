
import { NextResponse } from 'next/server';
import { obtenerGmail } from '@/lib/google/gmail';

export const runtime = 'nodejs';

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

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const gmail = await obtenerGmail();

    const lista = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'in:inbox',
    });

    const mensajes = lista.data.messages ?? [];

    const correos = await Promise.all(
      mensajes.map(async (mensaje) => {
        if (!mensaje.id) return null;

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

        const cuerpos = extraerCuerpos(
          detalle.data.payload as ParteCorreo | undefined,
        );

        return {
          id: detalle.data.id,
          hiloId: detalle.data.threadId,
          remitente: obtenerEncabezado('From'),
          destinatario: obtenerEncabezado('To'),
          asunto: obtenerEncabezado('Subject'),
          fecha: obtenerEncabezado('Date'),
          resumen: detalle.data.snippet ?? '',
          texto: cuerpos.texto.join('\n').trim(),
          html: cuerpos.html.join('\n').trim(),
        };
      }),
    );

    return NextResponse.json({
      correcto: true,
      cantidad: correos.filter(Boolean).length,
      correos: correos.filter(Boolean),
    });
  } catch (error) {
    console.error('Error al consultar los correos de Gmail:', error);

    return NextResponse.json(
      {
        correcto: false,
        mensaje: 'No se pudieron consultar los correos de Gmail.',
      },
      { status: 500 },
    );
  }
}
