// Ayudantes de prueba (§6 de docs/05). Tarea 1.5; opción `correo`: reformas v2 (docs/08 §2.5, tarea R2).
import { eq } from 'drizzle-orm';
import { crearConexion } from '@/db/conexion';
import { reloj } from '@/db/esquema';
import { cargarSemilla } from '@/db/semilla/cargar';
import {
  DEPENDENCIAS_SEMILLA,
  NECESIDADES_SEMILLA,
  PERSONAS_SEMILLA,
  PROYECTOS_SEMILLA,
  REPUESTOS_SEMILLA,
  TRABAJOS_SEMILLA,
} from '@/db/semilla/datos';
import { RELOJ_INICIAL_ISO } from '@/dominio/constantes';
import { enCR } from '@/dominio/tiempo';
import { InterpreteLocal } from '@/ia/local/interprete-local';
import type { Instantanea } from '@/motor/instantanea';
import type { ContextoServicio } from '@/servicios/contexto';

export interface Demo {
  ctx: ContextoServicio;
  cerrar(): Promise<void>;
}

export interface OpcionesDemo {
  /** 'HH:mm' del mié 25 (por defecto 07:05). */
  hora?: string;
  /**
   * Con `true`, la semilla trae los 8 buzones conectados (BUZONES_DEMO) y Nexo lee el correo al mover el reloj.
   * Por defecto `false`: sin buzones conectados, ninguna prueba existente lee correo (docs/08 §2.5).
   */
  correo?: boolean;
}

/** PGlite en memoria, DDL, semilla, intérprete Local y reloj fijado SIN tick a esa hora del mié 25 (por defecto 07:05). */
export async function prepararDemo(opciones?: OpcionesDemo): Promise<Demo> {
  const hora = opciones?.hora ?? '07:05';
  const correo = opciones?.correo ?? false;
  if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error(`Hora no válida para prepararDemo: '${hora}' (se espera HH:mm).`);
  const conexion = await crearConexion({ tipo: 'pglite', dir: null });
  try {
    await cargarSemilla(conexion.db, { buzones: correo });
    await conexion.db.update(reloj).set({ ahora: enCR('2026-11-25', hora) }).where(eq(reloj.id, 1));
  } catch (error) {
    await conexion.cerrar().catch(() => undefined);
    throw error;
  }
  return { ctx: { db: conexion.db, ia: new InterpreteLocal() }, cerrar: () => conexion.cerrar() };
}

/** Instantánea de la semilla sin base, para pruebas puras (ahora = mié 25 7:00). Cada llamada devuelve copias nuevas. */
export function instantaneaDesdeSemilla(): Instantanea {
  return structuredClone({
    ahora: new Date(RELOJ_INICIAL_ISO),
    personas: PERSONAS_SEMILLA,
    proyectos: PROYECTOS_SEMILLA,
    trabajos: TRABAJOS_SEMILLA,
    dependencias: DEPENDENCIAS_SEMILLA,
    repuestos: REPUESTOS_SEMILLA,
    necesidades: NECESIDADES_SEMILLA,
    seguimientos: [],
    decisiones: [],
    evidencias: [],
    descartados: [],
  });
}
