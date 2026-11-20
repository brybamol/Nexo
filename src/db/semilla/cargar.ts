// Inserta la semilla y fija el reloj en RELOJ_INICIAL_ISO. Tarea 1.4.
import type { Db } from '@/db/esquema';
import { NoImplementado } from '@/dominio/tipos';

export async function cargarSemilla(db: Db): Promise<void> {
  void db;
  throw new NoImplementado('db/semilla/cargar.ts (1.4)');
}
