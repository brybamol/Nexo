// Bandeja de decisiones: las que le toca decidir a quien mira, las que esperan a otra persona y el historial.
// Cada persona ve solo las decisiones que le tocan (docs/08 §10.7): lo resuelve `listarDecisiones` con `visiblePara`.
import type { ReactNode } from 'react';
import { TarjetaDecision } from '@/componentes/tarjeta-decision';
import { listarDecisiones } from '@/servicios/decisiones';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

export default async function PaginaDecisiones() {
  const ctx = await obtenerContextoApp();
  const personaId = await personaActual();
  const visibles = await listarDecisiones(ctx, { visiblePara: personaId });
  const mias = visibles.filter((d) => d.estado === 'pendiente' && d.decisor.id === personaId);
  const deOtros = visibles.filter((d) => d.estado === 'pendiente' && d.decisor.id !== personaId);
  const historial = visibles.filter((d) => d.estado !== 'pendiente');

  // Un único array con claves estables: al decidir, la tarjeta pasa de «por decidir» a «historial»
  // y React la mueve en vez de volver a montarla, así conserva el resultado que muestra
  // (trabajos creados, a quién se avisó). Dos arrays hermanos no concilian claves entre sí.
  const hijos: ReactNode[] = [
    <header className="pagina__cabecera" key="cabecera">
      <h1 className="pagina__titulo">Decisiones</h1>
      <p className="pagina__sub">
        Nexo presenta las opciones y sus consecuencias; no elige por ti. Aquí están las decisiones que te tocan: las que decides,
        las que propusiste y las que mueven tu trabajo o tu proyecto.
      </p>
    </header>,
    <h2 key="h-pendientes" className="seccion__titulo">
      Por decidir <span className="seccion__cuenta">{mias.length}</span>
    </h2>,
  ];
  if (mias.length === 0) {
    hijos.push(
      <p key="vacio-pendientes" className="vacio">
        No tienes decisiones pendientes.
      </p>,
    );
  }
  for (const d of mias) hijos.push(<TarjetaDecision key={d.id} decision={d} personaActualId={personaId} />);

  // Solo aparece si hay alguna: la mayoría de las personas no espera la decisión de nadie.
  if (deOtros.length > 0) {
    hijos.push(
      <h2 key="h-otros" className="seccion__titulo decisiones__historial">
        Esperan a otra persona <span className="seccion__cuenta">{deOtros.length}</span>
      </h2>,
    );
    for (const d of deOtros) hijos.push(<TarjetaDecision key={d.id} decision={d} personaActualId={personaId} />);
  }

  hijos.push(
    <h2 key="h-historial" className="seccion__titulo decisiones__historial">
      Historial <span className="seccion__cuenta">{historial.length}</span>
    </h2>,
  );
  if (historial.length === 0) {
    hijos.push(
      <p key="vacio-historial" className="vacio">
        Aún no hay decisiones tomadas que te toquen.
      </p>,
    );
  }
  for (const d of historial) hijos.push(<TarjetaDecision key={d.id} decision={d} personaActualId={personaId} />);

  return <div className="decisiones">{hijos}</div>;
}
