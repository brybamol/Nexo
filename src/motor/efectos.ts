// Efectos: lo único que el motor produce. El tipo Efecto es CONTRATO (§4.0 de docs/05, tarea 1.1);
// la función aplicarEnMemoria la implementa la tarea 1.5.
import type {
  AccionNueva,
  AvisoNuevo,
  Decision,
  EventoNuevo,
  NecesidadRepuesto,
  Repuesto,
  Seguimiento,
  Trabajo,
} from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

export type Efecto =
  | { tipo: 'crear_trabajo'; trabajo: Trabajo; necesidades: NecesidadRepuesto[]; actorId: string | null }
  | {
      tipo: 'actualizar_trabajo';
      trabajoId: string;
      cambios: Partial<Pick<Trabajo, 'estado' | 'plazo' | 'bloqueadoPorId' | 'motivoBloqueo' | 'fechaSolucion' | 'resueltoEn'>>;
      actorId: string | null;
    }
  | { tipo: 'agregar_nota'; trabajoId: string; autorId: string | null; texto: string }
  | {
      tipo: 'actualizar_repuesto';
      repuestoId: string;
      cambios: Partial<Pick<Repuesto, 'existencia' | 'faltanteReportadoEn' | 'faltanteReportadoPor'>>;
      actorId: string | null;
    }
  | {
      tipo: 'actualizar_necesidad';
      trabajoId: string;
      repuestoId: string;
      cambios: { fechaDisponible?: Date | null; atendida?: boolean };
    }
  | { tipo: 'crear_seguimiento'; seguimiento: Seguimiento }
  | { tipo: 'actualizar_seguimiento'; seguimientoId: string; cambios: Partial<Seguimiento> }
  | { tipo: 'crear_decision'; decision: Decision } // decision.opciones van a opciones_decision
  | { tipo: 'actualizar_decision'; decisionId: string; cambios: Partial<Omit<Decision, 'id' | 'opciones'>> }
  | { tipo: 'accion'; accion: AccionNueva; aviso: AvisoNuevo | null } // aviso.personaId = accion.destinatarioId
  | { tipo: 'evento'; evento: EventoNuevo };

/** Aplica los efectos sobre una copia de la instantánea (para comparar antes/después). Puro. Tarea 1.5. */
export function aplicarEnMemoria(inst: Instantanea, efectos: Efecto[]): Instantanea {
  void efectos;
  return inst;
}
