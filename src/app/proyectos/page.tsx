// Las tres cifras y una tarjeta por proyecto. Lee listarProyectos y obtenerCifras. Tarea 1.7.
import Link from 'next/link';
import { CifrasDemo } from '@/componentes/cifras-demo';
import { formatearFecha } from '@/dominio/formato';
import { obtenerCifras } from '@/servicios/cifras';
import { listarProyectos } from '@/servicios/proyectos';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export default async function PaginaProyectos() {
  const ctx = await obtenerContextoApp();
  const [cifras, proyectos] = await Promise.all([obtenerCifras(ctx), listarProyectos(ctx)]);
  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Proyectos</h1>
      </header>
      <section aria-label="Las tres cifras">
        <CifrasDemo cifras={cifras} />
      </section>
      <ul className="lista lista--dos proyectos">
        {proyectos.map((p) => (
          <li key={p.id} className="tarjeta proyecto">
            <h2>
              <Link href={`/proyectos/${p.id}`}>{p.nombre}</Link>
            </h2>
            <p className="proyecto__meta">
              Responsable: {p.responsable.nombre}
              {p.fecha && <> · Fecha: {formatearFecha(p.fecha)}</>}
            </p>
            <dl className="conteos">
              <div>
                <dt>Abiertos</dt>
                <dd>{p.abiertos}</dd>
              </div>
              <div>
                <dt>En curso</dt>
                <dd>{p.enCurso}</dd>
              </div>
              <div data-alerta={p.bloqueados > 0 ? 'bloqueado' : undefined}>
                <dt>Bloqueados</dt>
                <dd>{p.bloqueados}</dd>
              </div>
              <div>
                <dt>Resueltos</dt>
                <dd>{p.resueltos}</dd>
              </div>
              <div data-alerta={p.atrasados > 0 ? 'atrasado' : undefined}>
                <dt>Atrasados</dt>
                <dd>{p.atrasados}</dd>
              </div>
              <div data-alerta={p.enRiesgo > 0 ? 'riesgo' : undefined}>
                <dt>En riesgo</dt>
                <dd>{p.enRiesgo}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
