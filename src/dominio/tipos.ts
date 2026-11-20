// Tipos de dominio de Nexo. ARCHIVO DE CONTRATO (§4.0 de docs/05): congelado tras la tarea 1.1.
// Todo es puro: fechas como Date (instantes), dinero en colones enteros, ids de texto legibles.

// ─── Errores ──────────────────────────────────────────────────────────────────

/** Lo lanza todo esqueleto aún no implementado. El texto indica el archivo (y la tarea dueña). */
export class NoImplementado extends Error {
  constructor(donde: string) {
    super(`no implementado: ${donde}`);
    this.name = 'NoImplementado';
  }
}

/** Error esperable de una regla de negocio (p. ej. «no es el decisor», «la decisión no está pendiente»). */
export class ErrorDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDominio';
  }
}

// ─── Enumeraciones ────────────────────────────────────────────────────────────

export type EstadoTrabajo = 'abierto' | 'en_curso' | 'bloqueado' | 'resuelto';
export type Area = 'Gerencia' | 'Oficina' | 'Bodega' | 'Campo';
export type OrigenTrabajo = 'semilla' | 'captura' | 'decision';
export type NivelSeguimiento = 0 | 1 | 2 | 3; // 0 solicitud, 1 recordatorio, 2 escalamiento 1, 3 escalamiento 2
export type EstadoSeguimiento = 'pendiente' | 'respondido' | 'agotado';
export type EstadoDecision = 'pendiente' | 'aprobada' | 'rechazada';
export type LetraOpcion = 'A' | 'B' | 'C';
export type Proveedor = 'local' | 'habitual';
export type EstadoCaptura = 'aplicada' | 'pregunta' | 'duplicado' | 'ignorada' | 'respuesta' | 'error';
export type Implementacion = 'claude' | 'local';

export type TipoAccion =
  | 'crear_trabajo'
  | 'actualizar_trabajo'
  | 'pedir_estado'
  | 'recordatorio'
  | 'escalamiento'
  | 'aviso'
  | 'crear_decision'
  | 'aplicar_decision'
  | 'responder_pregunta'
  | 'corregir_existencia';

/** Acciones que cuentan como «seguimientos hechos por Nexo» y llevan exactamente un destinatario y un aviso. */
export const TIPOS_ACCION_SEGUIMIENTO = ['pedir_estado', 'recordatorio', 'escalamiento', 'aviso'] as const satisfies readonly TipoAccion[];

export type TipoEvento =
  | 'trabajo_creado'
  | 'estado_cambiado'
  | 'plazo_cambiado'
  | 'nota_agregada'
  | 'existencia_corregida'
  | 'faltante_reportado'
  | 'decision_creada'
  | 'decision_aprobada'
  | 'decision_rechazada'
  | 'respuesta_seguimiento';

// ─── Marcas (calculadas, nunca guardadas) ─────────────────────────────────────

export type CausaRiesgo = {
  tipo: 'bloqueado' | 'atrasado' | 'repuesto' | 'cadena';
  trabajoId?: string;
  repuestoId?: string;
};
export interface Marcas {
  atrasado: boolean;
  enRiesgo: boolean;
  causas: CausaRiesgo[];
}

// ─── Entidades (una por tabla, en camelCase) ──────────────────────────────────

export interface Persona {
  id: string; // 'marcela-solis'
  nombre: string;
  rol: string;
  area: Area;
  jefeId: string | null;
}

/** Forma breve de una persona: la usan las vistas y el contexto de la IA. */
export interface PersonaBreve {
  id: string;
  nombre: string;
  rol: string;
  area: Area;
}

export interface Proyecto {
  id: string; // 'P1'…'P4', 'OD'
  nombre: string;
  resultado: string;
  responsableId: string;
  fecha: Date | null;
  cliente: string | null;
}

export interface Trabajo {
  id: string; // 'T01'…; nuevos 'T31', 'T32'…
  proyectoId: string;
  titulo: string;
  responsableId: string;
  solicitadoPorId: string | null;
  plazo: Date;
  estado: EstadoTrabajo;
  urgente: boolean;
  conCostoProbable: boolean;
  bloqueadoPorId: string | null;
  motivoBloqueo: string | null;
  fechaSolucion: Date | null;
  repuestoId: string | null; // trabajos de conseguir/comprar un repuesto
  cantidadRepuesto: number | null;
  etiqueta: string | null; // 'conciliacion_inventario' en T15
  relacionados: string[];
  origen: OrigenTrabajo;
  capturaId: number | null;
  decisionId: string | null;
  creadoEn: Date;
  resueltoEn: Date | null;
}

/** `trabajoId` depende de `dependeDeId` (no se usa para el bloqueo: ver Trabajo.bloqueadoPorId). */
export interface Dependencia {
  trabajoId: string;
  dependeDeId: string;
}

export interface Repuesto {
  id: string; // 'compresor-2hp', 'termostato', 'empaque-puerta', 'gas-refrigerante', 'motor-ventilador'
  nombre: string;
  unidad: string;
  existencia: number;
  precioHabitual: number;
  diasHabitual: number; // días naturales
  precioLocal: number;
  faltanteReportadoEn: Date | null;
  faltanteReportadoPor: string | null;
}

