// Lo que debo, lo que espero de otros, qué cambió y decisiones pendientes. Lee obtenerMiDia. Tarea 4.1.
// Orden: (1) lo que Nexo me pide ahora, (2) mis avisos, (3) lo que debo, (4) lo que espero de otros.
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
function ItemTrabajo({ trabajo }: { trabajo: TrabajoVista }) {
  return (
    <li>
      <TarjetaTrabajo trabajo={trabajo} />
      <p>
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
    <main>
      <h1>Mi día · {dia.persona.nombre}</h1>
      <p>
        {dia.persona.rol} ·{' '}
        <time dateTime={dia.ahora.toISOString()}>{formatearFecha(dia.ahora)}</time>
      </p>

      <section aria-labelledby="md-pide">
        <h2 id="md-pide">Nexo te pide</h2>
        {pedidos.length === 0 ? (
          <p>Nexo no te está pidiendo nada ahora.</p>
        ) : (
          <ul>
            {pedidos.map((t) => (
              <li key={t.id}>
                <TarjetaTrabajo trabajo={t} />
                {t.seguimiento && (
                  <p>
                    Nexo pide el estado desde <time dateTime={t.seguimiento.desde.toISOString()}>{formatearFecha(t.seguimiento.desde)}</time>.
                  </p>
                )}
                <BotonResponder trabajoId={t.id} titulo={t.titulo} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {dia.decisionesPendientes.length > 0 && (
        <section aria-labelledby="md-decisiones">
          <h2 id="md-decisiones">Decisiones pendientes</h2>
          <p>
            Tienes {dia.decisionesPendientes.length} {dia.decisionesPendientes.length === 1 ? 'decisión' : 'decisiones'} por resolver:{' '}
            <Link href="/decisiones">ir a decisiones</Link>.
          </p>
        </section>
      )}

      <section aria-labelledby="md-cambio">
        <h2 id="md-cambio">Qué cambió</h2>
        <ListaAvisos avisos={dia.avisos} />
      </section>

      <section aria-labelledby="md-debo">
        <h2 id="md-debo">Lo que debes</h2>
        {dia.debo.length === 0 ? (
          <p>No tienes trabajos pendientes.</p>
        ) : (
          <ul>
            {dia.debo.map((t) => (
              <ItemTrabajo key={t.id} trabajo={t} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="md-espero">
        <h2 id="md-espero">Lo que esperas de otros</h2>
        {dia.esperoDeOtros.length === 0 ? (
          <p>No esperas nada de otras personas.</p>
        ) : (
          <ul>
            {dia.esperoDeOtros.map((t) => (
              <ItemTrabajo key={t.id} trabajo={t} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
