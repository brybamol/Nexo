'use client';
// Reloj de la demo con +5 min, +30 min y Siguiente evento. Tarea 1.7.
import { Clock, RotateCcw, SkipForward } from 'lucide-react';
import { useState, useTransition } from 'react';
import { avanzar, siguienteEvento } from '@/app/acciones/reloj';
import { reiniciar } from '@/app/acciones/demo';

/**
 * Props: `ahoraTexto` (hora de la demo ya formateada, p. ej. «mié 25 nov, 7:05»).
 * Incluye también el botón «Reiniciar demo» (pide confirmación).
 */
export function ControlReloj({ ahoraTexto }: { ahoraTexto: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(tarea: () => Promise<unknown>) {
    setError(null);
    iniciar(async () => {
      try {
        await tarea();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
      }
    });
  }

  return (
    <div className="reloj" role="group" aria-label="Reloj de la demo">
      <span className="reloj__hora">
        <Clock className="icono" aria-hidden="true" />
        Reloj: <strong aria-live="polite">{ahoraTexto}</strong>
      </span>
      <button type="button" disabled={pendiente} onClick={() => ejecutar(() => avanzar(5))}>
        +5 min
      </button>
      <button type="button" disabled={pendiente} onClick={() => ejecutar(() => avanzar(30))}>
        +30 min
      </button>
      <button type="button" disabled={pendiente} onClick={() => ejecutar(() => siguienteEvento())}>
        <SkipForward className="icono" aria-hidden="true" />
        Siguiente evento
      </button>
      <button
        type="button"
        className="reloj__reiniciar"
        disabled={pendiente}
        onClick={() => {
          if (window.confirm('¿Reiniciar la demo? Se borran los cambios y vuelve el estado inicial.')) {
            ejecutar(() => reiniciar());
          }
        }}
      >
        <RotateCcw className="icono" aria-hidden="true" />
        Reiniciar demo
      </button>
      {error && (
        <span role="alert" className="reloj__error">
          {error}
        </span>
      )}
    </div>
  );
}
