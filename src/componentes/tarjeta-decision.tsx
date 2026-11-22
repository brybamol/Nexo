'use client';
// Decisión con opciones A/B/C, Aprobar por opción y Rechazar con motivo. Tarea 4.2; presentación rehecha.
// Props: `decision` (DecisionVista); `personaActualId` (persona de «ver como»: solo si es el decisor
// y la decisión está pendiente se muestran los botones). Nexo no recomienda: `opcionPropuesta` es
// la opción que propuso el proponente.
// De arriba abajo: cabecera (referencia, título, estado; proyecto, quién propone, quién decide y cuándo), qué pasó,
// trabajos afectados (plegados, por proyecto) y la comparación de opciones con los botones al pie. Una decisión ya
// tomada se resume en una línea y el caso completo queda plegado.
import '@/app/decisiones/decisiones.css';
import { Check, ChevronDown, CircleAlert, CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { accionAprobar, accionRechazar, type ResultadoDecision } from '@/app/acciones/decisiones';
import { ComparacionOpciones } from '@/componentes/decisiones/comparacion-opciones';
import { afectadosPorProyecto, efectosPorProyecto, nombreOpcion, partirContexto, plural } from '@/componentes/decisiones/presentacion';
import { EnlaceTrabajo, EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
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
  const [resultado, setResultado] = useState<{ r: ResultadoDecision; tipo: 'aprobar' | 'rechazar' } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const refResultado = useRef<HTMLDivElement>(null);

  const puedeDecidir = decision.estado === 'pendiente' && decision.decisor.id === personaActualId && !resultado;
  const decidida = decision.estado !== 'pendiente';
  const idTitulo = `dec-${decision.id}-titulo`;

  // El botón que se pulsó desaparece al decidir: el foco pasa al aviso del resultado.
  useEffect(() => {
    if (resultado) refResultado.current?.focus();
  }, [resultado]);

  function terminar(r: ResultadoDecision, tipo: 'aprobar' | 'rechazar') {
    if (r.ok) {
      setResultado({ r, tipo });
      setConfirmando(null);
      setError(null);
    } else {
      setError(r.error);
    }
  }

  function aprobar(letra: LetraOpcion) {
    iniciar(async () => terminar(await accionAprobar(decision.id, letra), 'aprobar'));
  }

  function rechazar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!motivo.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    iniciar(async () => terminar(await accionRechazar(decision.id, motivo), 'rechazar'));
  }

  const IconoEstado = ICONO_ESTADO[decision.estado];
  const opcionConfirmada = confirmando?.tipo === 'aprobar' ? decision.opciones.find((o) => o.letra === confirmando.letra) : undefined;

  const caso = (
    <>
      <CasoDecision decision={decision} />
      <ComparacionOpciones
        decision={decision}
        puedeDecidir={puedeDecidir}
        ocupado={pendiente}
        confirmando={puedeDecidir && opcionConfirmada ? opcionConfirmada.letra : null}
        onAprobar={(letra) => {
          setError(null);
          setConfirmando({ tipo: 'aprobar', letra });
        }}
      />
    </>
  );

  return (
    <article className="dec" data-estado={decision.estado} aria-labelledby={idTitulo} aria-busy={pendiente}>
      <header className="dec__cabecera">
        <div className="dec__titular">
          {decision.referencia && (
            <span className="codigo dec__ref" aria-hidden="true">
              {decision.referencia}
            </span>
          )}
          <h3 id={idTitulo} className="dec__titulo">
            {decision.titulo}
            <span className="sr-only">
              {decision.referencia && ` (${decision.referencia})`} · {ETIQUETA_ESTADO[decision.estado]}
            </span>
          </h3>
          <span className="insignia dec__estado" data-estado={decision.estado} aria-hidden="true">
            <IconoEstado className="icono" />
            {ETIQUETA_ESTADO[decision.estado]}
          </span>
        </div>
        <p className="dec__meta">
          <span>{decision.proyecto.nombre}</span>
          <span>
            Propone <strong>{decision.proponente.nombre}</strong>, {decision.proponente.rol}
          </span>
          <span>
            Decide <strong>{decision.decisor.nombre}</strong>, {decision.decisor.rol}
          </span>
          <span>
            <time dateTime={decision.creadaEn.toISOString()}>{formatearFecha(decision.creadaEn)}</time>
          </span>
        </p>
      </header>

      {decidida ? (
        <>
          <ResumenDecidida decision={decision} />
          <details className="dec__plegado">
            <summary>
              <ChevronDown className="icono" aria-hidden="true" />
              Ver el caso y las opciones
            </summary>
            <div className="dec__plegado-cuerpo">{caso}</div>
          </details>
        </>
      ) : (
        caso
      )}

      {puedeDecidir && opcionConfirmada && (
        <div role="group" aria-label={`Confirmar la opción ${opcionConfirmada.letra}`} className="dec__confirmar">
          <p>
            ¿Aprobar la opción {opcionConfirmada.letra} ({opcionConfirmada.costoTexto})?{' '}
            <span className="dec__confirmar-nota">Se crearán los trabajos y se avisará a los afectados.</span>
          </p>
          <div className="dec__botones">
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
        <div className="dec__rechazo">
          {confirmando?.tipo !== 'rechazar' ? (
            <>
              <p className="dec__rechazo-nota">¿Ninguna opción sirve?</p>
              <button
                type="button"
                className="boton boton--quieto dec__rechazar"
                disabled={pendiente}
                aria-label={`Rechazar la decisión ${decision.titulo}`}
                onClick={() => {
                  setError(null);
                  setConfirmando({ tipo: 'rechazar' });
                }}
              >
                Rechazar
              </button>
            </>
          ) : (
            <form onSubmit={rechazar} className="dec__rechazo-form">
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
              <div className="dec__botones">
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

      {decision.estado === 'pendiente' && decision.decisor.id !== personaActualId && (
        <p className="dec__ajeno">
          <Hourglass className="icono" aria-hidden="true" />
          Pendiente de {decision.decisor.nombre}. Solo esa persona puede decidir.
        </p>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {resultado?.r.ok && (
        <div role="status" className="aviso-ok dec__resultado" tabIndex={-1} ref={refResultado}>
          <CircleCheck className="icono" aria-hidden="true" />
          <p>
            {resultado.tipo === 'rechazar' ? 'Decisión rechazada.' : 'Decisión registrada.'}
            {resultado.r.trabajosCreados.length > 0 && (
              <>
                {' '}
                Trabajos creados: <EnlacesTrabajos trabajos={resultado.r.trabajosCreados} />.
              </>
            )}
            {resultado.r.avisosA.length > 0 && <> Se avisó a: {resultado.r.avisosA.join(', ')}.</>}
          </p>
        </div>
      )}
    </article>
  );
}

/** Qué pasó (el contexto del motor, frase por frase) y a quién afecta (plegado, por proyecto). */
function CasoDecision({ decision }: { decision: DecisionVista }) {
  const hechos = partirContexto(decision.contexto);
  const grupos = afectadosPorProyecto(decision);
  const idQue = `dec-${decision.id}-que`;
  return (
    <section className="dec__caso" aria-labelledby={idQue}>
      <h4 id={idQue} className="dec__subtitulo">
        Qué pasó
      </h4>
      <ul className="dec__hechos">
        {hechos.map((h, i) => (
          <li key={i}>
            {h.etiqueta ? (
              <>
                <span className="dec__hecho-etiqueta">{h.etiqueta}:</span> {h.texto}
              </>
            ) : (
              h.texto
            )}
          </li>
        ))}
      </ul>
      {decision.afectados.length > 0 && (
        <details className="dec__afectados">
          <summary>
            <ChevronDown className="icono" aria-hidden="true" />
            {plural(decision.afectados.length, 'trabajo afectado', 'trabajos afectados')}
            {grupos.length > 1 && ` en ${grupos.length} proyectos`}
          </summary>
          <div className="dec__afectados-grupos">
            {grupos.map((g) => (
              <div key={g.clave || 'otros'} className="dec__afectados-grupo">
                <p className="dec__afectados-proyecto">
                  {g.nombre ?? (g.clave ? <span className="ref">{g.clave}</span> : 'Otros trabajos')}
                </p>
                <ul className="dec__lista">
                  {g.trabajos.map((a) => (
                    <li key={a.trabajoId}>
                      <EnlaceTrabajo trabajo={{ id: a.trabajoId, titulo: a.titulo, referencia: a.referencia }} />
                      {a.responsable && <span className="dec__responsable"> · {a.responsable}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

/** Una decisión ya tomada, en una línea: qué se eligió, cuánto y cuándo; o el motivo del rechazo. */
function ResumenDecidida({ decision }: { decision: DecisionVista }) {
  const cuando = decision.decididaEn && (
    <>
      {' '}
      el <time dateTime={decision.decididaEn.toISOString()}>{formatearFecha(decision.decididaEn)}</time>
    </>
  );

  if (decision.estado === 'rechazada') {
    return (
      <div className="dec__resumen" data-estado="rechazada">
        <CircleX className="icono" aria-hidden="true" />
        <div>
          <p className="dec__resumen-linea">
            {decision.decisor.nombre} la rechazó{cuando}.
          </p>
          <p className="dec__resumen-motivo">Motivo: {decision.motivoRechazo ?? 'no lo sé'}</p>
        </div>
      </div>
    );
  }

  const o = decision.opciones.find((x) => x.letra === decision.opcionElegida);
  const efectos = o ? efectosPorProyecto([o]) : null;
  const efectosDeO = o && efectos ? (efectos.porOpcion[o.letra] ?? {}) : null;
  return (
    <div className="dec__resumen" data-estado="aprobada">
      <CircleCheck className="icono" aria-hidden="true" />
      <div>
        <p className="dec__resumen-linea">
          {decision.decisor.nombre} aprobó la opción {decision.opcionElegida ?? ''}
          {cuando}.
        </p>
        {o && (
          <p className="dec__resumen-datos">
            <span className="dec__resumen-costo">{o.costoTexto}</span>
            {nombreOpcion(o) && <span>{nombreOpcion(o)}</span>}
            {o.lineas.length === 1 && (
              <span>
                Llega <time dateTime={o.lineas[0]!.llegada.toISOString()}>{formatearFecha(o.lineas[0]!.llegada)}</time>
              </span>
            )}
          </p>
        )}
        {o &&
          (efectosDeO ? (
            <ul className="dec__resumen-efectos">
              {Object.entries(efectosDeO).map(([p, e]) => (
                <li key={p} data-efecto={e.tipo}>
                  {p}: {e.tipo === 'atrasa' ? `se atrasa hasta el ${e.hasta}` : 'a tiempo'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dec__resumen-motivo">{o.consecuencia}</p>
          ))}
      </div>
    </div>
  );
}
