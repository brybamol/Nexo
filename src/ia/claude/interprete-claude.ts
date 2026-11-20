// Implementación Claude con respaldo Local (§4.3 de docs/05). Tarea 2.2.
// El SDK (@anthropic-ai/sdk) se importa solo dentro de ia/claude/ y se instancia solo si hay clave.
// Claude solo PROPONE: aquí no se escribe nada en la base. Cualquier fallo (red, tiempo, salida inválida,
// respuesta sin herramienta) → respaldo Local con `respaldo: true`; nunca se inventa una interpretación.
import Anthropic from '@anthropic-ai/sdk';
import { esquemaEntradaClasificacion, esquemaEntradaHerramienta } from '@/ia/esquema-interpretacion';
import type {
  ContextoCaptura,
  HechosPregunta,
  InterpreteIA,
  Interpretacion,
  ResultadoIA,
  TemaPregunta,
} from '@/ia/interprete';
import {
  NOMBRE_HERRAMIENTA_CLASIFICACION,
  NOMBRE_HERRAMIENTA_INTERPRETACION,
  PROMPT_SISTEMA_CAPTURA,
  PROMPT_SISTEMA_PREGUNTAS,
  herramientaClasificacion,
  herramientaInterpretacion,
  mensajeCaptura,
  mensajeClasificacion,
  mensajeRedaccion,
} from '@/ia/claude/prompts';

export const MODELO_CAPTURA = 'claude-haiku-5-5';
export const MODELO_PREGUNTAS = 'claude-opus-5-5';
export const TIEMPO_MAXIMO_MS = 15_000;

/** Parte mínima del cliente del SDK que usamos; permite inyectar uno falso en las pruebas (sin red). */
export interface ClienteMensajes {
  messages: {
    create(
      params: Record<string, unknown>,
      opciones?: { timeout?: number; maxRetries?: number },
    ): Promise<{ content: ReadonlyArray<{ type: string; [clave: string]: unknown }> }>;
  };
}

type Bloque = { type: string; [clave: string]: unknown };

export class InterpreteClaude implements InterpreteIA {
  readonly nombre = 'claude' as const;
  private cliente: ClienteMensajes | null;

  /**
   * @param cliente solo para pruebas: cliente falso. Si falta, se crea el del SDK con la clave (sin red hasta usarlo).
   */
  constructor(
    private readonly claveApi: string,
    private readonly respaldo: InterpreteIA,
    cliente?: ClienteMensajes,
  ) {
    this.cliente = cliente ?? null;
  }

  private obtenerCliente(): ClienteMensajes {
    this.cliente ??= new Anthropic({ apiKey: this.claveApi, maxRetries: 0 }) as unknown as ClienteMensajes;
    return this.cliente;
  }

  private async llamar(params: Record<string, unknown>): Promise<ReadonlyArray<Bloque>> {
    const respuesta = await this.obtenerCliente().messages.create(params, {
      timeout: TIEMPO_MAXIMO_MS,
      maxRetries: 0,
    });
    return respuesta.content;
  }

  /** Entrada de la herramienta indicada, o lanza si el modelo no la llamó. */
  private entradaDeHerramienta(contenido: ReadonlyArray<Bloque>, nombre: string): unknown {
    const bloque = contenido.find((b) => b.type === 'tool_use' && b.name === nombre);
    if (!bloque) throw new Error(`Claude no llamó a la herramienta ${nombre}`);
    return bloque.input;
  }

  async interpretar(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<Interpretacion>> {
    try {
      // tool_choice «auto»: los modelos recientes rechazan o limitan la herramienta forzada junto con el
      // razonamiento; la instrucción del prompt exige la llamada y su ausencia se trata como fallo.
      const contenido = await this.llamar({
        model: MODELO_CAPTURA,
        max_tokens: 4096,
        system: PROMPT_SISTEMA_CAPTURA,
        tools: [herramientaInterpretacion()],
        tool_choice: { type: 'auto' },
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: mensajeCaptura(texto, ctx) }],
      });
      const entrada = this.entradaDeHerramienta(contenido, NOMBRE_HERRAMIENTA_INTERPRETACION);
      const valor = esquemaEntradaHerramienta.parse(entrada).interpretacion;
      return { valor, implementacion: 'claude', modelo: MODELO_CAPTURA, respaldo: false };
    } catch {
      const r = await this.respaldo.interpretar(texto, ctx);
      return { ...r, respaldo: true };
    }
  }

  async clasificarPregunta(texto: string, ctx: ContextoCaptura): Promise<ResultadoIA<TemaPregunta>> {
    try {
      const contenido = await this.llamar({
        model: MODELO_PREGUNTAS,
        max_tokens: 2048,
        system: PROMPT_SISTEMA_PREGUNTAS,
        tools: [herramientaClasificacion()],
        tool_choice: { type: 'auto' },
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: mensajeClasificacion(texto, ctx) }],
      });
      const entrada = this.entradaDeHerramienta(contenido, NOMBRE_HERRAMIENTA_CLASIFICACION);
      const valor = esquemaEntradaClasificacion.parse(entrada).tema;
      return { valor, implementacion: 'claude', modelo: MODELO_PREGUNTAS, respaldo: false };
    } catch {
      const r = await this.respaldo.clasificarPregunta(texto, ctx);
      return { ...r, respaldo: true };
    }
  }

  async redactarRespuesta(pregunta: string, hechos: HechosPregunta): Promise<ResultadoIA<string>> {
    try {
      const contenido = await this.llamar({
        model: MODELO_PREGUNTAS,
        max_tokens: 2048,
        system: PROMPT_SISTEMA_PREGUNTAS,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: mensajeRedaccion(pregunta, JSON.stringify(hechos)) }],
      });
      const texto = contenido
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('\n')
        .trim();
      if (texto === '') throw new Error('Claude devolvió una respuesta vacía');
      return { valor: texto, implementacion: 'claude', modelo: MODELO_PREGUNTAS, respaldo: false };
    } catch {
      const r = await this.respaldo.redactarRespuesta(pregunta, hechos);
      return { ...r, respaldo: true };
    }
  }
}
