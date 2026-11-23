// Inicia la conexión con Google (solo el administrador). Pide permiso de solo lectura de Gmail.
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clienteOAuth } from '@/lib/google/gmail';
import { exigirAdmin } from '@/servidor/acceso-basico';

export const runtime = 'nodejs';

const COOKIE_STATE = 'nexo_google_oauth_state';

export async function GET(request: Request) {
  const rechazo = exigirAdmin(request);
  if (rechazo) return rechazo;

  let oauth;
  try {
    oauth = clienteOAuth();
  } catch {
    return NextResponse.json({ error: 'Faltan variables de configuración de Google OAuth.' }, { status: 500 });
  }

  const state = randomBytes(32).toString('hex');
  const authorizationUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(COOKIE_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 600,
  });
  return response;
}
