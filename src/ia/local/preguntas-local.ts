// Preguntas en modo Local: clasificar el tema y redactar la respuesta por plantilla. Tarea 4.3.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoCaptura, HechosPregunta, TemaPregunta } from '@/ia/interprete';

const N = 'ia/local/preguntas-local.ts (4.3)';

export function clasificarPregunta(texto: string, ctx: ContextoCaptura): TemaPregunta {
  void texto;
  void ctx;
  throw new NoImplementado(N);
}

export function redactarRespuesta(pregunta: string, hechos: HechosPregunta): string {
  void pregunta;
  void hechos;
  throw new NoImplementado(N);
}
