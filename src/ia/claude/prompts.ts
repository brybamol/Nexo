// Prompts de sistema y definición de la herramienta de Claude. Tarea 2.2.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoCaptura } from '@/ia/interprete';

export const PROMPT_SISTEMA_CAPTURA = '';
export const PROMPT_SISTEMA_PREGUNTAS = '';

/** Herramienta `registrar_interpretacion` (input_schema = z.toJSONSchema(esquemaEntradaHerramienta)). */
export function herramientaInterpretacion(): { name: string; description: string; input_schema: Record<string, unknown> } {
  throw new NoImplementado('ia/claude/prompts.ts (2.2)');
}

/** Mensaje de usuario con la frase y el contexto. */
export function mensajeCaptura(texto: string, ctx: ContextoCaptura): string {
  void texto;
  void ctx;
  throw new NoImplementado('ia/claude/prompts.ts (2.2)');
}
