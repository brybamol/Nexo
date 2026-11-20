// Convierte un plan validado en efectos (motor) y los persiste. Tarea 2.3.
import type { Db } from '@/db/esquema';
import { NoImplementado, type Plan } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

export interface ResultadoAplicacion {
  resumen: string;
  trabajosCreados: string[];
  trabajosActualizados: string[];
  decisionId: string | null;
  avisosA: string[];
}

/** Llamar dentro de la transacción del servicio, con la instantánea recién cargada en ella. */
export async function aplicarPlan(
  db: Db,
  inst: Instantanea,
  plan: Plan,
  autorId: string,
  capturaId: number,
): Promise<ResultadoAplicacion> {
  void db;
  void inst;
  void plan;
  void autorId;
  void capturaId;
  throw new NoImplementado('servicios/aplicar.ts (2.3)');
}
