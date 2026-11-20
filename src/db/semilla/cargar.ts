// Inserta la semilla y fija el reloj en RELOJ_INICIAL_ISO. Tarea 1.4.
import {
  dependencias,
  eventos,
  necesidadesRepuesto,
  notas,
  personas,
  proyectos,
  repuestos,
  reloj,
  trabajos,
  type Db,
} from '@/db/esquema';
import {
  DEPENDENCIAS_SEMILLA,
  EVENTOS_SEMILLA,
  NECESIDADES_SEMILLA,
  NOTAS_SEMILLA,
  PERSONAS_SEMILLA,
  PROYECTOS_SEMILLA,
  REPUESTOS_SEMILLA,
  TRABAJOS_SEMILLA,
} from '@/db/semilla/datos';
import { RELOJ_INICIAL_ISO } from '@/dominio/constantes';

/**
 * Carga la semilla completa en una sola transacción, en orden de claves foráneas.
 * Idempotente: si `personas` ya tiene filas, no hace nada (no duplica datos).
 */
export async function cargarSemilla(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    const [yaCargada] = await tx.select({ id: personas.id }).from(personas).limit(1);
    if (yaCargada) return;

    await tx.insert(personas).values(PERSONAS_SEMILLA);
    await tx.insert(proyectos).values(PROYECTOS_SEMILLA);
    await tx.insert(repuestos).values(REPUESTOS_SEMILLA);
    await tx.insert(trabajos).values(TRABAJOS_SEMILLA);
    await tx.insert(dependencias).values(DEPENDENCIAS_SEMILLA);
    await tx.insert(necesidadesRepuesto).values(NECESIDADES_SEMILLA);
    await tx.insert(notas).values(NOTAS_SEMILLA);
    await tx.insert(eventos).values(EVENTOS_SEMILLA);
    await tx.insert(reloj).values({ id: 1, ahora: new Date(RELOJ_INICIAL_ISO) });
  });
}
