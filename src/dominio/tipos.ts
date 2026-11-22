// Tipos de dominio de Nexo. ARCHIVO DE CONTRATO (§4.0 de docs/05): congelado tras la tarea 1.1.
// Ampliado por las reformas v2 (docs/08 §4, tarea R2) y congelado de nuevo tras ella.
// Todo es puro: fechas como Date (instantes), dinero en colones enteros, ids de texto legibles.

// ─── Errores ──────────────────────────────────────────────────────────────────

/** Lo lanza todo esqueleto aún no implementado. El texto indica el archivo (y la tarea dueña). */
export class NoImplementado extends Error {
  constructor(donde: string) {
    super(`no implementado: ${donde}`);
    this.name = 'NoImplementado';
  }
}

/**
 * Cuerpo de un esqueleto: lanza NoImplementado. Recibe los argumentos solo para que el esqueleto los «use» (sin avisos
 * de lint) hasta que la tarea dueña lo implemente. `donde` = 'R3 · motor/propuestas.ts · efectosRevision'.
 */
export function noImplementado(donde: string, ...argumentos: unknown[]): never {
  void argumentos;
  throw new NoImplementado(donde);
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
export type OrigenTrabajo = 'semilla' | 'captura' | 'decision' | 'correo';
/** Reformas v2 (docs/08 §3 regla 14): lo que Nexo infiere nace propuesto. No es un estado: es un campo aparte. */
export type Confirmacion = 'propuesto' | 'confirmado' | 'descartado';
/** Calculada, nunca guardada (docs/08 regla 18). */
export type Confianza = 'una_fuente' | 'dos_fuentes' | 'persona';
/** `estado`: R1–R3 de siempre; `recepcion`: «¿lo recibiste?» (regla 20); `propuesta`: propuesta sin revisar (regla 15). */
export type TipoSeguimiento = 'estado' | 'recepcion' | 'propuesta';
export type CampoCorregible = 'titulo' | 'responsable' | 'plazo' | 'proyecto';
/** De dónde viene una evidencia o una entrega. */
export type FuenteEvidencia = 'correo' | 'captura' | 'interfaz';
export type TipoEvidencia = 'pedido' | 'aceptacion' | 'espera' | 'entrega' | 'recepcion' | 'insistencia';
/** Proveedor de un buzón conectado (no confundir con `Proveedor`, el de repuestos). */
export type ProveedorCorreo = 'gmail' | 'outlook';
/** Clase de privacidad de un mensaje: solo lo laboral se lee por dentro. */
export type ClaseCorreo = 'laboral' | 'personal' | 'boletin';
/** Qué hizo Nexo con una copia leída (tabla `mensajes_leidos`). */
export type ResultadoLectura =
  | 'propuso'
  | 'creo'
  | 'reconocio'
  | 'entrega'
  | 'espera'
  | 'aceptacion'
  | 'recepcion'
  | 'insistencia'
  | 'sin_compromisos'
  | 'sin_plazo'
  | 'sin_parte'
  | 'descartado';
export type ResultadoRevision = 'confirmada' | 'corregida' | 'descartada';
export type NivelSeguimiento = 0 | 1 | 2 | 3; // 0 solicitud, 1 recordatorio, 2 escalamiento 1, 3 escalamiento 2 (ver motor/escalamiento.ts)
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
  | 'corregir_existencia'
  // Reformas v2 (docs/08 §4)
  | 'leer_correo'
  | 'proponer_trabajo'
  | 'reconocer_correo'
  | 'revisar_propuesta'
  | 'registrar_entrega'
  | 'confirmar_recepcion'
  | 'rechazar_entrega';

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
  | 'respuesta_seguimiento'
  | 'responsable_cambiado' // reforma de escalamiento: el dueño del resultado reasigna un trabajo
  // Reformas v2 (docs/08 §4)
  | 'propuesta_revisada'
  | 'entrega_registrada'
  | 'recepcion_confirmada'
  | 'entrega_rechazada'
  | 'dependencia_creada'
  | 'evidencia_agregada';

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
  /** Clave corta y estable para las referencias visibles: 'COLINA' → 'COLINA-4' (dominio/nombres.ts). */
  clave: string;
  nombre: string;
  resultado: string;
  responsableId: string;
  fecha: Date | null;
  cliente: string | null;
}

