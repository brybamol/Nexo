// Quién espera a quién (docs/08 regla 23). Puro. Esqueleto de R2; lo implementa R5.
// Sustituye a las cadenas y cuellos de correo/modelo.ts (que retira R9).
import { noImplementado, type Esperas } from '@/dominio/tipos';
import type { Instantanea } from '@/motor/instantanea';

/** Cadenas de espera y cuellos de botella sobre `inst` (ya la visible para quien mira). */
export function calcularEsperas(inst: Instantanea): Esperas {
  return noImplementado('R5 · motor/esperas.ts · calcularEsperas', inst);
}
