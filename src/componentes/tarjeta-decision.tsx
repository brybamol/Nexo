'use client';
// Decisión con opciones A/B/C, Aprobar por opción y Rechazar con motivo. Tarea 4.2.
// Props: `decision` (DecisionVista); `personaActualId` (persona de «ver como»: solo si es el decisor
// y la decisión está pendiente se muestran los botones). Nexo no recomienda: `opcionPropuesta` es
// la opción que propuso el proponente.
import { ArrowRight, Check, CircleAlert, CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionAprobar, accionRechazar, type ResultadoDecision } from '@/app/acciones/decisiones';
import { EnlaceTrabajo, EnlacesTrabajos, Referencia } from '@/componentes/enlaces-trabajos';
import { formatearFecha } from '@/dominio/formato';
import type { LetraOpcion } from '@/dominio/tipos';
import type { DecisionVista } from '@/servicios/vistas';

type Confirmando = { tipo: 'aprobar'; letra: LetraOpcion } | { tipo: 'rechazar' } | null;

const ETIQUETA_ESTADO = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' } as const;
// Pendiente espera la aprobación de una persona; Aprobada y Rechazada quedan registradas.
const ICONO_ESTADO = { pendiente: Hourglass, aprobada: CircleCheck, rechazada: CircleX } as const;

