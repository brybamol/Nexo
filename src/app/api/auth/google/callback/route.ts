// Vuelta de Google: valida el state, canjea el código y guarda el refresh token cifrado en la base.
// La ruta no pide usuario: el state solo existe si el administrador inició la conexión en /api/auth/google.
import { timingSafeEqual } from 'node:crypto';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { clienteOAuth, cuentaPermitida, guardarConexionGoogle } from '@/lib/google/gmail';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_STATE = 'nexo_google_oauth_state';

function borrarState(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_STATE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (url.searchParams.get('error')) {
    return borrarState(NextResponse.json({ error: 'Google no completó la autorización.' }, { status: 400 }));
  }

  const cookieState = request.cookies.get(COOKIE_STATE)?.value;
  if (
    !state ||
    !cookieState ||
    state.length !== cookieState.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))
  ) {
    return NextResponse.json({ error: 'Estado OAuth inválido. Inicia nuevamente la autorización.' }, { status: 403 });
  }
  if (!code) {
    return borrarState(NextResponse.json({ error: 'Google no devolvió el código de autorización.' }, { status: 400 }));
  }

  try {
    const oauth = clienteOAuth();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) {
      return borrarState(
        NextResponse.json({ error: 'Google no devolvió un refresh token. Inicia nuevamente la autorización.' }, { status: 400 }),
      );
    }

    oauth.setCredentials(tokens);
    const perfil = await google.gmail({ version: 'v1', auth: oauth }).users.getProfile({ userId: 'me' });
    const correo = perfil.data.emailAddress?.toLowerCase();
    if (!correo) {
      return borrarState(NextResponse.json({ error: 'Google no devolvió el correo de la cuenta.' }, { status: 400 }));
    }
    if (!cuentaPermitida(correo)) {
      return borrarState(
        NextResponse.json(
          { error: 'Nexo no conecta cuentas personales de Gmail: solo cuentas de Google Workspace de la empresa.' },
          { status: 400 },
        ),
      );
    }

    const ctx = await obtenerContextoApp();
    await guardarConexionGoogle(ctx.db, correo, tokens.refresh_token, new Date());
    return borrarState(NextResponse.json({ success: true, correo, message: 'Nexo se ha conectado correctamente con Google.' }));
  } catch (error) {
    console.error('[google-callback] No se pudo completar la conexión:', error);
    return borrarState(NextResponse.json({ error: 'No se pudo completar la conexión con Google.' }, { status: 500 }));
  }
}
