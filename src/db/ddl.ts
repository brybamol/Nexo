// SQL idempotente del esquema (§3.4 de docs/05). Debe coincidir con db/esquema.ts. Tarea 1.2.
// Se ejecuta con el cliente crudo (pglite.exec / pool.query), sin parámetros y con varias sentencias.

/** CREATE TABLE IF NOT EXISTS de todas las tablas, en orden de claves foráneas. */
export const DDL_CREAR = '';

/** DROP TABLE IF EXISTS … CASCADE de todas las tablas. */
export const DDL_BORRAR = '';