export interface Trabajo {
  id: string; // 'T01'…; nuevos 'T31', 'T32'… (interno: nunca se muestra; ver dominio/nombres.ts)
  proyectoId: string;
  /** Número dentro de su proyecto, asignado al crearse y que no cambia: COLINA-4. */
  numero: number;
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
  // ── Reformas v2 (docs/08 §2.1) ──
  /** 'confirmado' para todo lo que no infiere Nexo (semilla, captura, decisión). */
  confirmacion: Confirmacion;
  /** Persona que ve la propuesta y puede revisarla (la parte en cuyo buzón está). Null si nunca fue propuesto. */
  duenoPropuestaId: string | null;
  /** Persona que lo afirmó (regla 14a). Null = confirmado por origen o por dos fuentes. */
  confirmadoPorId: string | null;
  /** «Entregado, por confirmar» (regla 20): no es un estado ni una marca. Null = sin entrega declarada. */
  entrega: Entrega | null;
}

/** Entrega declarada por el responsable (regla 20). En la base es jsonb con `en` en ISO. */
export interface Entrega {
  en: Date;
  porId: string;
  nota: string | null;
  enlace: string | null;
  fuente: FuenteEvidencia;
}

/** Descartado: fuera de la instantánea, pero su número sigue ocupado (regla 16). */
export type TrabajoDescartado = Pick<Trabajo, 'id' | 'proyectoId' | 'numero'>;

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
  /** Personas a las que ya se escaló este seguimiento, en orden (reforma de escalamiento): nunca se repiten. */
  escaladosA: string[];
  /** Reformas v2: qué se sigue. Los de antes y los de R1–R3 son 'estado'. */
  tipo: TipoSeguimiento;
}

// ─── Reformas v2: evidencias, buzones, mensajes leídos y revisiones (docs/08 §2.2) ─

/** Un hecho que respalda un trabajo: lo que dijo el correo, la captura o la interfaz. */
export interface EvidenciaTrabajo {
  id: number;
  trabajoId: string;
  tipo: TipoEvidencia;
  fuente: FuenteEvidencia;
  /** 'c-h3-m1': une los hechos de un mismo pedido entre lecturas. Null fuera del correo. */
  compromisoClave: string | null;
  /** `Message-ID` del correo. Null fuera del correo. */
  mensajeId: string | null;
  /** Personas en cuyo buzón (conectado) está el mensaje. */
  buzones: string[];
  /** personaId → enlace para abrirlo en su correo. Solo se muestra a esa persona. */
  enlaces: Record<string, string>;
  autorId: string | null;
  /** Envío del mensaje o hora de la acción. */
  en: Date;
  /** ≤ MAX_CITA_EVIDENCIA caracteres. */
  cita: string;
}
export type EvidenciaNueva = Omit<EvidenciaTrabajo, 'id'>;

/** Fila de `buzones`: un buzón conectado. */
export interface BuzonConectado {
  personaId: string;
  direccion: string;
  proveedor: ProveedorCorreo;
  conectadoEn: Date;
}

/** Fila de `mensajes_leidos`: una copia (persona × Message-ID) ya procesada. De lo personal y boletines no se guarda nada más. */
export interface MensajeLeido {
  personaId: string;
  idInternet: string;
  enviado: Date;
  leidoEn: Date;
  clase: ClaseCorreo;
  resultado: ResultadoLectura;
  trabajoIds: string[];
}
/** La tabla no tiene id propio: lo nuevo es la fila completa. */
export type MensajeLeidoNuevo = MensajeLeido;

