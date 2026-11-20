// Detalle de un trabajo: estado, marcas con causas, bloqueante, notas, dependencias. Lee obtenerTrabajo. Tarea 1.7.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotonResponder } from '@/componentes/boton-responder';
import { InsigniaMarcas } from '@/componentes/insignia-marcas';
import { ETIQUETA_ESTADO } from '@/componentes/tarjeta-trabajo';
import { formatearFecha } from '@/dominio/formato';
import type { CausaRiesgo } from '@/dominio/tipos';
import { obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { obtenerContextoApp } from '@/servidor/contexto-app';

function EnlacesTrabajos({ ids }: { ids: string[] }) {
  return ids.map((d, i) => (
    <span key={d}>
      {i > 0 && ', '}
      <Link href={`/trabajos/${d}`}>{d}</Link>
    </span>
  ));
}

function textoCausa(c: CausaRiesgo) {
  const enlace = c.trabajoId ? <Link href={`/trabajos/${c.trabajoId}`}>{c.trabajoId}</Link> : null;
  switch (c.tipo) {
    case 'bloqueado':
      return <>Bloqueado {enlace && <>por {enlace}</>}</>;
    case 'atrasado':
      return <>Atrasado {enlace && <>({enlace})</>}</>;
    case 'repuesto':
      return <>Falta un repuesto{c.repuestoId && <> ({c.repuestoId})</>}</>;
    case 'cadena':
      return <>Depende de {enlace ?? 'un trabajo'} en riesgo</>;
  }
}

export default async function PaginaTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContextoApp();
  const t = await obtenerTrabajo(ctx, id);
  if (!t) notFound();
  return (
    <>
      <p>
        <Link href={`/proyectos/${t.proyecto.id}`}>← {t.proyecto.nombre}</Link>
      </p>
      <h1>
        {t.id} · {t.titulo}
      </h1>
      <p>
        <span className="insignia">{ETIQUETA_ESTADO[t.estado]}</span>{' '}
        {t.urgente && <span className="insignia">Urgente</span>}{' '}
        {t.conCostoProbable && <span className="insignia">Costo probable</span>}{' '}
        <InsigniaMarcas marcas={t.marcas} />
      </p>
      <dl>
        <dt>Responsable</dt>
        <dd>{t.responsable.nombre}</dd>
        {t.solicitadoPor && (
          <>
            <dt>Lo pidió</dt>
            <dd>{t.solicitadoPor.nombre}</dd>
          </>
        )}
        <dt>Plazo</dt>
        <dd>
          <time dateTime={t.plazo.toISOString()}>{formatearFecha(t.plazo)}</time>
        </dd>
        {t.bloqueadoPor && (
          <>
            <dt>Bloqueado por</dt>
            <dd>
              <Link href={`/trabajos/${t.bloqueadoPor.id}`}>
                {t.bloqueadoPor.id} · {t.bloqueadoPor.titulo}
              </Link>
              {t.fechaSolucion ? <> · solución: {formatearFecha(t.fechaSolucion)}</> : <> · sin fecha de solución</>}
            </dd>
          </>
        )}
        {t.dependeDe.length > 0 && (
          <>
            <dt>Depende de</dt>
            <dd>
              <EnlacesTrabajos ids={t.dependeDe} />
            </dd>
          </>
        )}
        {t.bloquea.length > 0 && (
          <>
            <dt>Arrastra a</dt>
            <dd>
              <EnlacesTrabajos ids={t.bloquea} />
            </dd>
          </>
        )}
        {t.necesita.length > 0 && (
          <>
            <dt>Necesita</dt>
            <dd>{t.necesita.map((n) => `${n.cantidad} × ${n.repuesto}`).join(', ')}</dd>
          </>
        )}
        {t.seguimiento && (
          <>
            <dt>Seguimiento</dt>
            <dd>
              Nivel {t.seguimiento.nivel} desde {formatearFecha(t.seguimiento.desde)}
            </dd>
          </>
        )}
      </dl>

      {t.marcas.causas.length > 0 && (
        <section aria-labelledby="causas">
          <h2 id="causas">Causas de las marcas</h2>
          <ul>
            {t.marcas.causas.map((c, i) => (
              <li key={i}>{textoCausa(c)}</li>
            ))}
          </ul>
        </section>
      )}

      {t.seguimiento && (
        <section aria-labelledby="responder">
          <h2 id="responder">Seguimiento pendiente</h2>
          <BotonResponder trabajoId={t.id} />
        </section>
      )}

      <section aria-labelledby="notas">
        <h2 id="notas">Notas</h2>
        {t.notas.length === 0 ? (
          <p>Sin notas.</p>
        ) : (
          <ul>
            {t.notas.map((n, i) => (
              <li key={i}>
                <strong>{n.autor}</strong> · <time dateTime={n.en.toISOString()}>{formatearFecha(n.en)}</time>
                <p>{n.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
