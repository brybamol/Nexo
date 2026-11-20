// Lo que debo, lo que espero de otros, qué cambió y decisiones pendientes. Lee obtenerMiDia. Tarea 4.1.
// Orden: (1) lo que Nexo me pide ahora, (2) mis avisos, (3) lo que debo, (4) lo que espero de otros.
import { BellRing, Scale } from 'lucide-react';
import Link from 'next/link';
import { BotonResponder } from '@/componentes/boton-responder';
import { ListaAvisos } from '@/componentes/lista-avisos';
import { TarjetaTrabajo } from '@/componentes/tarjeta-trabajo';
import { formatearFecha } from '@/dominio/formato';
import { obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import type { TrabajoVista } from '@/servicios/vistas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

function EnlacesTrabajos({ ids }: { ids: string[] }) {
  return ids.map((id, i) => (
    <span key={id}>
      {i > 0 && ', '}
      <Link href={`/trabajos/${id}`}>{id}</Link>
    </span>
  ));
}

/** Tarjeta del trabajo más lo que la tarjeta base no cuenta: quién lo pidió y qué arrastra. */
function Cuenta({ n }: { n: number }) {
  return <span className="seccion__cuenta">{n}</span>;
}

function ItemTrabajo({ trabajo }: { trabajo: TrabajoVista }) {
  return (
    <li>
      <TarjetaTrabajo trabajo={trabajo} />
      <p className="item-trabajo__extra">
        {trabajo.solicitadoPor && <>Lo pidió {trabajo.solicitadoPor.nombre}. </>}
        {trabajo.bloquea.length > 0 && (
          <>
            Bloquea: <EnlacesTrabajos ids={trabajo.bloquea} />.
          </>
        )}
      </p>
    </li>
  );
}

export default async function PaginaMiDia() {
  const ctx = await obtenerContextoApp();
  const personaId = await personaActual();
  const [dia, pedidos] = await Promise.all([obtenerMiDia(ctx, personaId), obtenerSeguimientosPendientes(ctx, personaId)]);

  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Mi día · {dia.persona.nombre}</h1>
        <p className="pagina__sub">
          {dia.persona.rol} ·{' '}
          <time dateTime={dia.ahora.toISOString()}>{formatearFecha(dia.ahora)}</time>
        </p>
      </header>

      <div className="mi-dia">
        <section aria-labelledby="md-pide" className="seccion mi-dia__pide">
          <h2 id="md-pide" className="seccion__titulo">
            Nexo te pide <Cuenta n={pedidos.length} />
          </h2>
          {pedidos.length === 0 ? (
            <p className="vacio">Nexo no te está pidiendo nada ahora.</p>
          ) : (
            <ul className="lista">
              {pedidos.map((t) => (
                <li key={t.id} className="pedido">
                  <TarjetaTrabajo trabajo={t} />
                  {t.seguimiento && (
                    <p className="pedido__nota">
                      <BellRing className="icono" aria-hidden="true" />
                      <span>
                        Nexo pide el estado desde{' '}
                        <time dateTime={t.seguimiento.desde.toISOString()}>{formatearFecha(t.seguimiento.desde)}</time>.
                      </span>
                    </p>
                  )}
                  <BotonResponder trabajoId={t.id} titulo={t.titulo} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mi-dia__lateral">
          {dia.decisionesPendientes.length > 0 && (
            <section aria-labelledby="md-decisiones" className="seccion">
              <h2 id="md-decisiones" className="seccion__titulo">
                Decisiones pendientes <Cuenta n={dia.decisionesPendientes.length} />
              </h2>
              <div className="decisiones-pendientes">
                <p>
                  Tienes {dia.decisionesPendientes.length}{' '}
                  {dia.decisionesPendientes.length === 1 ? 'decisión' : 'decisiones'} por resolver.
                </p>
                <Link href="/decisiones" className="boton boton--solido">
                  <Scale className="icono" aria-hidden="true" />
                  Ir a decisiones
                </Link>
              </div>
            </section>
          )}

          <section aria-labelledby="md-cambio" className="seccion">
            <h2 id="md-cambio" className="seccion__titulo">
              Qué cambió
            </h2>
            <ListaAvisos avisos={dia.avisos} />
          </section>
        </div>

        <section aria-labelledby="md-debo" className="seccion mi-dia__debo">
          <h2 id="md-debo" className="seccion__titulo">
            Lo que debes <Cuenta n={dia.debo.length} />
          </h2>
          {dia.debo.length === 0 ? (
            <p className="vacio">No tienes trabajos pendientes.</p>
          ) : (
            <ul className="lista">
              {dia.debo.map((t) => (
                <ItemTrabajo key={t.id} trabajo={t} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="md-espero" className="seccion mi-dia__espero">
          <h2 id="md-espero" className="seccion__titulo">
            Lo que esperas de otros <Cuenta n={dia.esperoDeOtros.length} />
          </h2>
          {dia.esperoDeOtros.length === 0 ? (
            <p className="vacio">No esperas nada de otras personas.</p>
          ) : (
            <ul className="lista">
              {dia.esperoDeOtros.map((t) => (
                <ItemTrabajo key={t.id} trabajo={t} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
