import { afterEach, describe, expect, it, vi } from 'vitest';
import { credencialesValidas, exigirAdmin } from '@/servidor/acceso-basico';
import { cifrar, descifrar } from '@/servidor/cifrado';
import { cuentaPermitida } from '@/lib/google/gmail';

const basico = (texto: string) => `Basic ${Buffer.from(texto).toString('base64')}`;

afterEach(() => vi.unstubAllEnvs());

describe('cifrado del token de Google', () => {
  it('cifra y descifra con NEXO_CLAVE_CIFRADO', () => {
    vi.stubEnv('NEXO_CLAVE_CIFRADO', Buffer.alloc(32, 7).toString('base64'));
    const cifrado = cifrar('token-secreto');
    expect(cifrado).not.toContain('token-secreto');
    expect(descifrar(cifrado)).toBe('token-secreto');
  });

  it('falla sin clave o con una clave de otro largo', () => {
    vi.stubEnv('NEXO_CLAVE_CIFRADO', '');
    expect(() => cifrar('x')).toThrow(/NEXO_CLAVE_CIFRADO/);
    vi.stubEnv('NEXO_CLAVE_CIFRADO', Buffer.alloc(16).toString('base64'));
    expect(() => cifrar('x')).toThrow(/32 bytes/);
  });

  it('detecta un token alterado', () => {
    vi.stubEnv('NEXO_CLAVE_CIFRADO', Buffer.alloc(32, 7).toString('base64'));
    const [iv, etiqueta] = cifrar('token-secreto').split('.');
    expect(() => descifrar(`${iv}.${etiqueta}.${Buffer.from('otro').toString('base64url')}`)).toThrow();
  });
});

describe('acceso de administración', () => {
  it('acepta solo el usuario y la clave exactos', () => {
    expect(credencialesValidas(basico('admin:clave'), 'admin', 'clave')).toBe(true);
    expect(credencialesValidas(basico('admin:otra'), 'admin', 'clave')).toBe(false);
    expect(credencialesValidas(null, 'admin', 'clave')).toBe(false);
  });

  it('cierra las rutas si no hay usuario configurado', () => {
    vi.stubEnv('NEXO_ADMIN_USUARIO', '');
    vi.stubEnv('NEXO_ADMIN_CLAVE', '');
    expect(exigirAdmin(new Request('http://x/api/gmail/estado'))?.status).toBe(503);
  });

  it('pide credenciales y deja pasar al administrador', () => {
    vi.stubEnv('NEXO_ADMIN_USUARIO', 'admin');
    vi.stubEnv('NEXO_ADMIN_CLAVE', 'clave');
    expect(exigirAdmin(new Request('http://x/api/gmail/estado'))?.status).toBe(401);
    const ok = new Request('http://x/api/gmail/estado', { headers: { authorization: basico('admin:clave') } });
    expect(exigirAdmin(ok)).toBeNull();
  });
});

describe('cuentas de Google permitidas', () => {
  it('en producción rechaza cuentas personales de Gmail', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(cuentaPermitida('alguien@gmail.com')).toBe(false);
    expect(cuentaPermitida('paola@empresa.com')).toBe(true);
  });

  it('en desarrollo permite una cuenta personal para probar', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(cuentaPermitida('alguien@gmail.com')).toBe(true);
  });
});
