// Cliente de Gmail: OAuth de Google, token guardado (cifrado) en credenciales_google y conversión de los mensajes
// de la API al formato del adaptador de correo (src/correo/fuentes/gmail.ts), que aplica las reglas de privacidad.
import { eq } from 'drizzle-orm';
import { google, type gmail_v1 } from 'googleapis';
import {
  CATEGORIAS_AUTOMATICAS,
  DOMINIOS_PERSONALES,
  ETIQUETAS_IGNORADAS,
  textoDeCuerpoGmail,
} from '@/correo/fuentes/gmail';
import type { ParteGmail } from '@/correo/tipos';
import { credencialesGoogle, type Db } from '@/db/esquema';
import { cifrar, descifrar } from '@/servidor/cifrado';

/** Nexo guarda una sola conexión con Google. */
const ID_CONEXION = 'principal';

export function clienteOAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Faltan las variables de Google OAuth.');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** En producción solo se conectan cuentas de Google Workspace; en desarrollo se permite una cuenta personal para probar. */
export function cuentaPermitida(correo: string): boolean {
  const dominio = (correo.split('@')[1] ?? '').toLowerCase();
  return process.env.NODE_ENV !== 'production' || !DOMINIOS_PERSONALES.includes(dominio);
}

export async function guardarConexionGoogle(db: Db, correo: string, refreshToken: string, en: Date): Promise<void> {
  const fila = { correo, tokenCifrado: cifrar(refreshToken), actualizadoEn: en };
  await db
    .insert(credencialesGoogle)
    .values({ id: ID_CONEXION, ...fila })
    .onConflictDoUpdate({ target: credencialesGoogle.id, set: fila });
}

export async function leerConexionGoogle(db: Db): Promise<{ correo: string; refreshToken: string } | null> {
  const [fila] = await db.select().from(credencialesGoogle).where(eq(credencialesGoogle.id, ID_CONEXION)).limit(1);
  return fila ? { correo: fila.correo, refreshToken: descifrar(fila.tokenCifrado) } : null;
}

/** Cliente de Gmail con el token guardado. Lanza un error si Google todavía no está conectado. */
export async function obtenerGmail(db: Db) {
  const conexion = await leerConexionGoogle(db);
  if (!conexion) throw new Error('Google todavía no está conectado: entra a /api/auth/google.');
  const oauth = clienteOAuth();
  oauth.setCredentials({ refresh_token: conexion.refreshToken });
  return { gmail: google.gmail({ version: 'v1', auth: oauth }), correo: conexion.correo };
}

/** Parte MIME de la API (campos opcionales y nulos) → ParteGmail del adaptador. */
export function aParteGmail(p: gmail_v1.Schema$MessagePart | undefined): ParteGmail {
  return {
    partId: p?.partId ?? undefined,
    mimeType: p?.mimeType ?? '',
    filename: p?.filename ?? undefined,
    headers: (p?.headers ?? []).map((h) => ({ name: h.name ?? '', value: h.value ?? '' })),
    body: { size: p?.body?.size ?? 0, data: p?.body?.data ?? undefined, attachmentId: p?.body?.attachmentId ?? undefined },
    parts: p?.parts?.map(aParteGmail),
  };
}

export function encabezado(parte: ParteGmail, nombre: string): string {
  return parte.headers?.find((h) => h.name.toLowerCase() === nombre.toLowerCase())?.value ?? '';
}

export interface MensajeLeido {
  id: string;
  remitente: string;
  asunto: string;
  fecha: string;
  texto: string;
}

/**
 * Lee hasta `maximo` mensajes que cumplan `consulta`. Privacidad (mismas reglas que el adaptador): se saltan borradores,
 * spam, papelera, boletines y notificaciones automáticas, y de esos no se pide ni se decodifica el cuerpo.
 */
export async function leerMensajes(gmail: gmail_v1.Gmail, consulta: string, maximo: number): Promise<MensajeLeido[]> {
  const lista = await gmail.users.messages.list({ userId: 'me', maxResults: maximo, q: consulta });
  const leidos: MensajeLeido[] = [];
  for (const { id } of lista.data.messages ?? []) {
    if (!id) continue;
    const meta = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe'],
    });
    const etiquetas = meta.data.labelIds ?? [];
    const cabecera = aParteGmail(meta.data.payload);
    const automatico =
      etiquetas.some((l) => ETIQUETAS_IGNORADAS.includes(l) || CATEGORIAS_AUTOMATICAS.includes(l)) ||
      encabezado(cabecera, 'List-Unsubscribe') !== '';
    if (automatico) continue;

    const completo = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    leidos.push({
      id,
      remitente: encabezado(cabecera, 'From'),
      asunto: encabezado(cabecera, 'Subject'),
      fecha: encabezado(cabecera, 'Date'),
      texto: textoDeCuerpoGmail(aParteGmail(completo.data.payload)),
    });
  }
  return leidos;
}
