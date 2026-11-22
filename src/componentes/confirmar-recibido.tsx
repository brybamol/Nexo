'use client';
// Quien pidió un trabajo ya entregado: «Sí, lo recibí» (queda Resuelto) o «No está bien» (motivo obligatorio, con una
// confirmación ligera). Docs/08 regla 20. Props: `trabajoId`, `cita` («Título» (REF)), `entregadoPor` (nombre de quien entregó).
import { Check, CircleAlert, Undo2 } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionConfirmarRecepcion, accionRechazarEntrega } from '@/app/acciones/propuestas';
import { useAnunciar } from '@/componentes/resultado-pedidos';
import '@/app/mi-dia/reformas.css';

export function ConfirmarRecibido({ trabajoId, cita, entregadoPor }: { trabajoId: string; cita: string; entregadoPor: string }) {
  const anunciar = useAnunciar();
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const base = `recibido-${trabajoId}`;

  function confirmar() {
    const datos = new FormData();
    datos.set('trabajoId', trabajoId);
    setError(null);
    iniciar(async () => {
      const r = await accionConfirmarRecepcion(datos);
      if (!r.ok) return setError(r.error);
      anunciar?.(`Confirmaste que recibiste ${cita}: quedó Resuelto y se le avisó a ${entregadoPor}.`);
    });
  }

  function rechazar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.set('trabajoId', trabajoId);
    if (!String(datos.get('motivo') ?? '').trim()) return setError('Escribe por qué no está bien.');
    setError(null);
    iniciar(async () => {
      const r = await accionRechazarEntrega(datos);
      if (!r.ok) return setError(r.error);
      setRechazando(false);
      anunciar?.(`Rechazaste la entrega de ${cita}: sigue sin resolver y se le avisó a ${entregadoPor} con tu motivo.`);
    });
  }

  return (
    <div className="acciones-prop" role="group" aria-label={`¿Recibiste ${cita}?`}>
      <div className="acciones-prop__botones">
        <button type="button" className="boton boton--solido" disabled={pendiente} onClick={confirmar}>
          <Check className="icono" aria-hidden="true" />
          {pendiente && !rechazando ? 'Confirmando…' : 'Sí, lo recibí'}
        </button>
        <button
          type="button"
          className="boton"
          aria-expanded={rechazando}
          aria-controls={`${base}-panel`}
          disabled={pendiente}
          onClick={() => {
            setRechazando((r) => !r);
            setError(null);
          }}
        >
          <Undo2 className="icono" aria-hidden="true" />
          No está bien
        </button>
      </div>
      {rechazando && (
        <form id={`${base}-panel`} onSubmit={rechazar} aria-busy={pendiente} className="panel-prop">
          <fieldset disabled={pendiente}>
            <legend>¿Rechazar la entrega?</legend>
            <p className="panel-prop__aviso">
              Se le avisa a {entregadoPor} y el trabajo sigue sin resolver con su plazo.
            </p>
            <label htmlFor={`${base}-motivo`} className="etiqueta-campo">
              Motivo (obligatorio)
            </label>
            <textarea id={`${base}-motivo`} name="motivo" rows={2} maxLength={1000} required className="campo" autoFocus />
            <div className="panel-prop__acciones">
              <button type="submit" className="boton boton--peligro boton--solido">
                {pendiente ? 'Enviando…' : 'Sí, rechazar'}
              </button>
              <button type="button" className="boton boton--quieto" onClick={() => setRechazando(false)}>
                Volver
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div aria-live="polite">
        {error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
