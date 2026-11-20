// Conexión a la base: PGlite (local y pruebas) o pg (si hay DATABASE_URL). Tarea 1.2.
// Singleton en globalThis.__nexo con la PROMESA de inicialización; nunca abrir PGlite al importar el módulo.
import fs from 'node:fs';
import path from 'node:path';
import { DDL_CREAR } from '@/db/ddl';
import { esquema, type Db } from '@/db/esquema';

export type ModoConexion =
  | { tipo: 'pglite'; dir: string | null } // null = en memoria (pruebas)
  | { tipo: 'pg'; url: string };

export interface Conexion {
  db: Db;
  /** Ejecuta SQL crudo sin parámetros (admite varias sentencias): DDL_CREAR, DDL_BORRAR. */
  ejecutarSql(sql: string): Promise<void>;
  cerrar(): Promise<void>;
}

declare global {
  var __nexo: Promise<Conexion> | undefined;
}

/** DATABASE_URL → pg; si no, PGlite en NEXO_DATA_DIR o path.join(process.cwd(), '.data', 'pglite'). */
export function modoDesdeEntorno(env: Record<string, string | undefined> = process.env): ModoConexion {
  if (env.DATABASE_URL) return { tipo: 'pg', url: env.DATABASE_URL };
  return { tipo: 'pglite', dir: env.NEXO_DATA_DIR || path.join(process.cwd(), '.data', 'pglite') };
}

async function abrirPglite(dir: string | null): Promise<Conexion> {
  const [{ PGlite }, { drizzle }] = await Promise.all([import('@electric-sql/pglite'), import('drizzle-orm/pglite')]);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const cliente = await PGlite.create(dir ?? undefined);
  const db = drizzle(cliente, { schema: esquema }) as unknown as Db;
  return {
    db,
    ejecutarSql: async (sql) => {
      await cliente.exec(sql);
    },
    cerrar: () => cliente.close(),
  };
}

async function abrirPg(url: string): Promise<Conexion> {
  const [{ default: pg }, { drizzle }] = await Promise.all([import('pg'), import('drizzle-orm/node-postgres')]);
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema: esquema }) as unknown as Db;
  return {
    db,
    ejecutarSql: async (sql) => {
      await pool.query(sql);
    },
    cerrar: () => pool.end(),
  };
}

/** Abre la conexión y ejecuta DDL_CREAR. No carga la semilla (eso lo decide quien llama). */
export async function crearConexion(modo: ModoConexion): Promise<Conexion> {
  const conexion = modo.tipo === 'pg' ? await abrirPg(modo.url) : await abrirPglite(modo.dir);
  try {
    await conexion.ejecutarSql(DDL_CREAR);
  } catch (e) {
    await conexion.cerrar().catch(() => undefined);
    throw e;
  }
  return conexion;
}

/** Conexión única del proceso (globalThis.__nexo), creada con modoDesdeEntorno(). */
export function obtenerConexion(): Promise<Conexion> {
  if (!globalThis.__nexo) {
    const promesa = crearConexion(modoDesdeEntorno());
    // Si falla, no dejar la promesa rota en caché: el siguiente intento reintenta.
    promesa.catch(() => {
      if (globalThis.__nexo === promesa) globalThis.__nexo = undefined;
    });
    globalThis.__nexo = promesa;
  }
  return globalThis.__nexo;
}
