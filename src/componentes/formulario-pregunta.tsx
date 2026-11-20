'use client';
// Formulario de /preguntar: caja de pregunta, tres ejemplos con un clic y la respuesta con sus fuentes. Tarea 4.3.
import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { accionPreguntar, type EstadoFormularioPregunta } from '@/app/acciones/preguntar';
import { InsigniaImplementacion } from './insignia-implementacion';

const ESTADO_INICIAL: EstadoFormularioPregunta = { respuesta: null, error: null };

const EJEMPLOS = [
  '¿Cómo vamos con los pedidos de la semana?',
  '¿Qué está atrasado o en riesgo?',
  '¿Cómo van los proyectos?',
];

export function FormularioPregunta() {
  const [estado, enviar, pendiente] = useActionState(accionPreguntar, ESTADO_INICIAL);
  const r = estado.respuesta;

  return (
    <section aria-label="Preguntar a Nexo" className="preguntar">
      <form action={enviar} aria-busy={pendiente}>
        <label htmlFor="pregunta-texto" className="etiqueta-campo">
          Tu pregunta
        </label>
        <div className="preguntar__fila">
          <textarea
            id="pregunta-texto"
            name="texto"
            rows={2}
            maxLength={1000}
            required
            placeholder="Ej.: ¿Cómo vamos con los pedidos de la semana?"
            readOnly={pendiente}
            className="campo"
          />
          <button type="submit" disabled={pendiente} className="boton boton--solido">
            {pendiente ? 'Consultando…' : 'Preguntar'}
          </button>
        </div>

        <fieldset disabled={pendiente} className="ejemplos">
          <legend>Ejemplos (se envían con un clic)</legend>
          <div className="ejemplos__lista">
            {EJEMPLOS.map((e) => (
              <button key={e} type="submit" name="ejemplo" value={e} formNoValidate className="boton boton--quieto">
                {e}
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <div aria-live="polite">
        {estado.error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {estado.error}
          </p>
        )}
        {r && (
          <article aria-label="Respuesta de Nexo" className="respuesta">
            {estado.pregunta && <p className="respuesta__pregunta">Pregunta: {estado.pregunta}</p>}
            <h2>{r.texto.startsWith('No lo sé') ? 'No lo sé' : 'Respuesta'}</h2>
            <div className="respuesta__texto">
              {r.texto.split('\n').map((linea, i) => (
                <p key={i}>{linea}</p>
              ))}
            </div>
            {r.fuentes.length > 0 && (
              <>
                <h3>Fuentes</h3>
                <ul className="fuentes">
                  {r.fuentes.map((f) => (
                    <li key={f.trabajoId}>
                      <Link href={`/trabajos/${f.trabajoId}`}>{f.etiqueta}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="respuesta__ia">
              <InsigniaImplementacion ia={r.ia} />
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
