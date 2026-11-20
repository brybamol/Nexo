// Bandeja de decisiones: pendientes del decisor actual y el historial. Lee listarDecisiones. Tarea 4.2.
import { TarjetaDecision } from '@/componentes/tarjeta-decision';
import { listarDecisiones } from '@/servicios/decisiones';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';

export default async function PaginaDecisiones() {
  const ctx = await obtenerContextoApp();
  const personaId = await personaActual();
  const todas = await listarDecisiones(ctx);
  // Las suyas: las que le toca decidir (o decidió) y las que ella propuso.
  const mias = todas.filter((d) => d.decisor.id === personaId || d.proponente.id === personaId);
  const pendientes = mias.filter((d) => d.estado === 'pendiente' && d.decisor.id === personaId);
  const resto = mias.filter((d) => !pendientes.includes(d));

  // Hijos planos con claves estables: al decidir, la tarjeta pasa de «por decidir» a «historial»
  // sin remontarse, y conserva el resultado que muestra (trabajos creados, a quién se avisó).
  return (
    <div className="decisiones">
      <header className="pagina__cabecera" key="cabecera">
        <h1 className="pagina__titulo">Decisiones</h1>
        <p className="pagina__sub">Nexo presenta las opciones y sus consecuencias; no elige por ti.</p>
      </header>
      <h2 key="h-pendientes" className="seccion__titulo">
        Por decidir <span className="seccion__cuenta">{pendientes.length}</span>
      </h2>
      {pendientes.length === 0 && (
        <p key="vacio-pendientes" className="vacio">
          No tienes decisiones pendientes.
        </p>
      )}
      {pendientes.map((d) => (
        <TarjetaDecision key={d.id} decision={d} personaActualId={personaId} />
      ))}
      <h2 key="h-historial" className="seccion__titulo decisiones__historial">
        Historial y propuestas <span className="seccion__cuenta">{resto.length}</span>
      </h2>
      {resto.length === 0 && (
        <p key="vacio-historial" className="vacio">
          Aún no hay decisiones en el historial.
        </p>
      )}
      {resto.map((d) => (
        <TarjetaDecision key={d.id} decision={d} personaActualId={personaId} />
      ))}
    </div>
  );
}
