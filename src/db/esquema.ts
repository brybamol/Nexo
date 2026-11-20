// Tablas Drizzle (§3.1 de docs/05). ARCHIVO DE CONTRATO (§4.0): congelado tras la tarea 1.1.
// El SQL equivalente (CREATE TABLE IF NOT EXISTS) vive en db/ddl.ts y debe coincidir columna a columna.
// Fechas: timestamptz (mode 'date'). Dinero: integer en colones. Listas: jsonb.
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
  type PgDatabase,
  type PgQueryResultHKT,
} from 'drizzle-orm/pg-core';
import type {
  Area,
  EstadoCaptura,
  EstadoDecision,
  EstadoSeguimiento,
  EstadoTrabajo,
  Implementacion,
  LetraOpcion,
  NivelSeguimiento,
  OrigenTrabajo,
  TipoAccion,
  TipoEvento,
} from '@/dominio/tipos';

const fecha = (nombre: string) => timestamp(nombre, { withTimezone: true, mode: 'date' });

/** Formas jsonb de opciones_decision: las fechas se guardan como texto ISO. */
export type LineaOpcionJson = {
  proveedor: 'local' | 'habitual';
  cantidad: number;
  precioUnitario: number;
  llegada: string;
  trabajoIds: string[];
};
export type CambioFechaJson = { trabajoId: string; de: string; a: string };

export const personas = pgTable('personas', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  rol: text('rol').notNull(),
  area: text('area').$type<Area>().notNull(),
  jefeId: text('jefe_id').references((): AnyPgColumn => personas.id),
});

export const proyectos = pgTable('proyectos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  resultado: text('resultado').notNull(),
  responsableId: text('responsable_id')
    .notNull()
    .references(() => personas.id),
  fecha: fecha('fecha'),
  cliente: text('cliente'),
});

export const repuestos = pgTable('repuestos', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  unidad: text('unidad').notNull(),
  existencia: integer('existencia').notNull(),
  precioHabitual: integer('precio_habitual').notNull(),
  diasHabitual: integer('dias_habitual').notNull(),
  precioLocal: integer('precio_local').notNull(),
  faltanteReportadoEn: fecha('faltante_reportado_en'),
  faltanteReportadoPor: text('faltante_reportado_por').references(() => personas.id),
});

export const trabajos = pgTable('trabajos', {
  id: text('id').primaryKey(),
  proyectoId: text('proyecto_id')
    .notNull()
    .references(() => proyectos.id),
  titulo: text('titulo').notNull(),
  responsableId: text('responsable_id')
    .notNull()
    .references(() => personas.id),
  solicitadoPorId: text('solicitado_por_id').references(() => personas.id),
  plazo: fecha('plazo').notNull(),
  estado: text('estado').$type<EstadoTrabajo>().notNull(),
  urgente: boolean('urgente').notNull().default(false),
  conCostoProbable: boolean('con_costo_probable').notNull().default(false),
  bloqueadoPorId: text('bloqueado_por_id').references((): AnyPgColumn => trabajos.id),
  motivoBloqueo: text('motivo_bloqueo'),
  fechaSolucion: fecha('fecha_solucion'),
  repuestoId: text('repuesto_id').references(() => repuestos.id),
  cantidadRepuesto: integer('cantidad_repuesto'),
  etiqueta: text('etiqueta'),
  relacionados: jsonb('relacionados').$type<string[]>().notNull().default([]),
  origen: text('origen').$type<OrigenTrabajo>().notNull(),
  capturaId: integer('captura_id'),
  decisionId: text('decision_id'),
  creadoEn: fecha('creado_en').notNull(),
  resueltoEn: fecha('resuelto_en'),
});

export const dependencias = pgTable(
  'dependencias',
  {
    trabajoId: text('trabajo_id')
      .notNull()
      .references(() => trabajos.id),
    dependeDeId: text('depende_de_id')
      .notNull()
      .references(() => trabajos.id),
  },
  (t) => [primaryKey({ columns: [t.trabajoId, t.dependeDeId] })],
);

export const necesidadesRepuesto = pgTable(
  'necesidades_repuesto',
  {
    trabajoId: text('trabajo_id')
      .notNull()
      .references(() => trabajos.id),
    repuestoId: text('repuesto_id')
      .notNull()
      .references(() => repuestos.id),
    cantidad: integer('cantidad').notNull(),
    fechaDisponible: fecha('fecha_disponible'),
    atendida: boolean('atendida').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.trabajoId, t.repuestoId] })],
);

export const notas = pgTable('notas', {
  id: serial('id').primaryKey(),
  trabajoId: text('trabajo_id')
    .notNull()
    .references(() => trabajos.id),
  autorId: text('autor_id'), // null = Nexo
  en: fecha('en').notNull(),
  texto: text('texto').notNull(),
});

export const eventos = pgTable('eventos', {
  id: serial('id').primaryKey(),
  en: fecha('en').notNull(),
  actorId: text('actor_id'), // null = Nexo
  tipo: text('tipo').$type<TipoEvento>().notNull(),
  trabajoId: text('trabajo_id'),
  decisionId: text('decision_id'),
  datos: jsonb('datos').$type<Record<string, unknown>>().notNull().default({}),
});

