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
      <h1>Proyectos</h1>
      <section aria-label="Las tres cifras">
        <CifrasDemo cifras={cifras} />
      </section>
      <ul className="cuadricula">
        {proyectos.map((p) => (
          <li key={p.id} className="tarjeta">
            <h2>
              <Link href={`/proyectos/${p.id}`}>{p.nombre}</Link>
            </h2>
            <p>
              Responsable: {p.responsable.nombre}
              {p.fecha && <> · Fecha: {formatearFecha(p.fecha)}</>}
            </p>
            <dl>
              <dt>Abiertos</dt>
              <dd>{p.abiertos}</dd>
              <dt>En curso</dt>
              <dd>{p.enCurso}</dd>
              <dt>Bloqueados</dt>
              <dd>{p.bloqueados}</dd>
              <dt>Resueltos</dt>
              <dd>{p.resueltos}</dd>
              <dt>Atrasados</dt>
              <dd>{p.atrasados}</dd>
              <dt>En riesgo</dt>
              <dd>{p.enRiesgo}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
