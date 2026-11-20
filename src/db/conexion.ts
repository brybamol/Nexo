// Conexión a la base: PGlite (local y pruebas) o pg (si hay DATABASE_URL). Tarea 1.2.
// Singleton en globalThis.__nexo con la PROMESA de inicialización; nunca abrir PGlite al importar el módulo.
import type { Db } from '@/db/esquema';
import { NoImplementado } from '@/dominio/tipos';

const N = 'db/conexion.ts (1.2)';

export type ModoConexion =
  | { tipo: 'pglite'; dir: string | null } // null = en memoria (pruebas)
  | { tipo: 'pg'; url: string };

export interface Conexion {
  db: Db;
  /** Ejecuta SQL crudo sin parámetros (admite varias sentencias): DDL_CREAR, DDL_BORRAR. */
  ejecutarSql(sql: string): Promise<void>;
  cerrar(): Promise<void>;
}

/** DATABASE_URL → pg; si no, PGlite en NEXO_DATA_DIR o path.join(process.cwd(), '.data', 'pglite'). */
export function modoDesdeEntorno(env: Record<string, string | undefined> = process.env): ModoConexion {
  void env;
  throw new NoImplementado(N);
}

/** Abre la conexión y ejecuta DDL_CREAR. No carga la semilla (eso lo decide quien llama). */
export async function crearConexion(modo: ModoConexion): Promise<Conexion> {
  void modo;
  throw new NoImplementado(N);
}

/** Conexión única del proceso (globalThis.__nexo), creada con modoDesdeEntorno(). */
export async function obtenerConexion(): Promise<Conexion> {
  throw new NoImplementado(N);
}
