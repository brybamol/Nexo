// Tipos del giro a correo (docs/06). Prototipo: todo es puro y determinista; la hora llega como argumento.
import type { EstadoTrabajo } from '@/dominio/tipos';

// ── Fuentes: cada proveedor entrega su forma; un adaptador la lleva a `MensajeCorreo` ─────────────────────

export type Proveedor = 'gmail' | 'outlook';

export interface DireccionGraph {
  emailAddress: { name: string; address: string };
}

/** Subconjunto de `message` de Microsoft Graph que Nexo usa. Cada buzón tiene su propio `id` del mensaje. */
export interface MensajeGraph {
  id: string;
  conversationId: string;
  internetMessageId: string;
  subject: string;
  from: DireccionGraph;
  toRecipients: DireccionGraph[];
  ccRecipients: DireccionGraph[];
  sentDateTime: string;
  body: { contentType: 'text' | 'html'; content: string };
  webLink: string;
  internetMessageHeaders?: { name: string; value: string }[];
}

export interface BuzonGraph {
  personaId: string;
  direccion: string;
  mensajes: MensajeGraph[];
}

/** Parte MIME de la API de Gmail (`users.messages.get`, `format=full`). `body.data` va en base64url. */
export interface ParteGmail {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body: { size: number; data?: string; attachmentId?: string };
  parts?: ParteGmail[];
}

/**
 * Subconjunto de `Message` de la API de Gmail que Nexo usa. `id` y `threadId` solo valen dentro de un buzón:
 * el mismo correo tiene otro `id` y otro `threadId` en el buzón de cada persona.
 */
export interface MensajeGmail {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  /** Milisegundos desde 1970, como texto. */
  internalDate: string;
  payload: ParteGmail;
}

export interface BuzonGmail {
  personaId: string;
  direccion: string;
  mensajes: MensajeGmail[];
}

/** Un mensaje ya normalizado, venga de Gmail o de Outlook. Es lo único que ve el resto del flujo. */
export interface MensajeCorreo {
  /** `id` del mensaje en este buzón. */
  idEnBuzon: string;
  /** Hilo según el proveedor (`threadId` o `conversationId`); solo vale dentro de este buzón. */
  hiloEnBuzon: string;
  /** Encabezado `Message-ID`: el mismo en todos los buzones. */
  idInternet: string;
  /** `In-Reply-To` y `References`: unen el hilo entre buzones distintos. */
  respondeA: string[];
  asunto: string;
  de: { nombre: string; correo: string };
  para: string[];
  cc: string[];
  enviado: Date;
  /** Texto plano del cuerpo. */
  texto: string;
  /** Enlace para abrirlo en el correo de la persona dueña del buzón. */
  enlace: string;
  /** Lista de correo o promoción (`List-Unsubscribe`, categoría Promociones, etc.). */
  automatico: boolean;
}

/** Buzón conectado de una persona, ya normalizado: sus mensajes de entrada y de enviados. */
export interface Buzon {
  personaId: string;
  direccion: string;
  proveedor: Proveedor;
  mensajes: MensajeCorreo[];
}

// ── Empresa ─────────────────────────────────────────────────────────────────────────────────────────

export interface PersonaCorreo {
  id: string;
  nombre: string;
  rol: string;
  departamento: string;
  correo: string;
  jefeId: string | null;
}

export interface EmpresaCorreo {
  nombre: string;
  dominio: string;
  /** Dominios externos que cuentan como laborales (proveedores, clientes, banco). */
  dominiosLaborales: string[];
  personas: PersonaCorreo[];
}

// ── Privacidad y unión ──────────────────────────────────────────────────────────────────────────────

export type ClasePrivacidad = 'laboral' | 'personal' | 'boletin';

/** Un mensaje laboral, ya sin duplicados entre buzones. */
export interface MensajeUnido {
  internetMessageId: string;
  hiloId: string;
  asunto: string;
  deCorreo: string;
  paraCorreos: string[];
  ccCorreos: string[];
  enviado: Date;
  texto: string;
  /** Buzón → enlace al correo. Solo quien tiene el mensaje en su buzón puede abrirlo. */
  enlaces: Record<string, string>;
}

export interface Hilo {
  id: string;
  asunto: string;
  mensajes: MensajeUnido[];
}

export interface ConteoBuzon {
  personaId: string;
  proveedor: Proveedor;
  leidos: number;
  laborales: number;
  personales: number;
  boletines: number;
}

// ── Extracción ──────────────────────────────────────────────────────────────────────────────────────

export interface Evidencia {
  cita: string;
  autorId: string | null;
  en: Date;
  mensajeId: string;
  enlaces: Record<string, string>;
}

export type TipoEspera = 'dependencia' | 'bloqueo';

/** Lo que dice el correo; `compromisoId` lo resuelve el enlace entre hilos (null = no se sabe de cuál depende). */
export interface Espera {
  tipo: TipoEspera;
  texto: string;
  actor: string | null;
  objeto: string;
  compromisoId: string | null;
}

export type TipoRevision = 'propuesto' | 'confirmado' | 'corregido';

export interface Compromiso {
  id: string;
  titulo: string;
  solicitanteId: string | null;
  responsableId: string | null;
  plazo: Date | null;
  monto: number | null;
  estado: EstadoTrabajo;
  resueltoEn: Date | null;
  esperaA: Espera | null;
  insistencias: number;
  evidencias: Evidencia[];
  hiloId: string;
  asunto: string;
  proyecto: string;
  revision: { tipo: TipoRevision; porId: string | null; en: Date | null };
}

// ── Correcciones (lo único que se guarda) ───────────────────────────────────────────────────────────

export type TipoCorreccion = 'confirmar' | 'corregir' | 'descartar';

export interface CambiosCorreccion {
  titulo?: string;
  responsableId?: string;
  plazo?: string; // ISO
  estado?: EstadoTrabajo;
}

export interface CorreccionCorreo {
  compromisoId: string;
  personaId: string;
  en: Date;
  tipo: TipoCorreccion;
  cambios: CambiosCorreccion;
}

// ── Modelo vivo ─────────────────────────────────────────────────────────────────────────────────────

export type CausaCorreo =
  | { tipo: 'atrasado' }
  | { tipo: 'espera'; compromisoId: string; motivo: 'atrasado' | 'bloqueado' | 'en_riesgo' | 'plazo_posterior' };

export interface MarcasCorreo {
  atrasado: boolean;
  enRiesgo: boolean;
  causas: CausaCorreo[];
}

export interface CompromisoConMarcas extends Compromiso {
  /** Código de la especificación (C1…C7, docs/06 §9): interno, no se muestra. */
  codigo: string;
  /**
   * Referencia visible: clave del proyecto y número dentro del proyecto (TRANSLOG-2), o '' si no pertenece a un
   * proyecto con nombre propio. Se fija antes de aplicar correcciones, así que no cambia si alguien descarta otro.
   */
  referencia: string;
  marcas: MarcasCorreo;
}

/** Cadena de espera: del que espera (primero) al último que bloquea. */
export interface Cadena {
  compromisoIds: string[];
}

export interface ProyectoCorreo {
  nombre: string;
  compromisoIds: string[];
  cadenas: Cadena[];
}

export interface ModeloCorreo {
  ahora: Date;
  empresa: EmpresaCorreo;
  compromisos: CompromisoConMarcas[];
  proyectos: ProyectoCorreo[];
  conteos: ConteoBuzon[];
  /** Personas a las que esperan cadenas de dos o más proyectos distintos, o dos o más cadenas. */
  cuellos: { personaId: string; cadenas: number; proyectos: string[] }[];
}
