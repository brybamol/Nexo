
import { NextResponse } from 'next/server';
import { obtenerGmail } from '@/lib/google/gmail';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const gmail = await obtenerGmail();

    const respuesta = await gmail.users.getProfile({
      userId: 'me',
    });

    return NextResponse.json({
      conectado: true,
      correo: respuesta.data.emailAddress,
      mensajesTotales: respuesta.data.messagesTotal,
      hilosTotales: respuesta.data.threadsTotal,
    });
  } catch (error) {
    console.error('Error al consultar Gmail:', error);

    return NextResponse.json(
      {
        conectado: false,
        mensaje: 'No se pudo consultar el perfil de Gmail.',
      },
      { status: 500 },
    );
  }
}
