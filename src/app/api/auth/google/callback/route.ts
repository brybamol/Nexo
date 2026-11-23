
import { google } from 'googleapis';
import { timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOKIE_STATE = 'nexo_google_oauth_state';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan variables de Google OAuth.' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.json(
      { error: 'Google no completó la autorización.' },
      { status: 400 },
    );
  }

  const cookieState = request.cookies.get(COOKIE_STATE)?.value;

  if (
    !state ||
    !cookieState ||
    state.length !== cookieState.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))
  ) {
    return NextResponse.json(
      { error: 'Estado OAuth inválido. Inicia nuevamente la autorización.' },
      { status: 403 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Google no devolvió el código de autorización.' },
      { status: 400 },
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            'Google no devolvió un refresh token. Inicia nuevamente la autorización.',
        },
        { status: 400 },
      );
    }

    const carpeta = path.join(process.cwd(), '.secrets');
    const archivo = path.join(carpeta, 'google-oauth-token.json');

    await mkdir(carpeta, { recursive: true, mode: 0o700 });

    await writeFile(
      archivo,
      JSON.stringify({
        refresh_token: tokens.refresh_token,
      }),
      { encoding: 'utf8', mode: 0o600 },
    );

    const response = NextResponse.json({
      success: true,
      message: 'Nexo se ha conectado correctamente con Google.',
    });

    response.cookies.set(COOKIE_STATE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'No se pudo completar la conexión con Google.' },
      { status: 500 },
    );
  }
}
