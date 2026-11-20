// Respuestas guardadas del intérprete Local: C01–C15, E1 y E5 como funciones del contexto. Tarea 2.1.
import type { ContextoCaptura, Interpretacion } from '@/ia/interprete';

export interface RespuestaGuardada {
  id: string; // 'C01'…'C15', 'E1', 'E5'
  frase: string;
  /** Resuelve ids dinámicos desde el contexto; null si no aplica en este estado. */
  construir(ctx: ContextoCaptura): Interpretacion | null;
}

export const RESPUESTAS_GUARDADAS: RespuestaGuardada[] = [];

/** Coincidencia exacta tras normalizar; si no, la de mayor similitud ≥ UMBRAL_SIMILITUD. */
export function buscarRespuestaGuardada(texto: string, ctx: ContextoCaptura): Interpretacion | null {
  void texto;
  void ctx;
  return null;
}
