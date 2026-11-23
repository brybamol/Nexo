// Cifrado de secretos guardados en la base (AES-256-GCM). La clave viene de NEXO_CLAVE_CIFRADO:
// 32 bytes en base64, por ejemplo `openssl rand -base64 32`.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';

function clave(): Buffer {
  const valor = process.env.NEXO_CLAVE_CIFRADO;
  if (!valor) throw new Error('Falta NEXO_CLAVE_CIFRADO: 32 bytes en base64 para cifrar el token de Google.');
  const bytes = Buffer.from(valor, 'base64');
  if (bytes.length !== 32) throw new Error('NEXO_CLAVE_CIFRADO debe tener 32 bytes en base64.');
  return bytes;
}

/** Devuelve `iv.etiqueta.texto`, cada parte en base64url. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), datos].map((b) => b.toString('base64url')).join('.');
}

export function descifrar(cifrado: string): string {
  const [iv, etiqueta, datos] = cifrado.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !etiqueta || !datos) throw new Error('El secreto guardado no tiene el formato esperado.');
  const descifrador = createDecipheriv(ALGORITMO, clave(), iv);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString('utf8');
}
