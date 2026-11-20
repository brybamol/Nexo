// Contexto que recibe todo servicio como primer argumento. ARCHIVO DE CONTRATO (§4.0 de docs/05).
import type { Db } from '@/db/esquema';
import type { InterpreteIA } from '@/ia/interprete';

export type { Db };

export interface ContextoServicio {
  db: Db;
  ia: InterpreteIA;
}
