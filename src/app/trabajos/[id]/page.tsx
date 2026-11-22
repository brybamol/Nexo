// Detalle de un trabajo: estado, marcas con causas, bloqueante, notas, dependencias. Lee obtenerTrabajo. Tarea 1.7.
import { ArrowLeft, Ban, Clock, Link2, Package, TriangleAlert, Zap } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotonResponder } from '@/componentes/boton-responder';
import { EnlaceTrabajo, EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import { CodigoTrabajo, InsigniaEstado } from '@/componentes/insignia-estado';
import { InsigniaMarcas } from '@/componentes/insignia-marcas';
import { formatearFecha } from '@/dominio/formato';
import type { CausaRiesgo } from '@/dominio/tipos';
import type { TrabajoVista } from '@/servicios/vistas';
import { obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { obtenerContextoApp } from '@/servidor/contexto-app';

const ICONO_CAUSA = { bloqueado: Ban, atrasado: Clock, repuesto: Package, cadena: Link2 } as const;

function textoCausa(c: CausaRiesgo, t: TrabajoVista) {
  const ref = c.trabajoId ? t.causasTrabajos[c.trabajoId] : undefined;
  const enlace = ref ? <EnlaceTrabajo trabajo={ref} /> : null;
  switch (c.tipo) {
    case 'bloqueado':
      return <>Bloqueado {enlace && <>por {enlace}</>}</>;
    case 'atrasado':
      return <>Atrasado {enlace && <>({enlace})</>}</>;
    case 'repuesto':
      return <>Falta un repuesto{c.repuestoId && t.causasRepuestos[c.repuestoId] && <> ({t.causasRepuestos[c.repuestoId]})</>}</>;
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
      <header className="pagina__cabecera">
        <Link href={`/proyectos/${t.proyecto.id}`} className="volver">
          <ArrowLeft className="icono" aria-hidden="true" />
          {t.proyecto.nombre}
        </Link>
        <div className="detalle__cabecera">
          <span aria-hidden="true">
            <CodigoTrabajo referencia={t.referencia} estado={t.estado} grande />
          </span>
          <h1 className="pagina__titulo">
            {t.titulo}
            {t.referencia && <span className="sr-only"> ({t.referencia})</span>}
          </h1>
        </div>
        <p className="detalle__insignias">
          <InsigniaEstado estado={t.estado} />
          {t.urgente && (
            <span className="insignia insignia--urgente">
              <Zap className="icono" aria-hidden="true" />
              Urgente
            </span>
          )}
          {t.conCostoProbable && <span className="insignia">Costo probable</span>}
          <InsigniaMarcas marcas={t.marcas} />
        </p>
      </header>

      <dl className="detalle__datos">
        <div>
          <dt>Responsable</dt>
          <dd>{t.responsable.nombre}</dd>
        </div>
        {t.solicitadoPor && (
          <div>
            <dt>Lo pidió</dt>
            <dd>{t.solicitadoPor.nombre}</dd>
          </div>
        )}
        <div>
          <dt>Plazo</dt>
          <dd>
            <time dateTime={t.plazo.toISOString()}>{formatearFecha(t.plazo)}</time>
          </dd>
        </div>
        {t.bloqueadoPor && (
          <div>
            <dt>Bloqueado por</dt>
            <dd>
              <EnlaceTrabajo trabajo={t.bloqueadoPor} />
              {t.fechaSolucion ? <> · solución: {formatearFecha(t.fechaSolucion)}</> : <> · sin fecha de solución</>}
            </dd>
          </div>
        )}
        {t.dependeDe.length > 0 && (
          <div>
            <dt>Depende de</dt>
            <dd>
              <EnlacesTrabajos trabajos={t.dependeDeTrabajos} />
            </dd>
          </div>
        )}
        {t.bloquea.length > 0 && (
          <div>
            <dt>Arrastra a</dt>
            <dd>
              <EnlacesTrabajos trabajos={t.bloqueaTrabajos} />
            </dd>
          </div>
        )}
        {t.necesita.length > 0 && (
          <div>
            <dt>Necesita</dt>
            <dd>{t.necesita.map((n) => `${n.cantidad} × ${n.repuesto}`).join(', ')}</dd>
          </div>
        )}
        {t.seguimiento && (
          <div>
            <dt>Seguimiento</dt>
            <dd>
              Nivel {t.seguimiento.nivel} desde {formatearFecha(t.seguimiento.desde)}
            </dd>
          </div>
        )}
      </dl>

      {t.marcas.causas.length > 0 && (
        <section aria-labelledby="causas" className="seccion">
          <h2 id="causas" className="seccion__titulo">
            Causas de las marcas
          </h2>
          <ul className="causas">
            {t.marcas.causas.map((c, i) => {
              const Icono = ICONO_CAUSA[c.tipo] ?? TriangleAlert;
              return (
                <li key={i}>
                  <Icono className="icono" aria-hidden="true" />
                  <span>{textoCausa(c, t)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {t.seguimiento && (
        <section aria-labelledby="responder" className="seccion">
          <h2 id="responder" className="seccion__titulo">
            Seguimiento pendiente
          </h2>
          <BotonResponder trabajoId={t.id} titulo={t.titulo} />
        </section>
      )}

      <section aria-labelledby="notas" className="seccion">
        <h2 id="notas" className="seccion__titulo">
          Notas
        </h2>
        {t.notas.length === 0 ? (
          <p className="vacio">Sin notas.</p>
        ) : (
          <ul className="notas">
            {t.notas.map((n, i) => (
              <li key={i}>
                <p className="notas__cabecera">
                  <strong>{n.autor}</strong> · <time dateTime={n.en.toISOString()}>{formatearFecha(n.en)}</time>
                </p>
                <p>{n.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
