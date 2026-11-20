// Reinicia la base de .data desde consola (pnpm db:reset). Usar con `pnpm dev` parado. Tarea 1.5.
import { NoImplementado } from '../src/dominio/tipos';

async function main(): Promise<void> {
  throw new NoImplementado('scripts/reiniciar-db.ts (1.5)');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
