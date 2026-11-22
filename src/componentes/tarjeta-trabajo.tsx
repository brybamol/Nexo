// Tarjeta de un trabajo: estado, marcas, responsable, plazo. Tarea 1.7.
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import type { EstadoTrabajo } from '@/dominio/tipos';
import type { TrabajoVista } from '@/servicios/vistas';
import { EnlaceTrabajo, EnlacesTrabajos } from './enlaces-trabajos';
import { CodigoTrabajo, InsigniaEstado } from './insignia-estado';
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
      <div className="trabajo__codigo" aria-hidden="true">
        <CodigoTrabajo referencia={trabajo.referencia} estado={trabajo.estado} />
      </div>
      <div>
        <h3 className="trabajo__titulo">
          <Link href={`/trabajos/${trabajo.id}`}>
            {trabajo.titulo}
            {trabajo.referencia && <span className="sr-only"> ({trabajo.referencia})</span>}
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
              <EnlaceTrabajo trabajo={trabajo.bloqueadoPor} />
              {trabajo.fechaSolucion && <> (solución: {formatearFecha(trabajo.fechaSolucion)})</>}
            </dd>
          </div>
        )}
        {trabajo.dependeDeTrabajos.length > 0 && (
          <div>
            <dt>Depende de</dt>
            <dd>
              <EnlacesTrabajos trabajos={trabajo.dependeDeTrabajos} />
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
