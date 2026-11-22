// Recorrido de un proyecto: la secuencia de sus trabajos por dependencias (o por día), con lo hecho, lo de ahora, lo que
// frena y lo que viene. Lee obtenerRecorrido.
import { ArrowLeft, CalendarClock, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Referencia } from '@/componentes/enlaces-trabajos';
import { FrenosProyecto } from '@/componentes/proyectos/frenos';
import { LineaRecorrido } from '@/componentes/proyectos/linea-recorrido';
import { MapaRecorrido } from '@/componentes/proyectos/mapa-recorrido';
import { faltanDespues, plural, textoAvance, textoEtapaActual } from '@/componentes/proyectos/textos';
import { formatearFecha } from '@/dominio/formato';
import { obtenerRecorrido } from '@/servicios/proyectos';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import '../proyectos.css';

export default async function PaginaProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContextoApp();
  const r = await obtenerRecorrido(ctx, id);
  if (!r) notFound();
  const faltan = faltanDespues(r);
  const vencido = !r.terminado && r.proximidad.vencido;

  return (
    <div className="proyecto-detalle">
      <header className="pagina__cabecera">
        <Link href="/proyectos" className="volver">
          <ArrowLeft className="icono" aria-hidden="true" />
          Proyectos
        </Link>
        <h1 className="pagina__titulo">
          {r.nombre} <Referencia valor={r.clave} />
        </h1>
        <p className="pagina__sub">{r.resultado}</p>
        <p className="proyecto-detalle__meta">
          <span>Responsable: {r.responsable.nombre}</span>
          {r.fecha ? (
            <span className="proyecto-detalle__fecha" data-vencido={vencido || undefined}>
              <CalendarClock className="icono" aria-hidden="true" />
              Entrega <time dateTime={r.fecha.toISOString()}>{formatearFecha(r.fecha)}</time>
              {!r.terminado && <strong> · {r.proximidad.texto}</strong>}
            </span>
          ) : (
            <span>Sin fecha de entrega</span>
          )}
        </p>
      </header>

      {r.total === 0 ? (
        <div className="vacio proyecto-detalle__vacio">
          <p>
            <strong>Este proyecto aún no tiene trabajos.</strong>
          </p>
          <p>
            Cuando alguien capture un trabajo para «{r.nombre}», aparecerá aquí en el orden en que debe ocurrir: primero lo que
            no espera a nadie y después lo que depende de otros, cada uno con su responsable, su plazo y su estado.
          </p>
        </div>
      ) : (
        <>
          <section className="panorama" aria-label="Resumen del recorrido">
            <div className="panorama__mapa">
              <MapaRecorrido etapas={r.etapas} tamano="grande" maxApilados={6} />
              <p className="panorama__leyenda" aria-hidden="true">
                <span data-punto="hecho">Hecho</span>
                <span data-punto="actual">Ahora</span>
                <span data-punto="bloqueado">Bloqueado</span>
                <span data-punto="atrasado">Atrasado</span>
                <span data-punto="riesgo">En riesgo</span>
                <span data-punto="pendiente">Después</span>
              </p>
            </div>
            <dl className="panorama__datos">
              <div>
                <dt>Avance</dt>
                <dd>{textoAvance(r)}</dd>
              </div>
              <div>
                <dt>Ahora</dt>
                <dd>{textoEtapaActual(r)}</dd>
              </div>
              <div>
                <dt>Después</dt>
                <dd>{faltan > 0 ? plural(faltan, 'trabajo', 'trabajos') : 'Nada más'}</dd>
              </div>
            </dl>
          </section>

          {r.terminado && (
            <p className="aviso-ok">
              <CircleCheck className="icono" aria-hidden="true" />
              Todos los trabajos de este proyecto están resueltos.
            </p>
          )}

          <FrenosProyecto frenos={r.frenos} />

          <section className="seccion" aria-labelledby="recorrido-titulo">
            <h2 className="seccion__titulo" id="recorrido-titulo">
              {r.modo === 'dias' ? 'Día por día' : 'Secuencia'}{' '}
              <span className="seccion__cuenta">{plural(r.etapas.length, r.modo === 'dias' ? 'día' : 'etapa', r.modo === 'dias' ? 'días' : 'etapas')}</span>
            </h2>
            <p className="proyecto-detalle__explica">
              {r.modo === 'dias'
                ? 'Estos trabajos casi no dependen entre sí: van ordenados por el día de su plazo.'
                : 'De arriba abajo, en el orden en que deben ocurrir. Lo que está en la misma etapa puede hacerse a la vez.'}
            </p>
            <LineaRecorrido recorrido={r} />
          </section>
        </>
      )}
    </div>
  );
}
