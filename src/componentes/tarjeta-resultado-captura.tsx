'use client';
// Resultado de una captura, con opciones si Nexo pregunta. Tarea 2.5.
import { CircleAlert, CircleCheck, Copy, Info, MessageCircleQuestion, MessageSquareText, Scale } from 'lucide-react';
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
};

const TEMAS_PREGUNTA: Record<string, string> = {
  pedidos_semana: 'Pedidos de la semana',
  estado_proyectos: 'Estado de los proyectos',
  atrasados: 'Atrasados',
  mis_pendientes: 'Mis pendientes',
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
  children,
}: {
  titulo: string;
  resultado: ResultadoCaptura;
  /** true si lo creado espera la aprobación de una persona (una decisión): se muestra como propuesta, no como hecho. */
  esPropuesta?: boolean;
  children: ReactNode;
}) {
  const Icono = esPropuesta ? Scale : ICONOS[resultado.estado];
  return (
    <article
      className="tarjeta tarjeta-captura"
      data-estado={resultado.estado}
      data-propuesta={esPropuesta || undefined}
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
export function TarjetaResultadoCaptura({ resultado, trabajos = [], enviarRespuesta, pendiente = false }: Props) {
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
          <FormularioPregunta
            resultado={resultado}
            opciones={resultado.opciones}
            enviarRespuesta={enviarRespuesta}
            pendiente={pendiente}
          />
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
      return (
        <Marco titulo="Respuesta" resultado={resultado}>
          <p>{r.texto}</p>
          {r.fuentes.length > 0 && (
            <p>
              Fuentes:{' '}
              {r.fuentes.map((f, i) => (
                <span key={`${f.trabajoId}-${i}`}>
                  {i > 0 && ', '}
                  <Link href={`/trabajos/${f.trabajoId}`}>{f.etiqueta}</Link>
                </span>
              ))}
            </p>
          )}
          <p>
            <Link href="/preguntar">Ver en Preguntar{TEMAS_PREGUNTA[r.tema] ? ` · ${TEMAS_PREGUNTA[r.tema]}` : ''}</Link>
          </p>
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
