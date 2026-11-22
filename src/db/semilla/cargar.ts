// Inserta la semilla y fija el reloj en RELOJ_INICIAL_ISO. Tarea 1.4; buzones conectados: reformas v2 (R2).
import {
  buzones,
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
  BUZONES_SEMILLA,
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

export interface OpcionesSemilla {
  /**
   * Inserta los 8 buzones conectados de la demo (docs/08 §2.5). Por defecto sí (reiniciar la demo, `pnpm db:reset`).
   * Sin buzones, Nexo no lee correo: así prepara prepararDemo las pruebas que no son de correo.
   */
  buzones?: boolean;
}

/**
 * Carga la semilla completa en una sola transacción, en orden de claves foráneas.
 * Idempotente: si `personas` ya tiene filas, no hace nada (no duplica datos).
 */
export async function cargarSemilla(db: Db, opciones: OpcionesSemilla = {}): Promise<void> {
  const conBuzones = opciones.buzones ?? true;
  await db.transaction(async (tx) => {
    const [yaCargada] = await tx.select({ id: personas.id }).from(personas).limit(1);
    if (yaCargada) return;

    await tx.insert(personas).values(PERSONAS_SEMILLA);
    await tx.insert(proyectos).values(PROYECTOS_SEMILLA);
    await tx.insert(repuestos).values(REPUESTOS_SEMILLA);
    await tx.insert(trabajos).values(TRABAJOS_SEMILLA.map((t) => ({ ...t, entrega: null })));
    await tx.insert(dependencias).values(DEPENDENCIAS_SEMILLA);
    await tx.insert(necesidadesRepuesto).values(NECESIDADES_SEMILLA);
    await tx.insert(notas).values(NOTAS_SEMILLA);
    await tx.insert(eventos).values(EVENTOS_SEMILLA);
    if (conBuzones) await tx.insert(buzones).values(BUZONES_SEMILLA);
    await tx.insert(reloj).values({ id: 1, ahora: new Date(RELOJ_INICIAL_ISO) });
  });
}
