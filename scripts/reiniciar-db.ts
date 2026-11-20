// Reinicia la base de .data desde consola (pnpm db:reset). Usar con `pnpm dev` parado. Tarea 1.5.
import { DDL_BORRAR, DDL_CREAR } from '../src/db/ddl';
import { crearConexion, modoDesdeEntorno, type Conexion } from '../src/db/conexion';
import { cargarSemilla } from '../src/db/semilla/cargar';

async function main(): Promise<void> {
  const modo = modoDesdeEntorno();
  let conexion: Conexion;
  try {
    conexion = await crearConexion(modo);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo abrir la base (${modo.tipo === 'pg' ? 'DATABASE_URL' : (modo.dir ?? 'memoria')}). ` +
        `Si 'pnpm dev' está en marcha, páralo y vuelve a intentarlo, o usa el botón «Reiniciar demo». Detalle: ${detalle}`,
    );
  }
  try {
    await conexion.ejecutarSql(DDL_BORRAR);
    await conexion.ejecutarSql(DDL_CREAR);
    await cargarSemilla(conexion.db);
    console.log('Base reiniciada: esquema recreado y semilla cargada (reloj en mié 25 nov, 7:00).');
  } finally {
    await conexion.cerrar();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
