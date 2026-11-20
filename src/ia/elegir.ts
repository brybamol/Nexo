// Elige la implementación de la IA: Claude si hay clave (con respaldo Local), si no Local. Tarea 2.2.
import { InterpreteClaude } from '@/ia/claude/interprete-claude';
import type { InterpreteIA } from '@/ia/interprete';
import { InterpreteLocal } from '@/ia/local/interprete-local';

export function crearInterprete(claveApi: string | undefined = process.env.ANTHROPIC_API_KEY): InterpreteIA {
  const local = new InterpreteLocal();
  const clave = claveApi?.trim();
  return clave ? new InterpreteClaude(clave, local) : local;
}
