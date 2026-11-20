// Esquemas zod de lo que propone la IA. ARCHIVO DE CONTRATO (§4.0 de docs/05): fuente de verdad de la forma.
// El tipo Interpretacion se infiere de aquí; z.toJSONSchema(esquemaEntradaHerramienta) da el input_schema de Claude.
import { z } from 'zod';
import type { PlazoPropuesto } from '@/dominio/tipos';

export const esquemaEstadoTrabajo = z.enum(['abierto', 'en_curso', 'bloqueado', 'resuelto']);

export const esquemaPlazoPropuesto = z.object({
  dia: z.string().describe("'hoy', 'manana' o una fecha 'AAAA-MM-DD'"),
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .describe("'HH:mm' (24 h) solo si la frase da una hora"),
});

export const esquemaTrabajoNuevo = z.object({
  tipo: z.literal('trabajo_nuevo'),
  titulo: z.string().min(1),
  proyectoId: z.string(),
  responsableId: z.string(),
  responsableSeguro: z.boolean().describe('false si el responsable es una suposición: Nexo pide confirmación (R9)'),
  plazo: esquemaPlazoPropuesto,
  urgente: z.boolean(),
  conCostoProbable: z.boolean(),
  relacionados: z.array(z.string()),
  bloquea: z.array(z.string()),
  repuestoFaltante: z.object({ repuestoId: z.string() }).nullable(),
});

export const esquemaActualizacion = z.object({
  tipo: z.literal('actualizacion'),
  trabajoId: z.string(),
  nuevoEstado: esquemaEstadoTrabajo.nullable(),
  nota: z.string().nullable(),
  hayProblema: z.boolean(),
  reprogramar: z.array(z.object({ trabajoId: z.string(), plazo: esquemaPlazoPropuesto })),
  notasRelacionadas: z.array(z.object({ trabajoId: z.string(), nota: z.string() })),
});

export const esquemaDuplicado = z.object({
  tipo: z.literal('duplicado'),
  trabajoId: z.string(),
});

export const esquemaDecision = z.object({
  tipo: z.literal('decision'),
  proyectoId: z.string(),
  resumen: z.string(),
  compra: z.object({
    repuestoId: z.string(),
    cantidad: z.number().int().positive().nullable(),
    proveedor: z.enum(['local', 'habitual']).nullable(),
    ajustePrecioPct: z.number().nullable(),
  }),
  existenciaReal: z.number().int().min(0).nullable(),
  trabajoRelacionadoId: z.string().nullable(),
});

export const esquemaNoEsTrabajo = z.object({
  tipo: z.literal('no_es_trabajo'),
  motivo: z.string(),
});

export const esquemaPregunta = z.object({
  tipo: z.literal('pregunta'),
  pregunta: z.string(),
});

export const esquemaInterpretacion = z.discriminatedUnion('tipo', [
  esquemaTrabajoNuevo,
  esquemaActualizacion,
  esquemaDuplicado,
  esquemaDecision,
  esquemaNoEsTrabajo,
  esquemaPregunta,
]);

/** Entrada de la herramienta `registrar_interpretacion`: la raíz de input_schema debe ser un objeto. */
export const esquemaEntradaHerramienta = z.object({ interpretacion: esquemaInterpretacion });

export const esquemaTemaPregunta = z.enum(['pedidos_semana', 'estado_proyectos', 'atrasados', 'mis_pendientes', 'desconocido']);

/** Entrada de la herramienta de clasificación de preguntas. */
export const esquemaEntradaClasificacion = z.object({ tema: esquemaTemaPregunta });

export type Interpretacion = z.infer<typeof esquemaInterpretacion>;
export type TipoInterpretacion = Interpretacion['tipo'];
export type InterpretacionDe<T extends TipoInterpretacion> = Extract<Interpretacion, { tipo: T }>;
export type TemaPregunta = z.infer<typeof esquemaTemaPregunta>;

// El plazo del esquema y el de dominio/tipos.ts deben ser intercambiables.
type _PlazoZod = z.infer<typeof esquemaPlazoPropuesto>;
const _plazoA: PlazoPropuesto = {} as _PlazoZod;
const _plazoB: _PlazoZod = {} as PlazoPropuesto;
void _plazoA;
void _plazoB;
