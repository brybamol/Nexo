// Últimos correos de la bandeja de entrada, para depurar en desarrollo (solo el administrador).
// Aplica las mismas reglas de privacidad que el procesamiento: sin boletines ni notificaciones automáticas.
import { NextResponse } from 'next/server';
import { leerMensajes, obtenerGmail } from '@/lib/google/gmail';
import { exigirAdmin } from '@/servidor/acceso-basico';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new NextResponse(null, { status: 404 });
  const rechazo = exigirAdmin(request);
  if (rechazo) return rechazo;

  try {
    const ctx = await obtenerContextoApp();
    const { gmail } = await obtenerGmail(ctx.db);
    const correos = await leerMensajes(gmail, 'in:inbox', 10);
    return NextResponse.json({ correcto: true, cantidad: correos.length, correos });
  } catch (error) {
    console.error('Error al consultar los correos de Gmail:', error);
    return NextResponse.json({ correcto: false, mensaje: 'No se pudieron consultar los correos de Gmail.' }, { status: 500 });
  }
}
