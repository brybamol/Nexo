// Constantes de dominio de Nexo. ARCHIVO DE CONTRATO (§4.0 de docs/05): congelado tras la tarea 1.1.
// Ampliado por las reformas v2 (docs/08 §4, tarea R2) y congelado de nuevo tras ella.

// ─── Zona y horario (Costa Rica no tiene horario de verano: desfase fijo −06:00) ──
export const ZONA = 'America/Costa_Rica';
export const DESFASE_CR = '-06:00';
export const HORA_INICIO = 7; // jornada laboral 7:00–17:00, lunes a viernes
export const HORA_FIN = 17;
export const HORA_PLAZO_SIN_HORA = '17:00'; // plazo sin hora = 17:00 de ese día
export const HORA_PLAZO_URGENTE_HOY = '12:00'; // «hoy» urgente antes de las 12:00

// ─── Reglas ───────────────────────────────────────────────────────────────────
export const UMBRAL_GERENTE = 100_000; // ₡: tope del responsable del proyecto (R6); por encima decide la gerente general
export const MIN_URGENTE = 30; // intervalo de seguimiento de un trabajo urgente
export const HORAS_LABORALES_NORMAL = 4; // intervalo de seguimiento de un trabajo normal
export const HORA_ENTREGA_LOCAL = '15:00'; // el proveedor local entrega el mismo día hábil
export const HORA_LLEGADA_HABITUAL = '07:00'; // el proveedor habitual llega a esta hora
export const MIN_SIGUIENTE_EVENTO_POR_DEFECTO = 30; // irAlSiguienteEvento sin evento pendiente
export const UMBRAL_SIMILITUD = 0.8; // intérprete Local: coincidencia mínima con una frase guardada
export const LIMITE_AVISOS_MI_DIA = 20;

// ─── Reformas v2: correo como fuente (docs/08 §3) ─────────────────────────────
export const DOMINIO_EMPRESA = 'friodelvalle.cr';
export const PREFIJO_TRABAJO_CORREO = 'M'; // trabajos nacidos del correo: M01, M02… (no consumen T31)
export const UMBRAL_MISMO_HECHO = 0.55; // regla 12b: similitud mínima de títulos para «es el mismo hecho»
export const UMBRAL_ENLACE_ESPERA = 0.45; // regla 13: puntaje mínimo para enlazar una espera con un trabajo
export const BONO_ACTOR_ESPERA = 0.25; // regla 13: el actor nombrado coincide con el responsable
export const HORAS_REVISION_PROPUESTA = 4; // regla 15: horas laborales hasta el recordatorio de una propuesta
export const MAX_CITA_EVIDENCIA = 220; // caracteres de la cita de una evidencia
/** Hora en que quedaron conectados los buzones de la demo (lun 23, 7:00 de Costa Rica). */
export const BUZONES_CONECTADOS_EN_ISO = '2026-11-23T07:00:00-06:00';

// ─── Cifras (03 §5): hipótesis de minutos, no medición ────────────────────────
export const MIN_POR_SEGUIMIENTO = 10;
export const MIN_POR_PREGUNTA = 15;

// ─── Roles ────────────────────────────────────────────────────────────────────
export const ROL_GERENTE = 'Gerente general';
export const ROL_JEFE_OPERACIONES = 'Jefe de operaciones';
export const ROL_COMPRAS = 'Encargada de compras';
export const ROL_SERVICIO_CLIENTE = 'Servicio al cliente';

// ─── Personas (id = nombre en minúsculas sin tildes, unido con guion) ─────────
export const PERSONAS = {
  marcela: 'marcela-solis',
  andres: 'andres-vargas',
  ricardo: 'ricardo-brenes',
  paola: 'paola-herrera',
  sofia: 'sofia-navarro',
  karla: 'karla-jimenez',
  lucia: 'lucia-mora',
  diego: 'diego-rojas',
  esteban: 'esteban-castro',
  jose: 'jose-alfaro',
  daniela: 'daniela-quesada',
  mario: 'mario-chaves',
} as const;
export type PersonaId = (typeof PERSONAS)[keyof typeof PERSONAS];

/** Persona del selector «ver como» cuando no hay cookie. */
export const PERSONA_POR_DEFECTO: PersonaId = PERSONAS.marcela;

/**
 * Responsable de la operación: dato de configuración de la empresa (no «el jefe de alguien»). Último recurso del
 * escalamiento cuando nadie de otro proyecto sale perjudicado (R3), puede actuar sobre cualquier trabajo y decide el
 * gasto dentro del tope cuando quien propone es el propio responsable del proyecto (R6). En la demo, Andrés Vargas.
 */
export const RESPONSABLE_OPERACION: PersonaId = PERSONAS.andres;
export const COOKIE_PERSONA = 'nexo_persona';

// ─── Proyectos ────────────────────────────────────────────────────────────────
export const PROYECTOS = {
  camaraFria: 'P1', // Cámara fría La Colina
  trigal: 'P2', // Mantenimiento Trigal
  repuestos: 'P3', // Repuestos críticos
  pedidos: 'P4', // Pedidos de la semana
  operacionDiaria: 'OD', // Operación diaria
} as const;
export type ProyectoId = (typeof PROYECTOS)[keyof typeof PROYECTOS];

/** Clave corta y estable de cada proyecto: prefijo de las referencias que ven las personas (COLINA-4, COLINA-D1). */
export const CLAVES_PROYECTO: Record<ProyectoId, string> = {
  P1: 'COLINA',
  P2: 'TRIGAL',
  P3: 'REPUESTOS',
  P4: 'PEDIDOS',
  OD: 'DIARIA',
};

// ─── Repuestos ────────────────────────────────────────────────────────────────
export const REPUESTOS = {
  compresor: 'compresor-2hp',
  termostato: 'termostato',
  empaque: 'empaque-puerta',
  gas: 'gas-refrigerante',
  motorVentilador: 'motor-ventilador',
} as const;
export type RepuestoId = (typeof REPUESTOS)[keyof typeof REPUESTOS];

export const ETIQUETA_CONCILIACION = 'conciliacion_inventario'; // T15

// ─── Reloj de la demo ─────────────────────────────────────────────────────────
export const RELOJ_INICIAL_ISO = '2026-11-25T07:00:00-06:00'; // mié 25-nov 7:00 en Costa Rica

// ─── IA ───────────────────────────────────────────────────────────────────────
export const MODELO_CAPTURA = 'claude-haiku-5-5';
export const MODELO_PREGUNTAS = 'claude-opus-5-5';
export const TIEMPO_MAXIMO_IA_MS = 15_000;
export const NOMBRE_HERRAMIENTA_INTERPRETACION = 'registrar_interpretacion';
