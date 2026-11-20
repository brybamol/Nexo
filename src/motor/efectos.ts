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

/** Copia de `base` con los campos de `cambios` que no son undefined. */
function fusionar<T extends object>(base: T, cambios: object): T {
  const definidos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
  return { ...base, ...definidos };
}

/**
 * Aplica los efectos sobre una copia de la instantánea (para comparar antes/después). Puro: no modifica `inst`.
 * Las acciones y los eventos no cambian la instantánea (no forman parte de ella). Un efecto sobre un id
 * inexistente se ignora (la base es la que lo rechaza al persistir).
 */
export function aplicarEnMemoria(inst: Instantanea, efectos: Efecto[]): Instantanea {
  let { trabajos, repuestos, necesidades, seguimientos, decisiones } = inst;
  for (const e of efectos) {
    switch (e.tipo) {
      case 'crear_trabajo':
        trabajos = [...trabajos, e.trabajo];
        necesidades = [...necesidades, ...e.necesidades];
        break;
      case 'actualizar_trabajo':
        trabajos = trabajos.map((t) => (t.id === e.trabajoId ? fusionar(t, e.cambios) : t));
        break;
      case 'actualizar_repuesto':
        repuestos = repuestos.map((r) => (r.id === e.repuestoId ? fusionar(r, e.cambios) : r));
        break;
      case 'actualizar_necesidad':
        necesidades = necesidades.map((n) =>
          n.trabajoId === e.trabajoId && n.repuestoId === e.repuestoId ? fusionar(n, e.cambios) : n,
        );
        break;
      case 'crear_seguimiento':
        seguimientos = [...seguimientos, e.seguimiento];
        break;
      case 'actualizar_seguimiento':
        seguimientos = seguimientos.map((s) => (s.id === e.seguimientoId ? fusionar(s, e.cambios) : s));
        break;
      case 'crear_decision':
        decisiones = [...decisiones, e.decision];
        break;
      case 'actualizar_decision':
        decisiones = decisiones.map((d) => (d.id === e.decisionId ? fusionar(d, e.cambios) : d));
        break;
      case 'agregar_nota':
      case 'accion':
      case 'evento':
        break;
    }
  }
  return { ...inst, trabajos, repuestos, necesidades, seguimientos, decisiones };
}
