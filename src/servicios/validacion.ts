// Validación pura de la interpretación de la IA (§4.3 de docs/05). Tarea 2.3.
import { NoImplementado, type Plan } from '@/dominio/tipos';
import type { Interpretacion } from '@/ia/interprete';
import type { Instantanea } from '@/motor/instantanea';
import type { OpcionRespuesta } from '@/servicios/vistas';

export type ResultadoValidacion =
  | { tipo: 'plan'; plan: Plan }
  | { tipo: 'pregunta'; texto: string; opciones: OpcionRespuesta[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Comprueba que existan persona, proyecto, trabajos y repuesto; que el trabajo a actualizar no esté resuelto;
 * resuelve los plazos con inst.ahora y decide la ÚNICA pregunta (responsable no seguro → cantidad nula → nada).
 */
export function validarInterpretacion(inst: Instantanea, interp: Interpretacion, autorId: string): ResultadoValidacion {
  void inst;
  void interp;
  void autorId;
  throw new NoImplementado('servicios/validacion.ts (2.3)');
}
