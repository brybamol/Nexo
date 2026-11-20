// Arranque de la aplicación: la base queda lista sola (esquema + semilla) y la cookie elige a la persona. Tarea 1.5.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { personas } from '@/db/esquema';
import { COOKIE_PERSONA, PERSONA_POR_DEFECTO } from '@/dominio/constantes';
import { obtenerAhora } from '@/servicios/reloj';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

let cookie: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === COOKIE_PERSONA && cookie ? { name: n, value: cookie } : undefined) }),
}));

let dir: string;
const entornoPrevio = { datos: process.env.NEXO_DATA_DIR, url: process.env.DATABASE_URL, clave: process.env.ANTHROPIC_API_KEY };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-ctx-'));
  process.env.NEXO_DATA_DIR = path.join(dir, 'pglite');
  delete process.env.DATABASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
  cookie = undefined;
});

afterEach(async () => {
  const conexion = globalThis.__nexo ? await globalThis.__nexo : null;
  globalThis.__nexo = undefined;
  globalThis.__nexoContexto = undefined;
  await conexion?.cerrar();
  const restaurar = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  restaurar('NEXO_DATA_DIR', entornoPrevio.datos);
  restaurar('DATABASE_URL', entornoPrevio.url);
  restaurar('ANTHROPIC_API_KEY', entornoPrevio.clave);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('obtenerContextoApp', () => {
  it('con la base vacía crea el esquema, carga la semilla y devuelve db + intérprete Local', async () => {
    const ctx = await obtenerContextoApp();
    expect(await ctx.db.select().from(personas)).toHaveLength(12);
    expect(await obtenerAhora(ctx)).toEqual(new Date('2026-11-25T07:00:00-06:00'));
    expect(ctx.ia.nombre).toBe('local');
    expect(fs.existsSync(path.join(dir, 'pglite'))).toBe(true);
  });

  it('es un singleton: llamadas simultáneas y posteriores comparten contexto', async () => {
    const [a, b] = await Promise.all([obtenerContextoApp(), obtenerContextoApp()]);
    expect(a).toBe(b);
    expect(await obtenerContextoApp()).toBe(a);
  });

  it('con una clave de API usa Claude (con respaldo Local)', async () => {
    process.env.ANTHROPIC_API_KEY = 'clave-de-prueba';
    const ctx = await obtenerContextoApp();
    expect(ctx.ia.nombre).toBe('claude');
  });
});

describe('personaActual', () => {
  it('sin cookie devuelve la persona por defecto', async () => {
    expect(await personaActual()).toBe(PERSONA_POR_DEFECTO);
  });

  it('con cookie de una persona existente la devuelve', async () => {
    cookie = 'lucia-mora';
    expect(await personaActual()).toBe('lucia-mora');
  });

  it('con cookie de un id desconocido vuelve a la persona por defecto', async () => {
    cookie = 'nadie-conocido';
    expect(await personaActual()).toBe(PERSONA_POR_DEFECTO);
  });
});
