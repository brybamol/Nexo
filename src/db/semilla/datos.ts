// Datos de Frío del Valle (docs/04, §3.3 de docs/05) como constantes tipadas. Tarea 1.4.
import type { notas } from '@/db/esquema';
import type {
  Dependencia,
  EventoNuevo,
  NecesidadRepuesto,
  Persona,
  Proyecto,
  Repuesto,
  Trabajo,
} from '@/dominio/tipos';

export const PERSONAS_SEMILLA: Persona[] = [];
export const PROYECTOS_SEMILLA: Proyecto[] = [];
export const REPUESTOS_SEMILLA: Repuesto[] = [];
export const TRABAJOS_SEMILLA: Trabajo[] = [];
export const DEPENDENCIAS_SEMILLA: Dependencia[] = [];
export const NECESIDADES_SEMILLA: NecesidadRepuesto[] = [];
/** Historial inicial de la gerente (§3.3): notas y sus eventos nota_agregada. */
export const NOTAS_SEMILLA: (typeof notas.$inferInsert)[] = [];
export const EVENTOS_SEMILLA: EventoNuevo[] = [];
