'use client';
// Resultado de una captura, con opciones si Nexo pregunta. Tarea 2.5.
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Copy,
  Info,
  MessageCircleQuestion,
  MessageSquareText,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ResultadoCaptura, TrabajoVista } from '@/servicios/vistas';
import { EnlaceTrabajo, EnlacesTrabajos, Referencia } from './enlaces-trabajos';
import { InsigniaImplementacion } from './insignia-implementacion';
import { TarjetaTrabajo } from './tarjeta-trabajo';

type Props = {
  resultado: ResultadoCaptura;
  /** Trabajos citados por el resultado (creados, actualizados o duplicado), ya cargados. */
  trabajos?: TrabajoVista[];
  /** Acción de formulario que envía la respuesta a la pregunta única (lleva `capturaId` y `respuesta`). */
  enviarRespuesta?: (formData: FormData) => void;
  /** true mientras se envía la respuesta. */
  pendiente?: boolean;
  /** true en las tarjetas viejas de un hilo: se leen, pero ya no se responden (la respuesta va más abajo). */
  soloLectura?: boolean;
};

const ICONOS = {
  aplicada: CircleCheck,
  pregunta: MessageCircleQuestion,
  duplicado: Copy,
  ignorada: Info,
  respuesta: MessageSquareText,
  error: CircleAlert,
} as const;

function Marco({
  titulo,
  resultado,
  esPropuesta = false,
  sinDato = false,
  children,
}: {
  titulo: string;
  resultado: ResultadoCaptura;
  /** true si lo creado espera la aprobación de una persona (una decisión): se muestra como propuesta, no como hecho. */
  esPropuesta?: boolean;
  /** true si Nexo respondió «No lo sé»: se nota en el título y en el icono. */
  sinDato?: boolean;
  children: ReactNode;
}) {
  const Icono = esPropuesta ? Scale : sinDato ? CircleHelp : ICONOS[resultado.estado];
  return (
    <article
      className="tarjeta tarjeta-captura"
      data-estado={resultado.estado}
      data-propuesta={esPropuesta || undefined}
      data-sin-dato={sinDato || undefined}
      aria-label={titulo}
    >
      <header>
        <h2>
          <Icono className="icono" aria-hidden="true" />
          {titulo}
        </h2>
        <InsigniaImplementacion ia={resultado.ia} />
      </header>
      {children}
    </article>
  );
}

const cuantos = (n: number) => `${n} ${n === 1 ? 'trabajo' : 'trabajos'}`;

function DetalleTrabajo({ trabajo }: { trabajo: TrabajoVista }) {
  return (
    <>
      <TarjetaTrabajo trabajo={trabajo} />
      {trabajo.bloquea.length > 0 && (
        <p className="tarjeta-captura__meta">
          Bloquea: <EnlacesTrabajos trabajos={trabajo.bloqueaTrabajos} />
        </p>
      )}
    </>
  );
}

