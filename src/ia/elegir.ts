// Elige la implementación de la IA: Claude si hay clave (con respaldo Local), si no Local. Tarea 2.2.
import { NoImplementado } from '@/dominio/tipos';
import type { InterpreteIA } from '@/ia/interprete';

export function crearInterprete(claveApi: string | undefined = process.env.ANTHROPIC_API_KEY): InterpreteIA {
  void claveApi;
  throw new NoImplementado('ia/elegir.ts (2.2)');
}
