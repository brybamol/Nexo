// Lectura de los buzones: de mensajes a hechos (docs/08 reglas 10–11). Puro: la hora llega como argumento.
// Se conservan la privacidad, la unión y la extracción de docs/06 §4–§7: solo encabezados para clasificar, el
// historial citado fuera, y borradores, spam y papelera no se leen (los quitan los adaptadores de src/correo/fuentes).
import { ExtractorLocal, type ExtractorCorreo } from '@/correo/extractor';
import { clasificarMensaje } from '@/correo/privacidad';
import type { Buzon, CopiaLeida, EmpresaCorreo, HechoCorreo } from '@/correo/tipos';
import { unirBuzones } from '@/correo/union';

const EXTRACTOR: ExtractorCorreo = new ExtractorLocal();

/**
 * Todo lo enviado hasta `ahora` en los buzones dados: los hechos (en orden `enviado`, `id_internet`, orden en el
 * mensaje; un hecho por mensaje único, con los buzones donde está) y una copia por persona × mensaje (con su clase de
 * privacidad). Borradores, spam y papelera no se leen. No sabe qué se leyó antes: eso lo filtra planLectura.
 * Las copias van en orden (`enviado`, `id_internet`, persona en el orden de `buzones`).
 */
export function hechosDeCorreo(buzones: Buzon[], empresa: EmpresaCorreo, ahora: Date): { hechos: HechoCorreo[]; copias: CopiaLeida[] } {
  const copias: { copia: CopiaLeida; orden: number }[] = [];
  const vistas = new Set<string>();
  buzones.forEach((b, orden) => {
    for (const m of b.mensajes) {
      if (m.enviado.getTime() > ahora.getTime()) continue;
      const clave = `${b.personaId}|${m.idInternet}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      // Solo encabezados: el cuerpo de lo personal y de los boletines no se mira.
      copias.push({ copia: { personaId: b.personaId, idInternet: m.idInternet, enviado: m.enviado, clase: clasificarMensaje(m, empresa) }, orden });
    }
  });
  copias.sort(
    (a, b) =>
      a.copia.enviado.getTime() - b.copia.enviado.getTime() || a.copia.idInternet.localeCompare(b.copia.idInternet) || a.orden - b.orden,
  );

  const { hilos } = unirBuzones(buzones, empresa, ahora);
  const hechos = hilos
    .flatMap((h) => EXTRACTOR.extraer(h, empresa))
    .map((hecho, i) => ({ hecho, i }))
    .sort((a, b) => a.hecho.en.getTime() - b.hecho.en.getTime() || a.hecho.mensajeId.localeCompare(b.hecho.mensajeId) || a.i - b.i)
    .map((x) => x.hecho);

  return { hechos, copias: copias.map((c) => c.copia) };
}

/** Envío del próximo mensaje sin leer posterior a `ahora` (regla 10, irAlSiguienteEvento), o null. */
export function siguienteEnvio(buzones: Buzon[], yaLeidos: Set<string>, ahora: Date): Date | null {
  let mejor: Date | null = null;
  for (const b of buzones) {
    for (const m of b.mensajes) {
      if (m.enviado.getTime() <= ahora.getTime()) continue;
      if (yaLeidos.has(`${b.personaId}|${m.idInternet}`)) continue;
      if (!mejor || m.enviado.getTime() < mejor.getTime()) mejor = m.enviado;
    }
  }
  return mejor;
}
