'use client';
// Caja de captura siempre visible (fija abajo en teléfono, arriba en escritorio). Tarea 2.5.
import { CircleAlert, SendHorizontal, X } from 'lucide-react';
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  accionCapturar,
  accionResponderCaptura,
  type EstadoFormularioCaptura,
} from '@/app/acciones/captura';
import { IsotipoNexo } from './marca/logo-nexo';
import { TarjetaResultadoCaptura } from './tarjeta-resultado-captura';

const ESTADO_INICIAL: EstadoFormularioCaptura = { resultado: null, error: null };

/** Un solo estado: una captura nueva (`texto`) o la respuesta a la pregunta única (`capturaId`). */
async function despachar(prev: EstadoFormularioCaptura, formData: FormData): Promise<EstadoFormularioCaptura> {
  return formData.has('capturaId') ? accionResponderCaptura(prev, formData) : accionCapturar(prev, formData);
}

export function CajaCaptura() {
  const [estado, enviar, pendiente] = useActionState(despachar, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  // Guarda síncrona: `pendiente` es un valor viejo hasta el siguiente render, y dos Enter seguidos lo atraviesan.
  const enviando = useRef(false);
  // Estado que el usuario cerró: cualquier estado nuevo (otra captura) vuelve a mostrar la tarjeta.
  const [cerrado, setCerrado] = useState<EstadoFormularioCaptura | null>(null);

  useEffect(() => {
    if (!pendiente) enviando.current = false;
  }, [pendiente]);

  function lanzar(datos: FormData) {
    if (enviando.current) return;
    enviando.current = true;
    startTransition(() => enviar(datos));
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const texto = String(datos.get('texto') ?? '').trim();
    if (!texto) return;
    lanzar(datos);
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
    lanzar(datos);
  }

  // Tras una captura aceptada se limpia la frase; si falló, se conserva para reintentar.
  const aceptada = estado.resultado !== null && estado.error === null && estado.resultado.estado !== 'error';

  return (
    <section className="caja-captura" aria-label="Captura de trabajo">
      <form ref={formulario} onSubmit={alEnviar} aria-busy={pendiente}>
        <label htmlFor="captura-texto">
          <IsotipoNexo tamano={20} className="caja-captura__isotipo" />
          <span>Cuéntale a Nexo qué pasó o qué se necesita</span>
        </label>
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
        {estado.resultado && estado !== cerrado && (
          <div className="caja-captura__tarjeta">
            <button
              type="button"
              className="caja-captura__cerrar"
              disabled={pendiente}
              aria-label="Cerrar el resultado de la captura"
              onClick={() => setCerrado(estado)}
            >
              <X className="icono" aria-hidden="true" />
              <span>Cerrar</span>
            </button>
            <TarjetaResultadoCaptura
              resultado={estado.resultado}
              trabajos={estado.trabajos}
              enviarRespuesta={enviarRespuesta}
              pendiente={pendiente}
            />
          </div>
        )}
      </div>
    </section>
  );
}
