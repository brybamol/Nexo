// Detalle de un trabajo: estado, marcas con causas, bloqueante, notas, dependencias. Lee obtenerTrabajo. Tarea 1.7.
// Reforma de escalamiento: el responsable del proyecto, quien recibió el escalamiento y el responsable de la operación
// ven Reasignar / Mover el plazo / Declarar bloqueo (lo decide y lo vuelve a validar el servidor).
import { eq } from 'drizzle-orm';
import { ArrowLeft, Ban, Clock, ExternalLink, Link2, Package, TriangleAlert, Zap } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccionesDueno } from '@/componentes/acciones-dueno';
import { BotonResponder } from '@/componentes/boton-responder';
import { ConfirmarRecibido } from '@/componentes/confirmar-recibido';
import { EnlaceTrabajo, EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import { FormularioEntrega } from '@/componentes/formulario-entrega';
import { InsigniaConfianza } from '@/componentes/insignia-confianza';
import { CodigoTrabajo, InsigniaEstado } from '@/componentes/insignia-estado';
import { DetalleEntrega, InsigniaEntrega } from '@/componentes/insignia-entrega';
import { InsigniaMarcas } from '@/componentes/insignia-marcas';
import { ResultadoPedidos } from '@/componentes/resultado-pedidos';
import { TarjetaPropuesta } from '@/componentes/tarjeta-propuesta';
import { trabajos as tablaTrabajos } from '@/db/esquema';
import { formatearFecha } from '@/dominio/formato';
import { citaConReferencia } from '@/dominio/nombres';
import { partesCR } from '@/dominio/tiempo';
import type { CausaRiesgo, TipoEvidencia } from '@/dominio/tipos';
import type { TrabajoVista } from '@/servicios/vistas';
import { obtenerTrabajo } from '@/servicios/consultas-trabajos';
import { obtenerPermisosActuar } from '@/servicios/estado-trabajos';
import { listarPersonas } from '@/servicios/personas';
import { listarProyectos } from '@/servicios/proyectos';
import '@/app/mi-dia/reformas.css';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

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

const ROTULO_EVIDENCIA: Record<TipoEvidencia, string> = {
  pedido: 'Pedido',
  aceptacion: 'Aceptación',
  espera: 'Espera',
  entrega: 'Entrega',
  recepcion: 'Recepción',
  insistencia: 'Insistencia',
};

/** Rótulo de la insignia de confianza (docs/08 §6): de dónde sale el trabajo y quién lo afirmó. */
function rotuloConfianza(t: TrabajoVista): string {
  if (t.confianza === 'una_fuente') return 'Propuesto por Nexo · una fuente';
  if (t.confianza === 'dos_fuentes') {
    const partes = [t.solicitadoPor?.nombre, t.responsable.nombre].filter((n): n is string => Boolean(n));
    return `Confirmado por dos buzones: ${partes.join(' y ')}`;
  }
  if (t.confirmadoPor) return `Confirmado por ${t.confirmadoPor.nombre}`;
  if (t.origen === 'captura') {
    const autor = t.evidencias.find((e) => e.autor)?.autor ?? t.solicitadoPor ?? null;
    return autor ? `Lo escribió ${autor.nombre}` : 'Escrito en la captura';
  }
  if (t.origen === 'decision') return 'Creado a partir de una decisión aprobada';
  return 'Registrado en Nexo';
}

export default async function PaginaTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContextoApp();
  const yoId = await personaActual();
  const t = await obtenerTrabajo(ctx, id, yoId);
  if (!t) {
    // Un propuesto ajeno no se ve (regla 18): se dice con claridad, sin mostrar nada más.
    const [fila] = await ctx.db.select().from(tablaTrabajos).where(eq(tablaTrabajos.id, id));
    if (fila?.confirmacion !== 'propuesto') notFound();
    const todas = await listarPersonas(ctx);
    const dueno = todas.find((p) => p.id === fila.duenoPropuestaId)?.nombre ?? 'otra persona';
    return (
      <>
        <header className="pagina__cabecera">
          <h1 className="pagina__titulo">Propuesta de Nexo</h1>
        </header>
        <p className="vacio">
          Este trabajo todavía es una propuesta de Nexo para {dueno}. Solo {dueno} la ve hasta que la confirme.
        </p>
      </>
    );
  }
  const permisos = await obtenerPermisosActuar(ctx, yoId, [t.id]);
  const permiso = permisos.trabajos[t.id];
  const esPropuestaMia = t.confirmacion === 'propuesto' && t.dueno?.id === yoId;
  const [personas, proyectos] = esPropuestaMia ? await Promise.all([listarPersonas(ctx), listarProyectos(ctx)]) : [[], []];
  const cita = citaConReferencia(t.titulo, t.referencia);
  const otroSolicitante = t.solicitadoPor && t.solicitadoPor.id !== t.responsable.id ? t.solicitadoPor : null;
  const sinResolver = t.estado !== 'resuelto' && t.confirmacion === 'confirmado';
  // Regla 19: quién puede dar qué por resuelto. Se decide aquí con los ids; el servicio lo vuelve a validar.
  const soyResponsable = t.responsable.id === yoId;
  const soySolicitante = otroSolicitante?.id === yoId;
  return (
    <ResultadoPedidos key={yoId}>
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
        <p className="detalle__confianza">
          <InsigniaConfianza confianza={t.confianza} texto={rotuloConfianza(t)} />
        </p>
      </header>

      {esPropuestaMia && (
        <section aria-labelledby="revisar" className="seccion">
          <h2 id="revisar" className="seccion__titulo">
            Revisa esta propuesta
          </h2>
          <TarjetaPropuesta
            trabajo={t}
            yoId={yoId}
            personas={personas.map(({ id: pid, nombre, rol }) => ({ id: pid, nombre, rol }))}
            proyectos={proyectos.map(({ id: pid, nombre }) => ({ id: pid, nombre }))}
            hoy={partesCR(permisos.ahora).fecha}
            conEnlace={false}
          />
        </section>
      )}

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
              {t.entrega && t.estado !== 'resuelto' && t.confirmacion === 'confirmado' ? (
                // Con la entrega declarada, lo que Nexo espera es la RECEPCIÓN, no un estado.
                <>
                  Nexo espera que {otroSolicitante?.nombre ?? 'quien lo pidió'} confirme que lo recibió desde{' '}
                  {formatearFecha(t.seguimiento.desde)}
                </>
              ) : t.confirmacion === 'propuesto' ? (
                <>Propuesta por revisar desde {formatearFecha(t.seguimiento.desde)}</>
              ) : (
                <>
                  Nivel {t.seguimiento.nivel} desde {formatearFecha(t.seguimiento.desde)}
                </>
              )}
            </dd>
          </div>
        )}
      </dl>

      {t.entrega && sinResolver && (
        <section aria-labelledby="entrega" className="seccion">
          <h2 id="entrega" className="seccion__titulo">
            Entrega
          </h2>
          <div className="bloque-entrega">
            <InsigniaEntrega confirma={t.solicitadoPor} />
            <DetalleEntrega entrega={t.entrega} />
            {soySolicitante && <ConfirmarRecibido trabajoId={t.id} cita={cita} entregadoPor={t.entrega.por.nombre} />}
          </div>
        </section>
      )}
      {t.entrega && t.estado === 'resuelto' && (
        <section aria-labelledby="entrega" className="seccion">
          <h2 id="entrega" className="seccion__titulo">
            Entrega
          </h2>
          <DetalleEntrega entrega={t.entrega} />
        </section>
      )}

      {sinResolver && !t.entrega && !t.seguimiento && (soyResponsable || soySolicitante) && (
        <section aria-labelledby="cerrar" className="seccion">
          <h2 id="cerrar" className="seccion__titulo">
            Darlo por terminado
          </h2>
          {soyResponsable && otroSolicitante ? (
            <FormularioEntrega trabajoId={t.id} cita={cita} modo="entregar" solicitanteNombre={otroSolicitante.nombre} />
          ) : soySolicitante ? (
            <FormularioEntrega trabajoId={t.id} cita={cita} modo="resolver" etiqueta="Ya lo recibí" />
          ) : (
            <FormularioEntrega trabajoId={t.id} cita={cita} modo="resolver" />
          )}
        </section>
      )}

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

      {t.seguimiento && t.confirmacion === 'confirmado' && !t.entrega && (
        <section aria-labelledby="responder" className="seccion">
          <h2 id="responder" className="seccion__titulo">
            Seguimiento pendiente
          </h2>
          <BotonResponder
            trabajoId={t.id}
            titulo={t.titulo}
            {...(soyResponsable && otroSolicitante ? { entrega: { solicitante: otroSolicitante.nombre } } : {})}
          />
        </section>
      )}

      {permiso && (
        <section aria-labelledby="destrabar" className="seccion">
          <h2 id="destrabar" className="seccion__titulo">
            Destrabar este trabajo
          </h2>
          <AccionesDueno
            trabajoId={t.id}
            titulo={t.titulo}
            razon={permiso.razon}
            responsableId={permiso.responsableId}
            personas={permisos.personas.map(({ id: pid, nombre, rol }) => ({ id: pid, nombre, rol }))}
            plazoFecha={partesCR(permiso.plazo).fecha}
            plazoHora={partesCR(permiso.plazo).hora}
            hoy={partesCR(permisos.ahora).fecha}
          />
        </section>
      )}

      <section aria-labelledby="evidencia" className="seccion">
        <h2 id="evidencia" className="seccion__titulo">
          Evidencia
        </h2>
        {t.evidencias.length === 0 ? (
          <p className="vacio">Todavía no hay evidencia registrada para este trabajo.</p>
        ) : (
          <ul className="evidencias">
            {t.evidencias.map((e, i) => (
              <li key={i}>
                <p className="evidencias__cabecera">
                  <strong>{ROTULO_EVIDENCIA[e.tipo]}</strong>
                  {e.autor && <span>{e.autor.nombre}</span>}
                  <time dateTime={e.en.toISOString()}>{formatearFecha(e.en)}</time>
                  {e.enlace && (
                    <a href={e.enlace} target="_blank" rel="noreferrer noopener" className="enlace-externo">
                      <ExternalLink className="icono" aria-hidden="true" />
                      Abrir en Gmail
                    </a>
                  )}
                </p>
                <blockquote className="cita">{e.cita}</blockquote>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </ResultadoPedidos>
  );
}