export function TarjetaDecision({ decision, personaActualId }: { decision: DecisionVista; personaActualId: string }) {
  const [confirmando, setConfirmando] = useState<Confirmando>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDecision | null>(null);
  const [pendiente, iniciar] = useTransition();

  const puedeDecidir = decision.estado === 'pendiente' && decision.decisor.id === personaActualId && !resultado;
  const idTitulo = `dec-${decision.id}-titulo`;

  function terminar(r: ResultadoDecision) {
    if (r.ok) {
      setResultado(r);
      setConfirmando(null);
      setError(null);
    } else {
      setError(r.error);
    }
  }

  function aprobar(letra: LetraOpcion) {
    iniciar(async () => terminar(await accionAprobar(decision.id, letra)));
  }

  function rechazar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!motivo.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    iniciar(async () => terminar(await accionRechazar(decision.id, motivo)));
  }

  const IconoEstado = ICONO_ESTADO[decision.estado];
  const opcionConfirmada = confirmando?.tipo === 'aprobar' ? decision.opciones.find((o) => o.letra === confirmando.letra) : undefined;

  return (
    <article className="tarjeta decision" data-estado={decision.estado} aria-labelledby={idTitulo} aria-busy={pendiente}>
      <div className="decision__cabecera">
        {decision.referencia && (
          <span className="codigo" aria-hidden="true">
            {decision.referencia}
          </span>
        )}
        <h3 id={idTitulo} className="decision__titulo">
          {decision.titulo}
          <span className="sr-only">
            {decision.referencia && ` (${decision.referencia})`} · {decision.proyecto.nombre} · {ETIQUETA_ESTADO[decision.estado]}
          </span>
        </h3>
        <span className="insignia decision__estado" data-estado={decision.estado} aria-hidden="true">
          <IconoEstado className="icono" />
          {ETIQUETA_ESTADO[decision.estado]}
        </span>
      </div>
      <p className="decision__meta">{decision.proyecto.nombre}</p>
      <p className="decision__contexto">{decision.contexto}</p>
      <p className="decision__meta">
        Propuesta por {decision.proponente.nombre} ({decision.proponente.rol}) el{' '}
        <time dateTime={decision.creadaEn.toISOString()}>{formatearFecha(decision.creadaEn)}</time>. Decide{' '}
        {decision.decisor.nombre} ({decision.decisor.rol}).
      </p>
      {decision.afectados.length > 0 && (
        <p className="decision__meta">
          Afecta a:{' '}
          {decision.afectados.map((a, i) => (
            <span key={a.trabajoId}>
              {i > 0 && '; '}
              <EnlaceTrabajo trabajo={{ id: a.trabajoId, titulo: a.titulo, referencia: a.referencia }} />
              {a.responsable && `, ${a.responsable}`}
            </span>
          ))}
          .
        </p>
      )}

      <div className="opciones">
        {decision.opciones.map((o) => {
          const idOp = `dec-${decision.id}-op-${o.letra}`;
          const elegida = decision.opcionElegida === o.letra;
          return (
            <section key={o.letra} aria-labelledby={idOp} className="opcion" data-elegida={elegida || undefined}>
              <div className="opcion__cabecera">
                <h4 id={idOp}>
                  <span className="opcion__letra" aria-hidden="true">
                    {o.letra}
                  </span>
                  <span>
                    Opción {o.letra}
                    {elegida && <span className="sr-only"> · Elegida</span>}
                  </span>
                </h4>
                {elegida && (
                  <span className="opcion__sello" aria-hidden="true">
                    <Check className="icono" />
                    Elegida
                  </span>
                )}
                {decision.opcionPropuesta === o.letra && (
                  <p className="opcion__propuesta">Propuesta por {decision.proponente.nombre}</p>
                )}
              </div>
              <dl className="opcion__costo">
                <dt>Costo</dt>
                <dd>{o.costoTexto}</dd>
              </dl>
              <p className="opcion__descripcion">{o.descripcion}</p>
              <dl className="opcion__datos">
                {o.lineas.length > 0 && (
                  <div>
                    <dt>Lo que se compra</dt>
                    <dd>
                      <ul>
                        {o.lineas.map((l, i) => (
                          <li key={i}>
                            {l.cantidad} × {l.proveedor === 'local' ? 'proveedor local' : 'proveedor habitual'}, llega{' '}
                            <time dateTime={l.llegada.toISOString()}>{formatearFecha(l.llegada)}</time>
                            {l.trabajoIds.length > 0 && (
                              <>
                                {' '}
                                para{' '}
                                {l.trabajoIds.map((id, k) => (
                                  <span key={id}>
                                    {k > 0 && '; '}
                                    {decision.trabajos[id]?.titulo ?? 'otro trabajo'}{' '}
                                    <Referencia valor={decision.trabajos[id]?.referencia ?? ''} />
                                  </span>
                                ))}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Consecuencia</dt>
                  <dd>{o.consecuencia}</dd>
                </div>
                <div>
                  <dt>Cambios de fecha</dt>
                  <dd>
                    {o.cambiosFecha.length === 0 ? (
                      'Ninguno.'
                    ) : (
                      <ul>
                        {o.cambiosFecha.map((c) => (
                          <li key={c.trabajoId} className="opcion__cambio">
                            <span>
                              <EnlaceTrabajo
                                trabajo={decision.trabajos[c.trabajoId] ?? { id: c.trabajoId, titulo: 'otro trabajo', referencia: '' }}
                              />
                              :
                            </span>{' '}
                            <time dateTime={c.de.toISOString()}>{formatearFecha(c.de)}</time>
                            <ArrowRight className="icono" aria-hidden="true" />
                            <span className="sr-only">→ </span>
                            <time dateTime={c.a.toISOString()}>{formatearFecha(c.a)}</time>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
              {puedeDecidir && (
                <div className="opcion__accion">
                  <button
                    type="button"
                    className="boton"
                    disabled={pendiente}
                    aria-label={`Aprobar opción ${o.letra} de la decisión ${decision.titulo}`}
                    onClick={() => {
                      setError(null);
                      setConfirmando({ tipo: 'aprobar', letra: o.letra });
                    }}
                  >
                    Aprobar opción {o.letra}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {puedeDecidir && opcionConfirmada && (
        <div role="group" aria-label={`Confirmar la opción ${opcionConfirmada.letra}`} className="decision__confirmar">
          <p>
            ¿Aprobar la opción {opcionConfirmada.letra} ({opcionConfirmada.costoTexto})? Se crearán los trabajos y se
            avisará a los afectados.
          </p>
          <div className="decision__botones">
            <button
              type="button"
              autoFocus
              disabled={pendiente}
              className="boton boton--solido"
              onClick={() => aprobar(opcionConfirmada.letra)}
            >
              <Check className="icono" aria-hidden="true" />
              {pendiente ? 'Aprobando…' : `Sí, aprobar la opción ${opcionConfirmada.letra}`}
            </button>
            <button type="button" disabled={pendiente} className="boton boton--quieto" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {puedeDecidir && (
        <div className="decision__rechazo">
          {confirmando?.tipo !== 'rechazar' ? (
            <button
              type="button"
              className="boton boton--peligro"
              disabled={pendiente}
              aria-label={`Rechazar la decisión ${decision.titulo}`}
              onClick={() => {
                setError(null);
                setConfirmando({ tipo: 'rechazar' });
              }}
            >
              Rechazar
            </button>
          ) : (
            <form onSubmit={rechazar}>
              <label htmlFor={`dec-${decision.id}-motivo`} className="etiqueta-campo">
                Motivo del rechazo (obligatorio)
              </label>
              <textarea
                id={`dec-${decision.id}-motivo`}
                rows={3}
                maxLength={1000}
                autoFocus
                value={motivo}
                disabled={pendiente}
                className="campo"
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div className="decision__botones">
                <button type="submit" disabled={pendiente} className="boton boton--peligro boton--solido">
                  {pendiente ? 'Rechazando…' : 'Confirmar rechazo'}
                </button>
                <button type="button" disabled={pendiente} className="boton boton--quieto" onClick={() => setConfirmando(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {resultado?.ok && (
        <div role="status" className="aviso-ok">
          <CircleCheck className="icono" aria-hidden="true" />
          <p>
            {decision.estado === 'rechazada' ? 'Decisión rechazada.' : 'Decisión registrada.'}
            {resultado.trabajosCreados.length > 0 && (
              <>
                {' '}
                Trabajos creados:{' '}
                <EnlacesTrabajos trabajos={resultado.trabajosCreados} />
                .
              </>
            )}
            {resultado.avisosA.length > 0 && <> Se avisó a: {resultado.avisosA.join(', ')}.</>}
          </p>
        </div>
      )}

      {decision.estado === 'aprobada' && (
        <p className="decision__cierre">
          Aprobada con la opción {decision.opcionElegida}
          {decision.decididaEn && (
            <>
              {' '}
              el <time dateTime={decision.decididaEn.toISOString()}>{formatearFecha(decision.decididaEn)}</time>
            </>
          )}
          .
        </p>
      )}
      {decision.estado === 'rechazada' && (
        <p className="decision__cierre">
          Rechazada
          {decision.decididaEn && (
            <>
              {' '}
              el <time dateTime={decision.decididaEn.toISOString()}>{formatearFecha(decision.decididaEn)}</time>
            </>
          )}
          . Motivo: {decision.motivoRechazo}
        </p>
      )}
      {decision.estado === 'pendiente' && decision.decisor.id !== personaActualId && (
        <p className="decision__ajeno">Pendiente de {decision.decisor.nombre}. Solo esa persona puede decidir.</p>
      )}
    </article>
  );
}
