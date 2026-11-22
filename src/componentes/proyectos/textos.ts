// Frases cortas de las pantallas de proyectos. Puras: reciben el recorrido ya calculado por el servicio.
import type { EtapaRecorrido, PasoRecorrido, ProyectoRecorrido } from '@/servicios/proyectos';

/** Quita el punto final de una frase escrita por una persona, para poder cerrarla sin duplicarlo. */
export function sinPunto(s: string): string {
  return s.replace(/[.\s]+$/u, '');
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** «3 de 7 hechos», «Sin trabajos todavía». */
export function textoAvance(r: Pick<ProyectoRecorrido, 'total' | 'resueltos'>): string {
  if (r.total === 0) return 'Sin trabajos todavía';
  return `${r.resueltos} de ${r.total} ${r.resueltos === 1 ? 'hecho' : 'hechos'}`;
}

/** «Etapa 4 de 7», «Hoy, mié 25 nov», «Todo resuelto». */
export function textoEtapaActual(r: Pick<ProyectoRecorrido, 'etapas' | 'etapaActual' | 'modo' | 'terminado' | 'total'>): string {
  if (r.total === 0) return 'Nada en marcha';
  if (r.terminado || r.etapaActual === null) return 'Todo resuelto';
  const e = r.etapas[r.etapaActual];
  if (!e) return 'Nada en marcha';
  return r.modo === 'dias' || e.ciclo ? e.etiqueta : `${e.etiqueta} de ${r.etapas.length}`;
}

/** Trabajos que faltan después de la etapa actual (sin contar los de la actual). */
export function faltanDespues(r: Pick<ProyectoRecorrido, 'etapas' | 'etapaActual'>): number {
  if (r.etapaActual === null) return 0;
  return r.etapas
    .slice(r.etapaActual + 1)
    .flatMap((e) => e.pasos)
    .filter((p) => p.trabajo.estado !== 'resuelto').length;
}

/** Nombre del estado de una etapa en la línea de tiempo. */
export const ETIQUETA_ETAPA: Record<EtapaRecorrido['estado'], string> = {
  hecha: 'Hecho',
  actual: 'Ahora',
  rezagada: 'Quedó pendiente',
  pendiente: 'Después',
};

/** Lo que frena un paso, en una frase corta sin enlaces (para la lista de proyectos). */
export function textoFreno(p: PasoRecorrido): string {
  const t = p.trabajo;
  const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  if (t.estado === 'bloqueado') {
    const motivo = p.motivoBloqueo ? `: ${minuscula(sinPunto(p.motivoBloqueo))}` : '';
    return `«${t.titulo}» está bloqueado${motivo}`;
  }
  if (t.marcas.atrasado) return `«${t.titulo}» está atrasado`;
  const repuesto = Object.values(t.causasRepuestos)[0];
  if (repuesto) return `«${t.titulo}» en riesgo: falta ${minuscula(repuesto)}`;
  const cadena = t.marcas.causas.find((c) => c.tipo === 'cadena' || c.tipo === 'bloqueado');
  const ref = cadena?.trabajoId ? t.causasTrabajos[cadena.trabajoId] : undefined;
  return ref ? `«${t.titulo}» en riesgo: espera a «${ref.titulo}»` : `«${t.titulo}» en riesgo`;
}
