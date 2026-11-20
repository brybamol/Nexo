// Tarjeta de un trabajo: estado, marcas, responsable, plazo. Tarea 1.7.
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import type { EstadoTrabajo } from '@/dominio/tipos';
import type { TrabajoVista } from '@/servicios/vistas';
import { InsigniaEstado, Rotulo } from './insignia-estado';
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
    <article className="tarjeta trabajo" data-estado={trabajo.estado}>
      <div className="trabajo__rotulo" aria-hidden="true">
        <Rotulo id={trabajo.id} estado={trabajo.estado} />
      </div>
      <div>
        <h3 className="trabajo__titulo">
          <Link href={`/trabajos/${trabajo.id}`}>
            <span className="sr-only">{trabajo.id} · </span>
            {trabajo.titulo}
          </Link>
        </h3>
        <p className="trabajo__insignias">
          <InsigniaEstado estado={trabajo.estado} />
          {trabajo.urgente && (
            <span className="insignia insignia--urgente">
              <Zap className="icono" aria-hidden="true" />
              Urgente
            </span>
          )}
          <InsigniaMarcas marcas={trabajo.marcas} />
        </p>
      </div>
      <dl className="trabajo__datos">
        {mostrarProyecto && (
          <div>
            <dt>Proyecto</dt>
            <dd>
              <Link href={`/proyectos/${trabajo.proyecto.id}`}>{trabajo.proyecto.nombre}</Link>
            </dd>
          </div>
        )}
        <div>
          <dt>Responsable</dt>
          <dd>{trabajo.responsable.nombre}</dd>
        </div>
        <div>
          <dt>Plazo</dt>
          <dd>
            <time dateTime={trabajo.plazo.toISOString()}>{formatearFecha(trabajo.plazo)}</time>
          </dd>
        </div>
        {trabajo.bloqueadoPor && (
          <div className="trabajo__dato--ancho">
            <dt>Bloqueado por</dt>
            <dd>
              <Link href={`/trabajos/${trabajo.bloqueadoPor.id}`}>
                {trabajo.bloqueadoPor.id} · {trabajo.bloqueadoPor.titulo}
              </Link>
              {trabajo.fechaSolucion && <> (solución: {formatearFecha(trabajo.fechaSolucion)})</>}
            </dd>
          </div>
        )}
        {trabajo.dependeDe.length > 0 && (
          <div>
            <dt>Depende de</dt>
            <dd>
              {trabajo.dependeDe.map((d, i) => (
                <span key={d}>
                  {i > 0 && ', '}
                  <Link href={`/trabajos/${d}`}>{d}</Link>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
