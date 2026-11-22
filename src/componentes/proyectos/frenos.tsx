// «Qué lo frena»: los trabajos bloqueados, atrasados o en riesgo del proyecto, con el porqué y enlaces.
import { Ban, Clock, Link2, Package, TriangleAlert } from 'lucide-react';
import { EnlaceTrabajo } from '@/componentes/enlaces-trabajos';
import { formatearFecha } from '@/dominio/formato';
import type { PasoRecorrido } from '@/servicios/proyectos';
import { sinPunto } from './textos';

function Freno({ paso }: { paso: PasoRecorrido }) {
  const t = paso.trabajo;
  const propio = <EnlaceTrabajo trabajo={{ id: t.id, titulo: t.titulo, referencia: t.referencia }} />;
  if (t.estado === 'bloqueado') {
    const fuera = t.bloqueadoPor ? paso.fuera.find((f) => f.id === t.bloqueadoPor?.id) : undefined;
    return (
      <li data-tono="critico">
        <Ban className="icono" aria-hidden="true" />
        <span>
          {propio} está bloqueado
          {t.bloqueadoPor && (
            <>
              {' '}
              por <EnlaceTrabajo trabajo={t.bloqueadoPor} />
              {fuera && <>, un trabajo de {fuera.proyecto.nombre}</>}
            </>
          )}
          .{paso.motivoBloqueo && <> {sinPunto(paso.motivoBloqueo)}.</>}
          {t.bloquea.length > 0 && <> Detiene {t.bloquea.length === 1 ? 'otro trabajo' : `otros ${t.bloquea.length} trabajos`}.</>}
        </span>
      </li>
    );
  }
  if (t.marcas.atrasado) {
    return (
      <li data-tono="critico">
        <Clock className="icono" aria-hidden="true" />
        <span>
          {propio} está atrasado: su plazo era <time dateTime={t.plazo.toISOString()}>{formatearFecha(t.plazo)}</time>.
        </span>
      </li>
    );
  }
  const repuesto = Object.values(t.causasRepuestos)[0];
  const cadena = t.marcas.causas.find((c) => (c.tipo === 'cadena' || c.tipo === 'bloqueado') && c.trabajoId);
  const ref = cadena?.trabajoId ? t.causasTrabajos[cadena.trabajoId] : undefined;
  const fuera = ref ? paso.fuera.find((f) => f.id === ref.id) : undefined;
  const Icono = repuesto ? Package : ref ? Link2 : TriangleAlert;
  return (
    <li data-tono="aviso">
      <Icono className="icono" aria-hidden="true" />
      <span>
        {propio} está en riesgo
        {repuesto ? (
          <>: falta {repuesto.charAt(0).toLowerCase() + repuesto.slice(1)}.</>
        ) : ref ? (
          <>
            : espera a <EnlaceTrabajo trabajo={ref} />
            {fuera && <>, de {fuera.proyecto.nombre}</>}.
          </>
        ) : (
          '.'
        )}
      </span>
    </li>
  );
}

/** En riesgo solo porque espera, dentro del mismo proyecto, a algo que ya está en riesgo o bloqueado: es consecuencia. */
function esConsecuencia(p: PasoRecorrido): boolean {
  const t = p.trabajo;
  if (t.estado === 'bloqueado' || t.marcas.atrasado || t.marcas.causas.length === 0) return false;
  return t.marcas.causas.every(
    (c) => (c.tipo === 'cadena' || c.tipo === 'bloqueado') && c.trabajoId && !p.fuera.some((f) => f.id === c.trabajoId),
  );
}

export function FrenosProyecto({ frenos: todos }: { frenos: PasoRecorrido[] }) {
  if (todos.length === 0) return null;
  const consecuencias = todos.filter(esConsecuencia);
  const frenos = todos.filter((p) => !esConsecuencia(p));
  return (
    <section className="frenos" aria-labelledby="frenos-titulo">
      <h2 className="frenos__titulo" id="frenos-titulo">
        <TriangleAlert className="icono" aria-hidden="true" />
        Qué lo frena
      </h2>
      <ul className="frenos__lista">
        {frenos.map((p) => (
          <Freno key={p.trabajo.id} paso={p} />
        ))}
        {consecuencias.length > 0 && (
          <li data-tono="aviso">
            <Link2 className="icono" aria-hidden="true" />
            <span>
              {frenos.length > 0 ? 'Por eso, ' : ''}
              {consecuencias.length === 1
                ? `«${consecuencias[0]?.trabajo.titulo}» está en riesgo: espera a lo anterior.`
                : `${consecuencias.length} trabajos que vienen después están en riesgo: esperan a lo anterior.`}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
