
import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function obtenerGmail() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Faltan las variables de Google OAuth.');
  }

  const archivo = path.join(
    process.cwd(),
    '.secrets',
    'google-oauth-token.json',
  );

  const contenido = await readFile(archivo, 'utf8');
  const tokens = JSON.parse(contenido) as {
    refresh_token: string;
  };

  if (!tokens.refresh_token) {
    throw new Error('No se encontró el refresh token de Google.');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );

  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token,
  });

  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });
}
