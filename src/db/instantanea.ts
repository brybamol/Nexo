// Puente entre la base y el motor. Tarea 1.5.
import type { Db } from '@/db/esquema';
import { NoImplementado } from '@/dominio/tipos';
import type { Efecto } from '@/motor/efectos';
import type { Instantanea } from '@/motor/instantanea';

const N = 'db/instantanea.ts (1.5)';

/** Lee todo lo que necesita el motor (incluido reloj.ahora y las opciones de cada decisión). */
export async function cargarInstantanea(db: Db): Promise<Instantanea> {
  void db;
  throw new NoImplementado(N);
}

/** Persiste los efectos en orden. Llamar dentro de la transacción del servicio. Devuelve los ids de las acciones creadas. */
export async function persistirEfectos(db: Db, efectos: Efecto[]): Promise<{ accionIds: number[] }> {
  void db;
  void efectos;
  throw new NoImplementado(N);
}
