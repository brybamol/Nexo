// Lectura de los buzones: de mensajes a hechos (docs/08 reglas 10–11). Puro. Esqueleto de R2; lo implementa R5.
import type { Buzon, CopiaLeida, EmpresaCorreo, HechoCorreo } from '@/correo/tipos';
import { noImplementado } from '@/dominio/tipos';

/**
 * Todo lo enviado hasta `ahora` en los buzones dados: los hechos (en orden `enviado`, `id_internet`, orden en el
 * mensaje; un hecho por mensaje único, con los buzones donde está) y una copia por persona × mensaje (con su clase de
 * privacidad). Borradores, spam y papelera no se leen. No sabe qué se leyó antes: eso lo filtra planLectura.
 */
export function hechosDeCorreo(buzones: Buzon[], empresa: EmpresaCorreo, ahora: Date): { hechos: HechoCorreo[]; copias: CopiaLeida[] } {
  return noImplementado('R5 · correo/lectura.ts · hechosDeCorreo', buzones, empresa, ahora);
}

/** Envío del próximo mensaje sin leer posterior a `ahora` (regla 10, irAlSiguienteEvento), o null. */
export function siguienteEnvio(buzones: Buzon[], yaLeidos: Set<string>, ahora: Date): Date | null {
  return noImplementado('R5 · correo/lectura.ts · siguienteEnvio', buzones, yaLeidos, ahora);
}
