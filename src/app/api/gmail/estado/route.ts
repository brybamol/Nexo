// Estado de la conexión con Gmail (solo el administrador).
import { NextResponse } from 'next/server';
import { obtenerGmail } from '@/lib/google/gmail';
import { exigirAdmin } from '@/servidor/acceso-basico';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rechazo = exigirAdmin(request);
  if (rechazo) return rechazo;

  try {
    const ctx = await obtenerContextoApp();
    const { gmail } = await obtenerGmail(ctx.db);
    const respuesta = await gmail.users.getProfile({ userId: 'me' });
    return NextResponse.json({
      conectado: true,
      correo: respuesta.data.emailAddress,
      mensajesTotales: respuesta.data.messagesTotal,
      hilosTotales: respuesta.data.threadsTotal,
    });
  } catch (error) {
    console.error('Error al consultar Gmail:', error);
    return NextResponse.json({ conectado: false, mensaje: 'No se pudo consultar el perfil de Gmail.' }, { status: 500 });
  }
}
