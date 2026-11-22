// Línea del recorrido de un proyecto: una fila por etapa (o por día), de arriba abajo; lo que va a la vez, lado a lado.
// La forma cuenta el flujo: un riel con un nodo por etapa (hecho, ahora, después) y las tarjetas a su derecha.
import { Ban, Check, CircleDot, Clock, Split, TriangleAlert } from 'lucide-react';
import type { EtapaRecorrido, ProyectoRecorrido } from '@/servicios/proyectos';
import { PasoHecho, PasoRecorridoTarjeta } from './paso-recorrido';
import { ETIQUETA_ETAPA, plural } from './textos';

function IconoNodo({ etapa }: { etapa: EtapaRecorrido }) {
  if (etapa.estado === 'hecha') return <Check className="icono" strokeWidth={3} aria-hidden="true" />;
  if (etapa.pasos.some((p) => p.trabajo.estado === 'bloqueado')) return <Ban className="icono" strokeWidth={2.5} aria-hidden="true" />;
  if (etapa.estado === 'rezagada') return <Clock className="icono" strokeWidth={2.5} aria-hidden="true" />;
  if (etapa.estado === 'actual') return <CircleDot className="icono" strokeWidth={2.5} aria-hidden="true" />;
  return null;
}

export function LineaRecorrido({ recorrido }: { recorrido: ProyectoRecorrido }) {
  const { etapas, ahora, modo } = recorrido;
  return (
    <ol className="linea" data-modo={modo}>
      {etapas.map((e, i) => {
        const bloqueada = e.estado !== 'hecha' && e.pasos.some((p) => p.trabajo.estado === 'bloqueado');
        const hechos = e.pasos.filter((p) => p.trabajo.estado === 'resuelto');
        const abiertos = e.pasos.filter((p) => p.trabajo.estado !== 'resuelto');
        return (
          <li
            key={i}
            className="linea__etapa"
            data-estado={e.estado}
            data-bloqueada={bloqueada || undefined}
            data-ultima={i === etapas.length - 1 || undefined}
            aria-current={e.estado === 'actual' ? 'step' : undefined}
          >
            <span className="linea__nodo" aria-hidden="true">
              <IconoNodo etapa={e} />
            </span>
            <div className="linea__cuerpo">
              <h3 className="linea__titulo">
                <span>{e.etiqueta}</span>
                <span className="linea__estado" data-estado={bloqueada ? 'bloqueada' : e.estado}>
                  {bloqueada && e.estado !== 'actual' ? 'Bloqueado' : ETIQUETA_ETAPA[e.estado]}
                </span>
                {e.pasos.length > 1 && (
                  <span className="linea__paralelo">
                    <Split className="icono" aria-hidden="true" />
                    {modo === 'dias' ? plural(e.pasos.length, 'trabajo', 'trabajos') : `${e.pasos.length} a la vez`}
                  </span>
                )}
              </h3>
              {e.ciclo && (
                <p className="linea__aviso">
                  <TriangleAlert className="icono" aria-hidden="true" />
                  Estos trabajos se esperan entre sí. Revisen sus dependencias para saber cuál va primero.
                </p>
              )}
              {e.estado === 'hecha' ? (
                <ul className="linea__hechos">
                  {e.pasos.map((p) => (
                    <li key={p.trabajo.id}>
                      <PasoHecho paso={p} />
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  {abiertos.length > 0 && (
                    <ul className="linea__pasos" data-cuantos={Math.min(abiertos.length, 3)}>
                      {abiertos.map((p) => (
                        <li key={p.trabajo.id}>
                          <PasoRecorridoTarjeta paso={p} ahora={ahora} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {hechos.length > 0 && (
                    <ul className="linea__hechos linea__hechos--junto">
                      {hechos.map((p) => (
                        <li key={p.trabajo.id}>
                          <PasoHecho paso={p} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
