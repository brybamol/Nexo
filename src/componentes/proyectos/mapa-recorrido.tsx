// Mapa del recorrido: una columna por etapa, un punto por trabajo; lo que va a la vez se apila en la misma columna.
// Es un resumen visual: el texto que lo acompaña (avance, etapa actual) dice lo mismo en palabras, por eso va oculto
// a los lectores de pantalla. Componente de servidor.
import { Ban, Check, Clock, TriangleAlert } from 'lucide-react';
import type { EtapaRecorrido, PasoRecorrido } from '@/servicios/proyectos';

type Punto = 'hecho' | 'bloqueado' | 'atrasado' | 'riesgo' | 'actual' | 'pendiente';

function punto(p: PasoRecorrido, etapa: EtapaRecorrido): Punto {
  const t = p.trabajo;
  if (t.estado === 'resuelto') return 'hecho';
  if (t.estado === 'bloqueado') return 'bloqueado';
  if (t.marcas.atrasado || etapa.estado === 'rezagada') return 'atrasado';
  if (t.marcas.enRiesgo) return 'riesgo';
  if (etapa.estado === 'actual') return 'actual';
  return 'pendiente';
}

/** Rótulo corto sobre cada columna del mapa grande: «Etapa 2», «Hoy», «jue 26». */
function rotulo(e: EtapaRecorrido, i: number): string {
  if (e.ciclo) return 'En círculo';
  if (!e.dia) return `Etapa ${i + 1}`;
  const [primero, resto] = e.etiqueta.split(', ');
  return resto ? (primero ?? e.etiqueta) : e.etiqueta.replace(/ \w+$/u, '');
}

const ICONO = { hecho: Check, bloqueado: Ban, atrasado: Clock, riesgo: TriangleAlert, actual: null, pendiente: null } as const;

export function MapaRecorrido({
  etapas,
  tamano = 'normal',
  maxApilados = 4,
}: {
  etapas: EtapaRecorrido[];
  tamano?: 'normal' | 'grande';
  maxApilados?: number;
}) {
  if (etapas.length === 0) return <div className="mapa mapa--vacio" data-tamano={tamano} aria-hidden="true" />;
  return (
    <ol className="mapa" data-tamano={tamano} aria-hidden="true">
      {etapas.map((e, i) => {
        const visibles = e.pasos.slice(0, maxApilados);
        const resto = e.pasos.length - visibles.length;
        return (
          <li key={i} className="mapa__etapa" data-estado={e.estado} data-paralelo={e.pasos.length > 1 || undefined}>
            {tamano === 'grande' && <span className="mapa__rotulo">{rotulo(e, i)}</span>}
            {visibles.map((p) => {
              const tipo = punto(p, e);
              const Icono = ICONO[tipo];
              return (
                <span key={p.trabajo.id} className="mapa__punto" data-punto={tipo} title={`${p.trabajo.titulo} (${p.trabajo.referencia})`}>
                  {Icono && <Icono className="icono" strokeWidth={3} />}
                </span>
              );
            })}
            {resto > 0 && <span className="mapa__mas">+{resto}</span>}
          </li>
        );
      })}
    </ol>
  );
}
