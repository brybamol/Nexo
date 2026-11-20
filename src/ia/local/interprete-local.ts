// Implementación Local de la IA: respuestas guardadas → heurísticas (§4.3 de docs/05). Tarea 2.1 (preguntas: 4.3).
// Funciona sin red y sin clave. Solo PROPONE: no escribe en la base ni valida ids (lo hace servicios/validacion.ts).
import { esquemaInterpretacion } from '@/ia/esquema-interpretacion';
import type {
  ContextoCaptura,
  HechosPregunta,
  InterpreteIA,
  Interpretacion,
  ResultadoIA,
  TemaPregunta,
} from '@/ia/interprete';
import { interpretarPorHeuristicas } from '@/ia/local/heuristicas';
import { clasificarPregunta as clasificarPorReglas, redactarRespuesta as redactarPorPlantilla } from '@/ia/local/preguntas-local';
import { buscarRespuestaGuardada } from '@/ia/local/respuestas-guardadas';

const envolver = <T>(valor: T): ResultadoIA<T> => ({ valor, implementacion: 'local', modelo: null, respaldo: false });

export class InterpreteLocal implements InterpreteIA {
  readonly nombre = 'local' as const;

  async interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>> {
    const propuesta = buscarRespuestaGuardada(texto, ctx) ?? interpretarPorHeuristicas(texto, ctx);
    const valor: Interpretacion =
      propuesta.tipo === 'pregunta' && texto.trim() !== '' ? { tipo: 'pregunta', pregunta: texto.trim() } : propuesta;
    return envolver(esquemaInterpretacion.parse(valor));
  }

  async clasificarPregunta(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<TemaPregunta>> {
    return envolver(clasificarPorReglas(texto, ctx));
  }

  async redactarRespuesta(pregunta: string, hechos: HechosPregunta): Promise<ResultadoIA<string>> {
    return envolver(redactarPorPlantilla(pregunta, hechos));
  }
}
