// Tarjeta de un trabajo: estado, marcas, responsable, plazo. Tarea 1.7.
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import type { EstadoTrabajo } from '@/dominio/tipos';
import type { TrabajoVista } from '@/servicios/vistas';
import { InsigniaMarcas } from './insignia-marcas';

export const ETIQUETA_ESTADO: Record<EstadoTrabajo, string> = {
  abierto: 'Abierto',
  en_curso: 'En curso',
  bloqueado: 'Bloqueado',
  resuelto: 'Resuelto',
};

/**
 * Props: `trabajo` (TrabajoVista); `mostrarProyecto` (por defecto true) muestra el nombre del proyecto.
 * Componente de servidor: recibe fechas como Date y las formatea aquí.
 */
export function TarjetaTrabajo({
  trabajo,
  mostrarProyecto = true,
}: {
  trabajo: TrabajoVista;
  mostrarProyecto?: boolean;
}) {
  return (
    <article className="tarjeta">
      <h3>
        <Link href={`/trabajos/${trabajo.id}`}>
          {trabajo.id} · {trabajo.titulo}
        </Link>
      </h3>
      <p>
        <span className="insignia">{ETIQUETA_ESTADO[trabajo.estado]}</span>{' '}
        {trabajo.urgente && <span className="insignia">Urgente</span>}{' '}
        <InsigniaMarcas marcas={trabajo.marcas} />
      </p>
      <dl>
        {mostrarProyecto && (
          <>
            <dt>Proyecto</dt>
            <dd>
              <Link href={`/proyectos/${trabajo.proyecto.id}`}>{trabajo.proyecto.nombre}</Link>
            </dd>
          </>
        )}
        <dt>Responsable</dt>
        <dd>{trabajo.responsable.nombre}</dd>
        <dt>Plazo</dt>
        <dd>
          <time dateTime={trabajo.plazo.toISOString()}>{formatearFecha(trabajo.plazo)}</time>
        </dd>
        {trabajo.bloqueadoPor && (
          <>
            <dt>Bloqueado por</dt>
            <dd>
              <Link href={`/trabajos/${trabajo.bloqueadoPor.id}`}>
                {trabajo.bloqueadoPor.id} · {trabajo.bloqueadoPor.titulo}
              </Link>
              {trabajo.fechaSolucion && <> (solución: {formatearFecha(trabajo.fechaSolucion)})</>}
            </dd>
          </>
        )}
        {trabajo.dependeDe.length > 0 && (
          <>
            <dt>Depende de</dt>
            <dd>
              {trabajo.dependeDe.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <Link href={`/trabajos/${d}`}>{d}</Link>
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}
