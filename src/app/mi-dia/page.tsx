// Lo que debo, lo que espero de otros, qué cambió y decisiones pendientes. Lee obtenerMiDia. Tarea 4.1.
// Orden: (1) lo que Nexo me pide ahora, (2) mis avisos, (3) lo que debo, (4) lo que espero de otros.
// Reforma de escalamiento: quien puede actuar sobre un trabajo (responsable del proyecto, a quien se escaló,
// responsable de la operación) ve Reasignar / Mover el plazo / Declarar bloqueo en «Nexo te pide» y bajo el aviso de
// escalamiento (si el trabajo no está ya en «Nexo te pide»).
import { BellRing, Scale } from 'lucide-react';
import Link from 'next/link';
import { AccionesDueno, ResultadoAcciones } from '@/componentes/acciones-dueno';
import { BotonResponder } from '@/componentes/boton-responder';
import { EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import { ListaAvisos } from '@/componentes/lista-avisos';
import { IsotipoNexo } from '@/componentes/marca/logo-nexo';
import { TarjetaTrabajo } from '@/componentes/tarjeta-trabajo';
import { formatearFecha } from '@/dominio/formato';
import { partesCR } from '@/dominio/tiempo';
import { obtenerPermisosActuar, type PermisosActuar } from '@/servicios/estado-trabajos';
import { obtenerMiDia, obtenerSeguimientosPendientes } from '@/servicios/mi-dia';
import type { AvisoVista, TrabajoVista } from '@/servicios/vistas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

/** Las tres acciones del dueño del resultado para `trabajoId`, o nada si la persona no puede actuar sobre él. */
function Acciones({ trabajoId, titulo, permisos }: { trabajoId: string; titulo: string; permisos: PermisosActuar }) {
  const p = permisos.trabajos[trabajoId];
  if (!p) return null;
  const plazo = partesCR(p.plazo);
  return (
    <AccionesDueno
      trabajoId={trabajoId}
      titulo={titulo}
      razon={p.razon}
      responsableId={p.responsableId}
      personas={permisos.personas.map(({ id, nombre, rol }) => ({ id, nombre, rol }))}
      plazoFecha={plazo.fecha}
      plazoHora={plazo.hora}
      hoy={partesCR(permisos.ahora).fecha}
    />
  );
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
            Bloquea: <EnlacesTrabajos trabajos={trabajo.bloqueaTrabajos} />.
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

  // Escalamientos recibidos: el trabajo escalado es el primero del aviso. Solo el más reciente de cada trabajo lleva
  // las acciones, y no si el trabajo ya está en «Nexo te pide» (ahí ya las tiene).
  const enPedidos = new Set(pedidos.map((t) => t.id));
  const avisoConAcciones = new Map<number, string>();
  const vistos = new Set<string>();
  for (const a of dia.avisos) {
    const id = a.trabajoIds[0];
    if (a.tipoAccion !== 'escalamiento' || !id || enPedidos.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    avisoConAcciones.set(a.id, id);
  }
  const permisos = await obtenerPermisosActuar(ctx, personaId, [...enPedidos, ...avisoConAcciones.values()]);
  const extraAviso = (a: AvisoVista) => {
    const id = avisoConAcciones.get(a.id);
    const ref = id ? a.trabajos.find((t) => t.id === id) : undefined;
    if (!id || !ref) return null;
    return (
      <div className="aviso__dueno">
        <Acciones trabajoId={id} titulo={ref.titulo} permisos={permisos} />
      </div>
    );
  };

  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Mi día · {dia.persona.nombre}</h1>
        <p className="pagina__sub">
          {dia.persona.rol} ·{' '}
          <time dateTime={dia.ahora.toISOString()}>{formatearFecha(dia.ahora)}</time>
        </p>
      </header>

      <ResultadoAcciones>
      <div className="mi-dia">
        <section aria-labelledby="md-pide" className="seccion mi-dia__pide">
          <h2 id="md-pide" className="seccion__titulo">
            <IsotipoNexo tamano={22} />
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
                  <Acciones trabajoId={t.id} titulo={t.titulo} permisos={permisos} />
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
            <ListaAvisos avisos={dia.avisos} extra={extraAviso} />
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
      </ResultadoAcciones>
    </>
  );
}
