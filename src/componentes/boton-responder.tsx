'use client';
// Botón Responder a un seguimiento pendiente: marca En curso o Resuelto y añade una nota opcional, sin salir de la página.
// Tarea 4.1. Props: `trabajoId` (obligatoria); `titulo` (opcional, solo para el nombre accesible del botón).
// Reformas v2 (R7b, regla 19): `entrega` (opcional) = el responsable de un trabajo que otra persona pidió. Ahí «Resuelto» se
// llama «Entregado» (no lo resuelve: queda entregado y quien lo pidió confirma), la nota es obligatoria y el resultado se
// anuncia en ResultadoPedidos para que siga visible cuando el trabajo cambie de sección.
import { MessageSquareReply } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionResponderSeguimiento } from '@/app/acciones/trabajos';
import { useAnunciar } from '@/componentes/resultado-pedidos';

export function BotonResponder({
  trabajoId,
  titulo,
  entrega,
}: {
  trabajoId: string;
  titulo?: string;
  /** `solicitante`: nombre de quien lo pidió (puede ser null). */
  entrega?: { solicitante: string | null };
}) {
  const anunciar = useAnunciar();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const etiquetaResuelto = entrega ? 'Entregado' : 'Resuelto';

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const estado = datos.get('estado');
    if (!estado) {
      setError(`Elige cómo va el trabajo: En curso o ${etiquetaResuelto}.`);
      return;
    }
    if (estado === 'resuelto' && !String(datos.get('nota') ?? '').trim()) {
      setError(entrega ? 'Escribe qué entregaste o pega el enlace.' : 'Escribe una nota: qué quedó hecho.');
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await accionResponderSeguimiento(datos);
      setError(r.ok ? null : r.error);
      if (!r.ok) return;
      const cita = titulo ? `«${titulo}»` : 'el trabajo';
      anunciar?.(
        estado === 'resuelto'
          ? entrega
            ? `Respondiste sobre ${cita}: quedó entregado. ${entrega.solicitante ? `Falta que ${entrega.solicitante} confirme que lo recibió.` : 'Falta que quien lo pidió confirme que lo recibió.'}`
            : `Respondiste sobre ${cita}: quedó Resuelto.`
          : `Respondiste sobre ${cita}: sigue En curso.`,
      );
    });
  }

  return (
    <details className="responder">
      <summary className="boton" aria-label={titulo ? `Responder sobre «${titulo}»` : 'Responder sobre este trabajo'}>
        <MessageSquareReply className="icono" aria-hidden="true" />
        Responder
      </summary>
      <form onSubmit={alEnviar} aria-busy={pendiente} className="responder__panel">
        <input type="hidden" name="trabajoId" value={trabajoId} />
        <fieldset disabled={pendiente}>
          <legend>{titulo ? `¿Cómo va «${titulo}»?` : '¿Cómo va este trabajo?'}</legend>
          <div className="opciones-radio">
            <label className="opcion-radio">
              <input type="radio" name="estado" value="en_curso" required /> En curso
            </label>
            <label className="opcion-radio">
              <input type="radio" name="estado" value="resuelto" required /> {etiquetaResuelto}
            </label>
          </div>
          <div>
            <label htmlFor={`nota-${trabajoId}`} className="etiqueta-campo">
              {entrega ? 'Nota (obligatoria al entregar: qué entregaste o el enlace)' : 'Nota (opcional; obligatoria al resolver)'}
            </label>
            <textarea id={`nota-${trabajoId}`} name="nota" rows={2} maxLength={1000} className="campo" />
          </div>
          <div className="responder__acciones">
            <button type="submit" className="boton boton--solido">
              {pendiente ? 'Enviando…' : 'Enviar respuesta'}
            </button>
          </div>
        </fieldset>
        <div aria-live="polite">
          {error && (
            <p role="alert" className="alerta">
              {error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
