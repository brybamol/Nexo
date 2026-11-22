// Interfaz de la IA y tipos de entrada/salida. ARCHIVO DE CONTRATO (§4.0 de docs/05).
// La IA solo propone: servicios/validacion.ts decide qué se aplica.
import type { EstadoTrabajo, Implementacion, PersonaBreve, PlazoPropuesto } from '@/dominio/tipos';
import type { Interpretacion, TemaPregunta } from '@/ia/esquema-interpretacion';

export type { Interpretacion, InterpretacionDe, TemaPregunta, TipoInterpretacion } from '@/ia/esquema-interpretacion';
export type { PersonaBreve, PlazoPropuesto };

/** Contexto que recibe la IA para interpretar una captura. Fechas como texto ISO con desfase −06:00. */
export interface ContextoCaptura {
  ahora: string;
  autor: PersonaBreve;
  personas: (PersonaBreve & { jefeId: string | null })[];
  /** `clave`: prefijo de las referencias visibles (COLINA). */
  proyectos: { id: string; clave: string; nombre: string; responsableId: string }[];
  trabajosAbiertos: {
    /** Id interno (T04): es lo que la IA devuelve. */
    id: string;
    /** Referencia visible (COLINA-4): la que escriben y leen las personas. */
    referencia: string;
    titulo: string;
    proyectoId: string;
    responsableId: string;
    estado: EstadoTrabajo;
    plazo: string;
    bloqueadoPorId: string | null;
    repuestoId: string | null;
  }[];
  repuestos: { id: string; nombre: string; existencia: number }[];
  /** Ids de trabajos con un seguimiento pendiente dirigido al autor. */
  seguimientosPendientesDelAutor: string[];
}

export type ResultadoIA<T> = {
  valor: T;
  implementacion: Implementacion;
  modelo: string | null;
  respaldo: boolean; // true si Claude falló y respondió Local
};

export type HechosPregunta = {
  tema: TemaPregunta;
  datos: Record<string, unknown>;
  fuentes: { trabajoId: string; etiqueta: string }[];
};

export interface InterpreteIA {
  readonly nombre: Implementacion;
  interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>>;
  clasificarPregunta(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<TemaPregunta>>;
  redactarRespuesta(pregunta: string, hechos: HechosPregunta): Promise<ResultadoIA<string>>;
}