export interface NecesidadRepuesto {
  trabajoId: string;
  repuestoId: string;
  cantidad: number;
  fechaDisponible: Date | null;
  atendida: boolean;
}

export interface Seguimiento {
  id: string; // 'S1', 'S2'…
  trabajoId: string;
  plazoReferencia: Date;
  nivel: NivelSeguimiento;
  destinatarioId: string;
  urgente: boolean;
  proximoEn: Date;
  estado: EstadoSeguimiento;
  iniciadoEn: Date;
}

export type CambioFecha = { trabajoId: string; de: Date; a: Date };

export interface LineaOpcion {
  proveedor: Proveedor;
  cantidad: number;
  precioUnitario: number;
  llegada: Date;
  trabajoIds: string[];
}

export interface OpcionCalculada {
  letra: LetraOpcion;
  descripcion: string;
  costo: number;
  lineas: LineaOpcion[];
  cambiosFecha: CambioFecha[];
  consecuencia: string;
}

export interface Decision {
  id: string; // 'D01', 'D02'…
  creadaEn: Date;
  proyectoId: string;
  proponenteId: string;
  decisorId: string;
  capturaId: number | null;
  repuestoId: string;
  cantidad: number;
  contexto: string;
  afectados: { trabajoIds: string[]; personaIds: string[] };
  opcionPropuesta: LetraOpcion | null;
  estado: EstadoDecision;
  opcionElegida: LetraOpcion | null;
  decididaEn: Date | null;
  motivoRechazo: string | null;
  /** Filas de `opciones_decision` de esta decisión, en orden A, B, C. */
  opciones: OpcionCalculada[];
}

export interface Evento {
  id: number;
  en: Date;
  actorId: string | null; // null = Nexo
  tipo: TipoEvento;
  trabajoId: string | null;
  decisionId: string | null;
  datos: Record<string, unknown>;
}
export type EventoNuevo = Omit<Evento, 'id'>;

export interface Accion {
  id: number;
  en: Date;
  tipo: TipoAccion;
  motivo: string;
  hechoOrigen: string;
  trabajoIds: string[];
  decisionId: string | null;
  destinatarioId: string | null;
  capturaId: number | null;
}
export type AccionNueva = Omit<Accion, 'id'>;

export interface Aviso {
  id: number;
  personaId: string;
  accionId: number;
  en: Date;
  titulo: string;
  cuerpo: string;
  trabajoIds: string[];
  leidoEn: Date | null;
}
/** Se persiste junto a su acción; `personaId` = `accion.destinatarioId`. */
export type AvisoNuevo = Omit<Aviso, 'id' | 'accionId' | 'leidoEn'>;

// ─── Entradas del motor ───────────────────────────────────────────────────────

/** Plazo tal como lo propone la IA; `resolverPlazo` (dominio/tiempo.ts) lo convierte en instante. */
export type PlazoPropuesto = {
  dia: 'hoy' | 'manana' | (string & {}); // o 'AAAA-MM-DD'
  hora?: string; // 'HH:mm'
};

export type PropuestaCompra = {
  repuestoId: string;
  cantidad: number;
  proveedor: Proveedor | null;
  ajustePrecioPct: number | null;
  existenciaReal: number | null;
};

export type HechoBloqueo = {
  trabajoBloqueadoId: string;
  bloqueanteId: string;
  motivo: string;
  repuestoFaltanteId: string | null;
  autorId: string;
  descripcion: string;
};

// ─── Plan validado (salida de servicios/validacion.ts, entrada de servicios/aplicar.ts) ──
// Es la Interpretacion de la IA ya comprobada contra la base: ids existentes y plazos resueltos a instantes.

export interface PlanTrabajoNuevo {
  tipo: 'trabajo_nuevo';
  titulo: string;
  proyectoId: string;
  responsableId: string;
  plazo: Date;
  urgente: boolean;
  conCostoProbable: boolean;
  relacionados: string[];
  bloquea: string[];
  repuestoFaltanteId: string | null;
}

export interface PlanActualizacion {
  tipo: 'actualizacion';
  trabajoId: string;
  nuevoEstado: EstadoTrabajo | null;
  nota: string | null;
  hayProblema: boolean;
  reprogramar: { trabajoId: string; plazo: Date }[];
  notasRelacionadas: { trabajoId: string; nota: string }[];
}

export interface PlanDuplicado {
  tipo: 'duplicado';
  trabajoId: string;
}

export interface PlanDecision {
  tipo: 'decision';
  proyectoId: string;
  resumen: string;
  propuesta: PropuestaCompra;
  trabajoRelacionadoId: string | null;
}

export interface PlanNoEsTrabajo {
  tipo: 'no_es_trabajo';
  motivo: string;
}

export interface PlanPregunta {
  tipo: 'pregunta';
  pregunta: string;
}

export type Plan = PlanTrabajoNuevo | PlanActualizacion | PlanDuplicado | PlanDecision | PlanNoEsTrabajo | PlanPregunta;

// ─── Cifras de la demo (03 §5) ────────────────────────────────────────────────

export interface Cifras {
  resueltosSinGerente: number;
  resueltosTotal: number;
  porcentaje: number; // entero
  seguimientos: number;
  preguntasRespondidas: number;
  minutosAhorrados: number;
  horasAhorradas: number; // 1 decimal
}