/**
 * Resumen de una lectura de correo (regla 10): sale en ResultadoTick.lectura. Ids internos de trabajo en el orden de
 * los hechos. `leidos`: copias nuevas; `laborales`: mensajes únicos de trabajo; `descartados`: copias personales y
 * boletines; `sinConvertir`: pedidos sin plazo (regla 12c). Correo/tipos.ts lo reexporta.
 */
export interface ResumenLectura {
  leidos: number;
  laborales: number;
  descartados: number;
  creados: string[];
  propuestos: string[];
  reconocidos: string[];
  entregas: string[];
  sinConvertir: number;
}

/** Lo que Nexo propuso o lo que quedó tras revisarlo. En la base, `plazo` va en ISO. */
export interface ValoresPropuesta {
  titulo: string;
  responsableId: string;
  plazo: Date | null;
  proyectoId: string;
}

/** Lo necesario para rehacer el caso: el mensaje (correo) o el texto (captura). En la base, `enviado` va en ISO. */
export type EntradaRevision =
  | { asunto?: string; cita: string; deId?: string | null; paraIds?: string[]; enviado?: Date }
  | { texto: string };

/** Fila de `revisiones`: una revisión humana de una propuesta (regla 16 y 17). */
export interface RevisionPropuesta {
  id: number;
  en: Date;
  personaId: string;
  origen: 'correo' | 'captura';
  trabajoId: string | null;
  capturaId: number | null;
  resultado: ResultadoRevision;
  campos: CampoCorregible[];
  propuesto: ValoresPropuesta;
  /** null si se descartó. */
  final: ValoresPropuesta | null;
  entrada: EntradaRevision;
  motivo: string | null;
}
export type RevisionNueva = Omit<RevisionPropuesta, 'id'>;

/** Cambios de una corrección (regla 16): al menos uno distinto del valor actual. */
export type CambiosPropuesta = Partial<{ titulo: string; responsableId: string; plazo: Date; proyectoId: string }>;

/** Lo que decide quien revisa una propuesta. */
export type EntradaRevisionPropuesta =
  | { tipo: 'confirmar' }
  | { tipo: 'corregir'; cambios: CambiosPropuesta }
  | { tipo: 'descartar'; motivo: string | null };

/** Datos de una captura con pregunta de responsable respondida, para su revisión (regla 17). */
export interface DatosRevisionCaptura {
  capturaId: number;
  /** Quien respondió la pregunta. */
  personaId: string;
  en: Date;
  texto: string;
  titulo: string;
  plazo: Date | null;
  proyectoId: string;
  /** Trabajo creado al responder (null si aún no existe). */
  trabajoId: string | null;
}

/** Cuánto se equivoca Nexo (regla 22). */
export interface TasaCorreccion {
  inferidos: number;
  revisadas: number;
  confirmadas: number;
  corregidas: number;
  descartadas: number;
  porCampo: Record<CampoCorregible, number>;
  confirmadasPorFuentes: number;
  sinRevisar: number;
  /** Entero 0–100; null si nadie ha revisado nada. */
  tasa: number | null;
}

/** Caso de prueba sacado de una revisión: lo que entró, lo que propuso Nexo y lo que debió proponer. */
export interface CasoCorreccion {
  entrada: EntradaRevision;
  propuesto: ValoresPropuesta;
  esperado: ValoresPropuesta | null;
  resultado: ResultadoRevision;
}

/** Quién espera a quién (regla 23), en ids internos. */
export interface CadenaEspera {
  trabajoIds: string[];
  personaIds: string[];
  proyectoIds: string[];
}
export interface CuelloBotella {
  personaId: string;
  proyectoIds: string[];
  /** Personas distintas que esperan detrás (sin contarse a sí misma). */
  esperando: string[];
}
export interface Esperas {
  cadenas: CadenaEspera[];
  cuellos: CuelloBotella[];
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
  id: string; // 'D01', 'D02'… (interno: nunca se muestra; ver dominio/nombres.ts)
  creadaEn: Date;
  proyectoId: string;
  /** Número dentro de su proyecto, asignado al crearse: COLINA-D1. */
  numero: number;
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
