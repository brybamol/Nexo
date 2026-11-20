// Qué cambió: avisos de la persona, del más reciente al más antiguo, con su motivo y enlaces a los trabajos. Tarea 4.1.
// Cada aviso se muestra tal como lo emitió Nexo (uno por persona y hecho; puede citar trabajos de varios proyectos).
// Props: `avisos` (AvisoVista[]). Componente de servidor.
import Link from 'next/link';
import { accionMarcarLeidos } from '@/app/acciones/trabajos';
import { formatearFecha } from '@/dominio/formato';
import type { AvisoVista } from '@/servicios/vistas';

export function ListaAvisos({ avisos }: { avisos: AvisoVista[] }) {
  if (avisos.length === 0) return <p>Sin avisos por ahora.</p>;
  const sinLeer = avisos.filter((a) => !a.leido).length;
  return (
    <>
      {sinLeer > 0 && (
        <form action={accionMarcarLeidos}>
          <button type="submit">Marcar {sinLeer === 1 ? 'el aviso' : `los ${sinLeer} avisos`} como leído{sinLeer === 1 ? '' : 's'}</button>
        </form>
      )}
      <ul className="avisos">
        {avisos.map((a) => (
          <li key={a.id} className="aviso" data-leido={a.leido}>
            <article>
              <h3>
                {!a.leido && <span className="insignia">Nuevo</span>} {a.titulo}
              </h3>
              <p>
                <time dateTime={a.en.toISOString()}>{formatearFecha(a.en)}</time>
              </p>
              <p>{a.cuerpo}</p>
              {a.trabajoIds.length > 0 && (
                <p>
                  Trabajos:{' '}
                  {a.trabajoIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <Link href={`/trabajos/${id}`}>{id}</Link>
                    </span>
                  ))}
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
