// Trabajos del proyecto con estado, marcas, responsable, plazo y dependencias. Lee obtenerProyecto. Tarea 1.7.
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
      <p>
        <Link href="/proyectos">← Proyectos</Link>
      </p>
      <h1>{proyecto.nombre}</h1>
      <p>
        Responsable: {proyecto.responsable.nombre}
        {proyecto.fecha && <> · Fecha: {formatearFecha(proyecto.fecha)}</>}
      </p>
      <p>
        {proyecto.total} trabajos: {proyecto.abiertos} abiertos, {proyecto.enCurso} en curso,{' '}
        {proyecto.bloqueados} bloqueados, {proyecto.resueltos} resueltos · {proyecto.atrasados} atrasados ·{' '}
        {proyecto.enRiesgo} en riesgo
      </p>
      <ul className="cuadricula">
        {proyecto.trabajos.map((t) => (
          <li key={t.id}>
            <TarjetaTrabajo trabajo={t} mostrarProyecto={false} />
          </li>
        ))}
      </ul>
    </>
  );
}
