// Implementación Claude con respaldo Local (§4.3 de docs/05). Tarea 2.2.
// El SDK (@anthropic-ai/sdk) se importa solo dentro de ia/claude/ y se instancia solo si hay clave.
import { NoImplementado } from '@/dominio/tipos';
import type {
  ContextoCaptura,
  HechosPregunta,
  InterpreteIA,
  Interpretacion,
  ResultadoIA,
  TemaPregunta,
} from '@/ia/interprete';

const N = 'ia/claude/interprete-claude.ts (2.2)';

export class InterpreteClaude implements InterpreteIA {
  readonly nombre = 'claude' as const;

  constructor(
    private readonly claveApi: string,
    private readonly respaldo: InterpreteIA,
  ) {}

  async interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>> {
    void texto;
    void ctx;
    void this.claveApi;
    void this.respaldo;
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
