// Construye el contexto que recibe la IA para una captura. Puro. Tarea 2.3.
import { NoImplementado } from '@/dominio/tipos';
import type { ContextoCaptura } from '@/ia/interprete';
import type { Instantanea } from '@/motor/instantanea';

export function construirContextoCaptura(inst: Instantanea, autorId: string): ContextoCaptura {
  void inst;
  void autorId;
  throw new NoImplementado('ia/contexto.ts (2.3)');
}
