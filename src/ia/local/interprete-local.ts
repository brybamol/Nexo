// Implementación Local de la IA: respuestas guardadas → heurísticas (§4.3 de docs/05). Tarea 2.1 (preguntas: 4.3).
import { NoImplementado } from '@/dominio/tipos';
import type {
  ContextoCaptura,
  HechosPregunta,
  InterpreteIA,
  Interpretacion,
  ResultadoIA,
  TemaPregunta,
} from '@/ia/interprete';

const N = 'ia/local/interprete-local.ts (2.1)';

export class InterpreteLocal implements InterpreteIA {
  readonly nombre = 'local' as const;

  async interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>> {
    void texto;
    void ctx;
    throw new NoImplementado(N);
  }

  async clasificarPregunta(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<TemaPregunta>> {
    void texto;
    void ctx;
    throw new NoImplementado(N);
  }

  async redactarRespuesta(pregunta: string, hechos: HechosPregunta): Promise<ResultadoIA<string>> {
    void pregunta;
    void hechos;
    throw new NoImplementado(N);
  }
}