export const acciones = pgTable('acciones', {
  id: serial('id').primaryKey(),
  en: fecha('en').notNull(),
  tipo: text('tipo').$type<TipoAccion>().notNull(),
  motivo: text('motivo').notNull(),
  hechoOrigen: text('hecho_origen').notNull(),
  trabajoIds: jsonb('trabajo_ids').$type<string[]>().notNull().default([]),
  decisionId: text('decision_id'),
  destinatarioId: text('destinatario_id'),
  capturaId: integer('captura_id'),
});

export const avisos = pgTable('avisos', {
  id: serial('id').primaryKey(),
  personaId: text('persona_id')
    .notNull()
    .references(() => personas.id),
  accionId: integer('accion_id')
    .notNull()
    .references(() => acciones.id),
  en: fecha('en').notNull(),
  titulo: text('titulo').notNull(),
  cuerpo: text('cuerpo').notNull(),
  trabajoIds: jsonb('trabajo_ids').$type<string[]>().notNull().default([]),
  leidoEn: fecha('leido_en'),
});

export const seguimientos = pgTable('seguimientos', {
  id: text('id').primaryKey(),
  trabajoId: text('trabajo_id')
    .notNull()
    .references(() => trabajos.id),
  plazoReferencia: fecha('plazo_referencia').notNull(),
  nivel: integer('nivel').$type<NivelSeguimiento>().notNull(),
  destinatarioId: text('destinatario_id')
    .notNull()
    .references(() => personas.id),
  urgente: boolean('urgente').notNull().default(false),
  proximoEn: fecha('proximo_en').notNull(),
  estado: text('estado').$type<EstadoSeguimiento>().notNull(),
  iniciadoEn: fecha('iniciado_en').notNull(),
});

export const decisiones = pgTable('decisiones', {
  id: text('id').primaryKey(),
  creadaEn: fecha('creada_en').notNull(),
  proyectoId: text('proyecto_id').notNull(),
  proponenteId: text('proponente_id').notNull(),
  decisorId: text('decisor_id').notNull(),
  capturaId: integer('captura_id'),
  repuestoId: text('repuesto_id').notNull(),
  cantidad: integer('cantidad').notNull(),
  contexto: text('contexto').notNull(),
  afectados: jsonb('afectados').$type<{ trabajoIds: string[]; personaIds: string[] }>().notNull(),
  opcionPropuesta: text('opcion_propuesta').$type<LetraOpcion>(),
  estado: text('estado').$type<EstadoDecision>().notNull(),
  opcionElegida: text('opcion_elegida').$type<LetraOpcion>(),
  decididaEn: fecha('decidida_en'),
  motivoRechazo: text('motivo_rechazo'),
});

export const opcionesDecision = pgTable(
  'opciones_decision',
  {
    decisionId: text('decision_id')
      .notNull()
      .references(() => decisiones.id),
    letra: text('letra').$type<LetraOpcion>().notNull(),
    descripcion: text('descripcion').notNull(),
    costo: integer('costo').notNull(),
    lineas: jsonb('lineas').$type<LineaOpcionJson[]>().notNull(),
    cambiosFecha: jsonb('cambios_fecha').$type<CambioFechaJson[]>().notNull(),
    consecuencia: text('consecuencia').notNull(),
  },
  (t) => [primaryKey({ columns: [t.decisionId, t.letra] })],
);

export const capturas = pgTable('capturas', {
  id: serial('id').primaryKey(),
  autorId: text('autor_id').notNull(),
  texto: text('texto').notNull(),
  en: fecha('en').notNull(),
  implementacion: text('implementacion').$type<Implementacion>().notNull(),
  modelo: text('modelo'),
  interpretacion: jsonb('interpretacion').$type<unknown>(),
  estado: text('estado').$type<EstadoCaptura>().notNull(),
  pregunta: text('pregunta'),
  resultado: jsonb('resultado').$type<unknown>(),
});

export const preguntas = pgTable('preguntas', {
  id: serial('id').primaryKey(),
  personaId: text('persona_id').notNull(),
  en: fecha('en').notNull(),
  texto: text('texto').notNull(),
  tema: text('tema').notNull(),
  respuesta: text('respuesta').notNull(),
  fuentes: jsonb('fuentes').$type<{ trabajoId: string; etiqueta: string }[]>().notNull().default([]),
  implementacion: text('implementacion').$type<Implementacion>().notNull(),
  modelo: text('modelo'),
});

export const reloj = pgTable('reloj', {
  id: integer('id').primaryKey(), // siempre 1
  ahora: fecha('ahora').notNull(),
});

/** Todas las tablas; se pasa como `schema` a drizzle() en db/conexion.ts. */
export const esquema = {
  personas,
  proyectos,
  repuestos,
  trabajos,
  dependencias,
  necesidadesRepuesto,
  notas,
  eventos,
  acciones,
  avisos,
  seguimientos,
  decisiones,
  opcionesDecision,
  capturas,
  preguntas,
  reloj,
};

/** Base de datos de Nexo: sirve igual con PGlite (local, pruebas) y con pg (DATABASE_URL). Las transacciones (tx) también lo cumplen. */
export type Db = PgDatabase<PgQueryResultHKT, typeof esquema>;
