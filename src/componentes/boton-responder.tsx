'use client';
// Botón Responder a un seguimiento pendiente: marca En curso o Resuelto y añade una nota opcional, sin salir de la página.
// Tarea 4.1. Props: `trabajoId` (obligatoria); `titulo` (opcional, solo para el nombre accesible del botón).
import { MessageSquareReply } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionResponderSeguimiento } from '@/app/acciones/trabajos';

export function BotonResponder({ trabajoId, titulo }: { trabajoId: string; titulo?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await accionResponderSeguimiento(datos);
      setError(r.ok ? null : r.error);
    });
  }

  return (
    <details className="responder">
      <summary className="boton" aria-label={`Responder sobre ${trabajoId}${titulo ? `: ${titulo}` : ''}`}>
        <MessageSquareReply className="icono" aria-hidden="true" />
        Responder
      </summary>
      <form onSubmit={alEnviar} aria-busy={pendiente} className="responder__panel">
        <input type="hidden" name="trabajoId" value={trabajoId} />
        <fieldset disabled={pendiente}>
          <legend>¿Cómo va {trabajoId}?</legend>
          <div className="opciones-radio">
            <label className="opcion-radio">
              <input type="radio" name="estado" value="en_curso" defaultChecked /> En curso
            </label>
            <label className="opcion-radio">
              <input type="radio" name="estado" value="resuelto" /> Resuelto
            </label>
          </div>
          <div>
            <label htmlFor={`nota-${trabajoId}`} className="etiqueta-campo">
              Nota (opcional)
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
