'use client';
// Caja de captura siempre visible (fija abajo en teléfono, arriba en escritorio). Tarea 2.5.
import { CircleAlert, SendHorizontal } from 'lucide-react';
import { startTransition, useActionState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  accionCapturar,
  accionResponderCaptura,
  type EstadoFormularioCaptura,
} from '@/app/acciones/captura';
import { TarjetaResultadoCaptura } from './tarjeta-resultado-captura';

const ESTADO_INICIAL: EstadoFormularioCaptura = { resultado: null, error: null };

/** Un solo estado: una captura nueva (`texto`) o la respuesta a la pregunta única (`capturaId`). */
async function despachar(prev: EstadoFormularioCaptura, formData: FormData): Promise<EstadoFormularioCaptura> {
  return formData.has('capturaId') ? accionResponderCaptura(prev, formData) : accionCapturar(prev, formData);
}

export function CajaCaptura() {
  const [estado, enviar, pendiente] = useActionState(despachar, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const texto = String(datos.get('texto') ?? '').trim();
    if (!texto || pendiente) return;
    startTransition(() => enviar(datos));
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Shift+Enter inserta salto de línea.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formulario.current?.requestSubmit();
    }
  }

  // La respuesta a la pregunta única va por su propio formulario dentro de la tarjeta.
  function enviarRespuesta(datos: FormData) {
    startTransition(() => enviar(datos));
  }

  // Tras una captura aceptada se limpia la frase; si falló, se conserva para reintentar.
  const aceptada = estado.resultado !== null && estado.error === null && estado.resultado.estado !== 'error';

  return (
    <section className="caja-captura" aria-label="Captura de trabajo">
      <form ref={formulario} onSubmit={alEnviar} aria-busy={pendiente}>
        <label htmlFor="captura-texto">Cuéntale a Nexo qué pasó o qué se necesita</label>
        <div className="caja-captura__fila">
          <textarea
            id="captura-texto"
            name="texto"
            rows={2}
            maxLength={1000}
            required
            placeholder="Ej.: Necesito el compresor para la cámara de La Colina, es urgente"
            onKeyDown={alTeclear}
            key={aceptada ? estado.resultado?.capturaId : 'pendiente'}
            readOnly={pendiente}
          />
          <button type="submit" disabled={pendiente} className="caja-captura__enviar">
            <SendHorizontal className="icono" aria-hidden="true" />
            <span className="caja-captura__enviar-texto">{pendiente ? 'Enviando…' : 'Enviar'}</span>
          </button>
        </div>
        <p className="caja-captura__ayuda">Enter envía · Mayús+Enter agrega una línea</p>
      </form>

      <div aria-live="polite" className="caja-captura__resultado">
        {estado.error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {estado.error}
          </p>
        )}
        {estado.resultado && (
          <TarjetaResultadoCaptura
            resultado={estado.resultado}
            trabajos={estado.trabajos}
            enviarRespuesta={enviarRespuesta}
            pendiente={pendiente}
          />
        )}
      </div>
    </section>
  );
}
