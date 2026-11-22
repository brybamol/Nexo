// Efectos: lo único que el motor produce. El tipo Efecto es CONTRATO (§4.0 de docs/05, tarea 1.1; ampliado por las
// reformas v2, docs/08 §4, tarea R2); la función aplicarEnMemoria la implementa la tarea 1.5 (y R2 para lo nuevo).
import type {
  AccionNueva,
  AvisoNuevo,
  Decision,
  Dependencia,
  EventoNuevo,
  EvidenciaNueva,
  EvidenciaTrabajo,
  MensajeLeidoNuevo,
  NecesidadRepuesto,
  Repuesto,
  RevisionNueva,
  Seguimiento,
  Trabajo,
} from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/** Campos de un trabajo que un efecto puede cambiar. */
export type CambiosTrabajo = Partial<
  Pick<
    Trabajo,
    | 'estado'
    | 'plazo'
    | 'bloqueadoPorId'
    | 'motivoBloqueo'
    | 'fechaSolucion'
    | 'resueltoEn'
    | 'responsableId'
    // Reformas v2
    | 'titulo'
    | 'proyectoId'
    | 'numero'
    | 'confirmacion'
    | 'confirmadoPorId'
    | 'entrega'
  >
>;

export type Efecto =
  | { tipo: 'crear_trabajo'; trabajo: Trabajo; necesidades: NecesidadRepuesto[]; actorId: string | null }
  | {
      tipo: 'actualizar_trabajo';
      trabajoId: string;
      /** `confirmacion: 'descartado'` saca el trabajo de la instantánea y lo pasa a `descartados` (regla 16). */
      cambios: CambiosTrabajo;
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
  | { tipo: 'evento'; evento: EventoNuevo }
  // ── Reformas v2 (docs/08 §4) ──
  /** Nueva fila de `dependencias` (regla 13). Evento derivado `dependencia_creada` con este actor. */
  | { tipo: 'crear_dependencia'; dependencia: Dependencia; actorId: string | null }
  /**
   * Nueva evidencia. En memoria recibe el id provisional máximo + 1 (en orden); persistirEfectos traduce ese id al real,
   * así que un `actualizar_evidencia` posterior del mismo lote puede usarlo. Evento derivado `evidencia_agregada`.
   */
  | { tipo: 'agregar_evidencia'; evidencia: EvidenciaNueva }
  | { tipo: 'actualizar_evidencia'; evidenciaId: number; cambios: { buzones?: string[]; enlaces?: Record<string, string> } }
  /** Copias leídas (no cambian la instantánea). */
  | { tipo: 'registrar_mensajes'; mensajes: MensajeLeidoNuevo[] }
  /** Revisión humana de una propuesta (no cambia la instantánea). */
  | { tipo: 'registrar_revision'; revision: RevisionNueva };

/** Copia de `base` con los campos de `cambios` que no son undefined. */
function fusionar<T extends object>(base: T, cambios: object): T {
  const definidos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
  return { ...base, ...definidos };
}

/** Siguiente id provisional de evidencia: máximo + 1 (la base asigna el real; persistirEfectos los empareja). */
export function siguienteIdEvidencia(evidencias: readonly Pick<EvidenciaTrabajo, 'id'>[]): number {
  return Math.max(0, ...evidencias.map((e) => e.id)) + 1;
}

/**
 * Aplica los efectos sobre una copia de la instantánea (para comparar antes/después). Puro: no modifica `inst`.
 * Las acciones, los eventos, las notas, los mensajes leídos y las revisiones no cambian la instantánea (no forman
 * parte de ella). Un efecto sobre un id inexistente se ignora (la base es la que lo rechaza al persistir).
 * Descartar un trabajo (`confirmacion: 'descartado'`) lo mueve a `descartados` y quita sus dependencias (en los dos
 * sentidos), necesidades y seguimientos, como hace cargarInstantanea; sus evidencias se quedan.
 */
export function aplicarEnMemoria(inst: Instantanea, efectos: Efecto[]): Instantanea {
  let { trabajos, dependencias, repuestos, necesidades, seguimientos, decisiones, evidencias, descartados } = inst;
  for (const e of efectos) {
    switch (e.tipo) {
      case 'crear_trabajo':
        trabajos = [...trabajos, e.trabajo];
        necesidades = [...necesidades, ...e.necesidades];
        break;
      case 'actualizar_trabajo': {
        const actual = trabajos.find((t) => t.id === e.trabajoId);
        if (!actual) break;
        const nuevo = fusionar(actual, e.cambios);
        if (nuevo.confirmacion === 'descartado') {
          const id = nuevo.id;
          trabajos = trabajos.filter((t) => t.id !== id);
          descartados = [...descartados, { id, proyectoId: nuevo.proyectoId, numero: nuevo.numero }];
          dependencias = dependencias.filter((d) => d.trabajoId !== id && d.dependeDeId !== id);
          necesidades = necesidades.filter((n) => n.trabajoId !== id);
          seguimientos = seguimientos.filter((s) => s.trabajoId !== id);
        } else {
          trabajos = trabajos.map((t) => (t.id === e.trabajoId ? nuevo : t));
        }
        break;
      }
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
      case 'crear_dependencia': {
        const { trabajoId, dependeDeId } = e.dependencia;
        if (!dependencias.some((d) => d.trabajoId === trabajoId && d.dependeDeId === dependeDeId)) {
          dependencias = [...dependencias, { trabajoId, dependeDeId }];
        }
        break;
      }
      case 'agregar_evidencia':
        evidencias = [...evidencias, { ...e.evidencia, id: siguienteIdEvidencia(evidencias) }];
        break;
      case 'actualizar_evidencia':
        evidencias = evidencias.map((x) => (x.id === e.evidenciaId ? fusionar(x, e.cambios) : x));
        break;
      case 'agregar_nota':
      case 'accion':
      case 'evento':
      case 'registrar_mensajes':
      case 'registrar_revision':
        break;
    }
  }
  return { ...inst, trabajos, dependencias, repuestos, necesidades, seguimientos, decisiones, evidencias, descartados };
}
