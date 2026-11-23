// Autenticación HTTP Basic para las rutas de administración (Gmail) y el webhook de correo.
import { timingSafeEqual } from 'node:crypto';

/** true si el encabezado `Authorization` trae exactamente `usuario:clave`. */
export function credencialesValidas(header: string | null, usuario: string, clave: string): boolean {
  if (!header?.startsWith('Basic ')) return false;
  const esperado = Buffer.from(`${usuario}:${clave}`);
  const recibido = Buffer.from(header.slice(6), 'base64');
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/**
 * Exige el usuario administrador (NEXO_ADMIN_USUARIO / NEXO_ADMIN_CLAVE). Devuelve la respuesta de rechazo, o null si
 * la solicitud está autorizada. Sin las variables, las rutas quedan cerradas.
 */
export function exigirAdmin(request: Request): Response | null {
  const usuario = process.env.NEXO_ADMIN_USUARIO;
  const clave = process.env.NEXO_ADMIN_CLAVE;
  if (!usuario || !clave) {
    return Response.json({ error: 'El acceso de administración no está configurado.' }, { status: 503 });
  }
  if (!credencialesValidas(request.headers.get('authorization'), usuario, clave)) {
    return new Response('No autorizado', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Nexo administración"' } });
  }
  return null;
}
