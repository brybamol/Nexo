// «Respondió: Local» / «Respondió: Claude · modelo» / «Local (respaldo)». Tarea 2.5.
import type { MetaIA } from '@/servicios/vistas';

/** Texto de la insignia según qué implementación respondió. */
export function etiquetaImplementacion(ia: MetaIA): string {
  if (ia.implementacion === 'claude') {
    return ia.modelo ? `Respondió: Claude · ${ia.modelo}` : 'Respondió: Claude';
  }
  return ia.respaldo ? 'Local (respaldo)' : 'Respondió: Local';
}

export function InsigniaImplementacion(props: { ia: MetaIA }) {
  return (
    <span className="insignia insignia--ia" data-implementacion={props.ia.implementacion}>
      {etiquetaImplementacion(props.ia)}
    </span>
  );
}
