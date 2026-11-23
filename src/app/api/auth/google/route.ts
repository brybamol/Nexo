
import { google } from 'googleapis';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOKIE_STATE = 'nexo_google_oauth_state';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan variables de configuración de Google OAuth.' },
      { status: 500 },
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  const state = randomBytes(32).toString('hex');

  const authorizationUrl = oauth2Client.generateAuthUrl({
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
