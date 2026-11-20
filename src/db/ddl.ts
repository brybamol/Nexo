// SQL idempotente del esquema (§3.4 de docs/05). Debe coincidir con db/esquema.ts. Tarea 1.2.
// Se ejecuta con el cliente crudo (pglite.exec / pool.query), sin parámetros y con varias sentencias.

/** CREATE TABLE IF NOT EXISTS de todas las tablas, en orden de claves foráneas. */
export const DDL_CREAR = `
CREATE TABLE IF NOT EXISTS personas (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  rol text NOT NULL,
  area text NOT NULL,
  jefe_id text REFERENCES personas(id)
);

CREATE TABLE IF NOT EXISTS proyectos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  resultado text NOT NULL,
  responsable_id text NOT NULL REFERENCES personas(id),
  fecha timestamptz,
  cliente text
);

CREATE TABLE IF NOT EXISTS repuestos (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  unidad text NOT NULL,
  existencia integer NOT NULL,
  precio_habitual integer NOT NULL,
  dias_habitual integer NOT NULL,
  precio_local integer NOT NULL,
  faltante_reportado_en timestamptz,
  faltante_reportado_por text REFERENCES personas(id)
);

CREATE TABLE IF NOT EXISTS trabajos (
  id text PRIMARY KEY,
  proyecto_id text NOT NULL REFERENCES proyectos(id),
  titulo text NOT NULL,
  responsable_id text NOT NULL REFERENCES personas(id),
  solicitado_por_id text REFERENCES personas(id),
  plazo timestamptz NOT NULL,
  estado text NOT NULL,
  urgente boolean NOT NULL DEFAULT false,
  con_costo_probable boolean NOT NULL DEFAULT false,
  bloqueado_por_id text REFERENCES trabajos(id),
  motivo_bloqueo text,
  fecha_solucion timestamptz,
  repuesto_id text REFERENCES repuestos(id),
  cantidad_repuesto integer,
  etiqueta text,
  relacionados jsonb NOT NULL DEFAULT '[]'::jsonb,
  origen text NOT NULL,
  captura_id integer,
  decision_id text,
  creado_en timestamptz NOT NULL,
  resuelto_en timestamptz
);

CREATE TABLE IF NOT EXISTS dependencias (
  trabajo_id text NOT NULL REFERENCES trabajos(id),
  depende_de_id text NOT NULL REFERENCES trabajos(id),
  PRIMARY KEY (trabajo_id, depende_de_id)
);

CREATE TABLE IF NOT EXISTS necesidades_repuesto (
  trabajo_id text NOT NULL REFERENCES trabajos(id),
  repuesto_id text NOT NULL REFERENCES repuestos(id),
  cantidad integer NOT NULL,
  fecha_disponible timestamptz,
  atendida boolean NOT NULL DEFAULT false,
  PRIMARY KEY (trabajo_id, repuesto_id)
);

CREATE TABLE IF NOT EXISTS notas (
  id serial PRIMARY KEY,
  trabajo_id text NOT NULL REFERENCES trabajos(id),
  autor_id text,
  en timestamptz NOT NULL,
  texto text NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos (
  id serial PRIMARY KEY,
  en timestamptz NOT NULL,
  actor_id text,
  tipo text NOT NULL,
  trabajo_id text,
  decision_id text,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS acciones (
  id serial PRIMARY KEY,
  en timestamptz NOT NULL,
  tipo text NOT NULL,
  motivo text NOT NULL,
  hecho_origen text NOT NULL,
  trabajo_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision_id text,
  destinatario_id text,
  captura_id integer
);

CREATE TABLE IF NOT EXISTS avisos (
  id serial PRIMARY KEY,
  persona_id text NOT NULL REFERENCES personas(id),
  accion_id integer NOT NULL REFERENCES acciones(id),
  en timestamptz NOT NULL,
  titulo text NOT NULL,
  cuerpo text NOT NULL,
  trabajo_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  leido_en timestamptz
);

CREATE TABLE IF NOT EXISTS seguimientos (
  id text PRIMARY KEY,
  trabajo_id text NOT NULL REFERENCES trabajos(id),
  plazo_referencia timestamptz NOT NULL,
  nivel integer NOT NULL,
  destinatario_id text NOT NULL REFERENCES personas(id),
  urgente boolean NOT NULL DEFAULT false,
  proximo_en timestamptz NOT NULL,
  estado text NOT NULL,
  iniciado_en timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS decisiones (
  id text PRIMARY KEY,
  creada_en timestamptz NOT NULL,
  proyecto_id text NOT NULL,
  proponente_id text NOT NULL,
  decisor_id text NOT NULL,
  captura_id integer,
  repuesto_id text NOT NULL,
  cantidad integer NOT NULL,
  contexto text NOT NULL,
  afectados jsonb NOT NULL,
  opcion_propuesta text,
  estado text NOT NULL,
  opcion_elegida text,
  decidida_en timestamptz,
  motivo_rechazo text
);

CREATE TABLE IF NOT EXISTS opciones_decision (
  decision_id text NOT NULL REFERENCES decisiones(id),
  letra text NOT NULL,
  descripcion text NOT NULL,
  costo integer NOT NULL,
  lineas jsonb NOT NULL,
  cambios_fecha jsonb NOT NULL,
  consecuencia text NOT NULL,
  PRIMARY KEY (decision_id, letra)
);

CREATE TABLE IF NOT EXISTS capturas (
  id serial PRIMARY KEY,
  autor_id text NOT NULL,
  texto text NOT NULL,
  en timestamptz NOT NULL,
  implementacion text NOT NULL,
  modelo text,
  interpretacion jsonb,
  estado text NOT NULL,
  pregunta text,
  resultado jsonb
);

CREATE TABLE IF NOT EXISTS preguntas (
  id serial PRIMARY KEY,
  persona_id text NOT NULL,
  en timestamptz NOT NULL,
  texto text NOT NULL,
  tema text NOT NULL,
  respuesta text NOT NULL,
  fuentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  implementacion text NOT NULL,
  modelo text
);

CREATE TABLE IF NOT EXISTS reloj (
  id integer PRIMARY KEY,
  ahora timestamptz NOT NULL
);
`;

/** DROP TABLE IF EXISTS … CASCADE de todas las tablas. */
export const DDL_BORRAR = `
DROP TABLE IF EXISTS reloj CASCADE;
DROP TABLE IF EXISTS preguntas CASCADE;
DROP TABLE IF EXISTS capturas CASCADE;
DROP TABLE IF EXISTS opciones_decision CASCADE;
DROP TABLE IF EXISTS decisiones CASCADE;
DROP TABLE IF EXISTS seguimientos CASCADE;
DROP TABLE IF EXISTS avisos CASCADE;
DROP TABLE IF EXISTS acciones CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS notas CASCADE;
DROP TABLE IF EXISTS necesidades_repuesto CASCADE;
DROP TABLE IF EXISTS dependencias CASCADE;
DROP TABLE IF EXISTS trabajos CASCADE;
DROP TABLE IF EXISTS repuestos CASCADE;
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
`;
