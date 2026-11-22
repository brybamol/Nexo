// Extractor de hechos de un hilo (docs/08 §4). La lectura (correo/lectura.ts) solo ve esta interfaz.
// Solo la implementación local; la de Claude queda para después (fuera de la transacción y validada como la captura).
import { extraerHechos } from '@/correo/extraccion';
import type { EmpresaCorreo, HechoCorreo, Hilo } from '@/correo/tipos';

export interface ExtractorCorreo {
  readonly nombre: 'local' | 'claude';
  extraer(hilo: Hilo, empresa: EmpresaCorreo): HechoCorreo[];
}

/** Reglas fijas sobre el texto (correo/extraccion.ts). */
export class ExtractorLocal implements ExtractorCorreo {
  readonly nombre = 'local' as const;
  extraer(hilo: Hilo, empresa: EmpresaCorreo): HechoCorreo[] {
    return extraerHechos(hilo, empresa);
  }
}
