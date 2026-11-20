// Constantes de dominio de Nexo. ARCHIVO DE CONTRATO (§4.0 de docs/05): congelado tras la tarea 1.1.

// ─── Zona y horario (Costa Rica no tiene horario de verano: desfase fijo −06:00) ──
export const ZONA = 'America/Costa_Rica';
export const DESFASE_CR = '-06:00';
export const HORA_INICIO = 7; // jornada laboral 7:00–17:00, lunes a viernes
export const HORA_FIN = 17;
export const HORA_PLAZO_SIN_HORA = '17:00'; // plazo sin hora = 17:00 de ese día
export const HORA_PLAZO_URGENTE_HOY = '12:00'; // «hoy» urgente antes de las 12:00

// ─── Reglas ───────────────────────────────────────────────────────────────────
export const UMBRAL_GERENTE = 100_000; // ₡: por encima decide la gerente general
export const MIN_URGENTE = 30; // intervalo de seguimiento de un trabajo urgente
export const HORAS_LABORALES_NORMAL = 4; // intervalo de seguimiento de un trabajo normal
export const HORA_ENTREGA_LOCAL = '15:00'; // el proveedor local entrega el mismo día hábil
export const HORA_LLEGADA_HABITUAL = '07:00'; // el proveedor habitual llega a esta hora
export const MIN_SIGUIENTE_EVENTO_POR_DEFECTO = 30; // irAlSiguienteEvento sin evento pendiente
export const UMBRAL_SIMILITUD = 0.8; // intérprete Local: coincidencia mínima con una frase guardada
export const LIMITE_AVISOS_MI_DIA = 20;

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
