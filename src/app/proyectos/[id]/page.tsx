// Trabajos del proyecto con estado, marcas, responsable, plazo y dependencias. Lee obtenerProyecto. Tarea 1.7.
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TarjetaTrabajo } from '@/componentes/tarjeta-trabajo';
import { formatearFecha } from '@/dominio/formato';
import { obtenerProyecto } from '@/servicios/proyectos';
import { obtenerContextoApp } from '@/servidor/contexto-app';

export default async function PaginaProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obtenerContextoApp();
  const proyecto = await obtenerProyecto(ctx, id);
  if (!proyecto) notFound();
  return (
    <>
      <header className="pagina__cabecera">
        <Link href="/proyectos" className="volver">
          <ArrowLeft className="icono" aria-hidden="true" />
          Proyectos
        </Link>
        <h1 className="pagina__titulo">{proyecto.nombre}</h1>
        <p className="pagina__sub">
          Responsable: {proyecto.responsable.nombre}
          {proyecto.fecha && <> · Fecha: {formatearFecha(proyecto.fecha)}</>}
        </p>
        <p className="pagina__sub">
          {proyecto.total} trabajos: {proyecto.abiertos} abiertos, {proyecto.enCurso} en curso,{' '}
          {proyecto.bloqueados} bloqueados, {proyecto.resueltos} resueltos · {proyecto.atrasados} atrasados ·{' '}
          {proyecto.enRiesgo} en riesgo
        </p>
      </header>
      <ul className="lista lista--dos">
        {proyecto.trabajos.map((t) => (
          <li key={t.id}>
            <TarjetaTrabajo trabajo={t} mostrarProyecto={false} />
          </li>
        ))}
      </ul>
    </>
  );
}
