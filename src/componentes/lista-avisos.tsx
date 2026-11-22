// Qué cambió: avisos de la persona, del más reciente al más antiguo, con su motivo y enlaces a los trabajos. Tarea 4.1.
// Cada aviso se muestra tal como lo emitió Nexo (uno por persona y hecho; puede citar trabajos de varios proyectos).
// Props: `avisos` (AvisoVista[]); `extra` opcional: lo que va debajo de un aviso (p. ej. las acciones del dueño del
// resultado bajo un escalamiento). Componente de servidor.
import { CheckCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { accionMarcarLeidos } from '@/app/acciones/trabajos';
import { EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import { formatearFecha } from '@/dominio/formato';
import type { AvisoVista } from '@/servicios/vistas';

export function ListaAvisos({ avisos, extra }: { avisos: AvisoVista[]; extra?: (a: AvisoVista) => ReactNode }) {
  if (avisos.length === 0) return <p className="vacio">Sin avisos por ahora.</p>;
  const sinLeer = avisos.filter((a) => !a.leido).length;
  return (
    <>
      {sinLeer > 0 && (
        <form action={accionMarcarLeidos}>
          <button type="submit" className="boton boton--quieto">
            <CheckCheck className="icono" aria-hidden="true" />
            Marcar {sinLeer === 1 ? 'el aviso' : `los ${sinLeer} avisos`} como leído{sinLeer === 1 ? '' : 's'}
          </button>
        </form>
      )}
      <ul className="avisos">
        {avisos.map((a) => (
          <li key={a.id} className="aviso" data-leido={a.leido}>
            <article>
              <h3>
                {!a.leido && <span className="insignia insignia--nuevo">Nuevo</span>} {a.titulo}
              </h3>
              <p className="aviso__hora">
                <time dateTime={a.en.toISOString()}>{formatearFecha(a.en)}</time>
              </p>
              <p className="aviso__cuerpo">{a.cuerpo}</p>
              {a.trabajos.length > 0 && (
                <p className="aviso__trabajos">
                  Trabajos: <EnlacesTrabajos trabajos={a.trabajos} />
                </p>
              )}
              {extra?.(a)}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