function FormularioPregunta({
  resultado,
  opciones,
  enviarRespuesta,
  pendiente,
}: {
  resultado: Extract<ResultadoCaptura, { estado: 'pregunta' }>;
  opciones: { valor: string; etiqueta: string }[];
  enviarRespuesta?: (formData: FormData) => void;
  pendiente: boolean;
}) {
  const idCampo = `respuesta-captura-${resultado.capturaId}`;
  return (
    <form action={enviarRespuesta} aria-busy={pendiente}>
      <input type="hidden" name="capturaId" value={resultado.capturaId} />
      {opciones.length > 0 ? (
        <fieldset disabled={pendiente} className="tarjeta-captura__opciones">
          <legend className="sr-only">Opciones de respuesta</legend>
          {opciones.map((o) => (
            <button key={o.valor} type="submit" name="respuesta" value={o.valor} className="boton">
              {o.etiqueta}
            </button>
          ))}
        </fieldset>
      ) : (
        <div className="tarjeta-captura__respuesta">
          <div className="campo-envoltura">
            <label htmlFor={idCampo} className="etiqueta-campo">
              Tu respuesta
            </label>
            <input
              id={idCampo}
              name="respuesta"
              type="text"
              required
              autoComplete="off"
              disabled={pendiente}
              className="campo"
            />
          </div>
          <button type="submit" disabled={pendiente} className="boton boton--solido">
            {pendiente ? 'Enviando…' : 'Responder'}
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Tarjeta del resultado de una captura. Props: `resultado`, `trabajos?`, `enviarRespuesta?`, `pendiente?`.
 * Muestra la insignia de la implementación que respondió y, si Nexo pregunta, cómo responder.
 */
export function TarjetaResultadoCaptura({
  resultado,
  trabajos = [],
  enviarRespuesta,
  pendiente = false,
  soloLectura = false,
}: Props) {
  switch (resultado.estado) {
    case 'aplicada': {
      const creados = trabajos.filter((t) => resultado.trabajosCreados.includes(t.id));
      const actualizados = trabajos.filter((t) => resultado.trabajosActualizados.includes(t.id));
      const titulo =
        resultado.trabajosCreados.length > 0
          ? 'Trabajo creado'
          : resultado.decisionId
            ? 'Decisión creada'
            : 'Actualización hecha';
      return (
        <Marco titulo={titulo} resultado={resultado} esPropuesta={titulo === 'Decisión creada'}>
          <p>{resultado.resumen}</p>
          {creados.map((t) => (
            <DetalleTrabajo key={t.id} trabajo={t} />
          ))}
          {creados.length === 0 && resultado.trabajosCreados.length > 0 && (
            <p>
              Creado: {cuantos(resultado.trabajosCreados.length)}. Míralo en Mi día.
            </p>
          )}
          {actualizados.length > 0 ? (
            actualizados.map((t) => <DetalleTrabajo key={t.id} trabajo={t} />)
          ) : (
            resultado.trabajosActualizados.length > 0 && (
              <p>
                Actualizado: {cuantos(resultado.trabajosActualizados.length)}.
              </p>
            )
          )}
          {resultado.decisionId && (
            <p>
              Decisión <Link href="/decisiones">{resultado.decision?.titulo ?? 'de compra'}</Link>{' '}
              {resultado.decision?.referencia && (
                <>
                  <Referencia valor={resultado.decision.referencia} />{' '}
                </>
              )}
              enviada a quien debe decidir.
            </p>
          )}
          {resultado.avisosA.length > 0 && (
            <p className="tarjeta-captura__meta">Nexo avisó a: {resultado.avisosA.join(', ')}.</p>
          )}
        </Marco>
      );
    }
    case 'pregunta':
      return (
        <Marco titulo="Nexo necesita un dato" resultado={resultado}>
          <p id={`pregunta-captura-${resultado.capturaId}`}>{resultado.pregunta}</p>
          {!soloLectura && (
            <FormularioPregunta
              resultado={resultado}
              opciones={resultado.opciones}
              enviarRespuesta={enviarRespuesta}
              pendiente={pendiente}
            />
          )}
        </Marco>
      );
    case 'duplicado': {
      const existente = trabajos.find((t) => t.id === resultado.trabajoId);
      return (
        <Marco titulo="Ya existe" resultado={resultado}>
          <p>
            Esto ya está registrado como{' '}
            <EnlaceTrabajo trabajo={{ id: resultado.trabajoId, titulo: resultado.titulo, referencia: resultado.referencia ?? '' }} />
            . No se creó nada nuevo.
          </p>
          {existente && <TarjetaTrabajo trabajo={existente} />}
        </Marco>
      );
    }
    case 'ignorada':
      return (
        <Marco titulo="No es trabajo" resultado={resultado}>
          <p>{resultado.motivo}</p>
        </Marco>
      );
    case 'respuesta': {
      const r = resultado.respuesta;
      const sinDato = r.texto.startsWith('No lo sé');
      const lineas = r.texto.split('\n').filter((l) => l.trim() !== '');
      return (
        <Marco titulo={sinDato ? 'No lo sé' : 'Respuesta'} resultado={resultado} sinDato={sinDato}>
          <div className="tarjeta-captura__texto">
            {lineas.map((linea, i) => (
              <p key={i}>{linea}</p>
            ))}
          </div>
          {r.fuentes.length > 0 && (
            <>
              <h3 className="tarjeta-captura__subtitulo">Fuentes</h3>
              <ul className="tarjeta-captura__fuentes">
                {r.fuentes.map((f, i) => (
                  <li key={`${f.trabajoId}-${i}`}>
                    <Link href={`/trabajos/${f.trabajoId}`}>{f.etiqueta}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Marco>
      );
    }
    case 'error':
      return (
        <Marco titulo="No se pudo capturar" resultado={resultado}>
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {resultado.mensaje}
          </p>
        </Marco>
      );
  }
}
