// Lo que los servicios devuelven a la interfaz (§4.4 de docs/05). ARCHIVO DE CONTRATO (§4.0).
// Fechas como Date: la interfaz las formatea en el servidor y pasa texto a los componentes de cliente.
import type {
  Cifras,
  EstadoDecision,
  EstadoTrabajo,
  Implementacion,
  LetraOpcion,
  Marcas,
  OpcionCalculada,
  PersonaBreve,
  TipoAccion,
} from '@/dominio/tipos';
import type { TemaPregunta } from '@/ia/esquema-interpretacion';

export type { Cifras, PersonaBreve };

export type MetaIA = { implementacion: Implementacion; modelo: string | null; respaldo: boolean };

export interface TrabajoVista {
  id: string;
  titulo: string;
  proyecto: { id: string; nombre: string };
  responsable: PersonaBreve;
  solicitadoPor: PersonaBreve | null;
  estado: EstadoTrabajo;
  plazo: Date;
  urgente: boolean;
  conCostoProbable: boolean;
  marcas: Marcas;
  bloqueadoPor: { id: string; titulo: string } | null;
  fechaSolucion: Date | null;
  /** Cadena de dependientes desde este trabajo si está bloqueado (o si bloquea a otro); si no, []. */
  bloquea: string[];
  dependeDe: string[];
  necesita: { repuesto: string; cantidad: number }[];
  seguimiento: { nivel: number; desde: Date } | null;
  notas: { en: Date; autor: string; texto: string }[];
}

export interface AvisoVista {
  id: number;
  en: Date;
  titulo: string;
  cuerpo: string;
  trabajoIds: string[];
  tipoAccion: TipoAccion;
  leido: boolean;
}

export interface OpcionVista extends OpcionCalculada {
  costoTexto: string;
}

export interface DecisionVista {
  id: string;
  estado: EstadoDecision;
  creadaEn: Date;
  proyecto: { id: string; nombre: string };
  proponente: PersonaBreve;
  decisor: PersonaBreve;
  contexto: string;
  afectados: { trabajoId: string; titulo: string; responsable: string }[];
  opciones: OpcionVista[];
  opcionPropuesta: LetraOpcion | null;
  opcionElegida: LetraOpcion | null;
  decididaEn: Date | null;
  motivoRechazo: string | null;
}

export interface MiDia {
  persona: PersonaBreve;
  ahora: Date;
  debo: TrabajoVista[]; // urgente, luego atrasado, luego plazo ascendente
  esperoDeOtros: TrabajoVista[]; // sin repetir, por plazo
  avisos: AvisoVista[]; // más recientes primero, máximo 20
  decisionesPendientes: DecisionVista[];
}

export interface ResumenProyecto {
  id: string;
  nombre: string;
  responsable: PersonaBreve;
  fecha: Date | null;
  total: number;
  abiertos: number;
  enCurso: number;
  bloqueados: number;
  resueltos: number;
  atrasados: number;
  enRiesgo: number;
}

export type ProyectoDetalle = ResumenProyecto & { trabajos: TrabajoVista[] };

export interface AccionVista {
  id: number;
  en: Date;
  tipo: TipoAccion;
  motivo: string;
  hechoOrigen: string;
  trabajoIds: string[];
  destinatario: PersonaBreve | null;
  decisionId: string | null;
}

export interface RespuestaPregunta {
  texto: string;
  tema: TemaPregunta;
  fuentes: { trabajoId: string; etiqueta: string }[];
  datos: Record<string, unknown>;
  /** Presente cuando una misma entrada contiene varias preguntas independientes. */
  respuestas?: { tema: TemaPregunta; texto: string; datos: Record<string, unknown>; fuentes: { trabajoId: string; etiqueta: string }[] }[];
  ia: MetaIA;
}

/** Resultado de avanzarReloj, irAlSiguienteEvento y fijarReloj. `ahora` en ISO. */
export type ResultadoTick = { ahora: string; acciones: AccionVista[] };

export type OpcionRespuesta = { valor: string; etiqueta: string };

export type ResultadoCaptura = { capturaId: number; ia: MetaIA } & (
  | {
      estado: 'aplicada';
      resumen: string;
      trabajosCreados: string[];
      trabajosActualizados: string[];
      decisionId: string | null;
      avisosA: string[];
    }
  | { estado: 'pregunta'; pregunta: string; opciones: OpcionRespuesta[] }
  | { estado: 'duplicado'; trabajoId: string; titulo: string }
  | { estado: 'ignorada'; motivo: string }
  | { estado: 'respuesta'; respuesta: RespuestaPregunta }
  | { estado: 'error'; mensaje: string }
);
