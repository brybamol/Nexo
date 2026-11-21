// Las tres cifras y la lista de acciones de Nexo. Lee listarAcciones y obtenerCifras. Tarea 4.4.
import {
  BellRing,
  ChevronsUp,
  CircleCheck,
  FilePen,
  FilePlus2,
  Megaphone,
  MessageSquareText,
  PackageCheck,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { CifrasDemo } from '@/componentes/cifras-demo';
import { formatearFecha } from '@/dominio/formato';
import type { TipoAccion } from '@/dominio/tipos';
import { obtenerCifras } from '@/servicios/cifras';
import { listarAcciones } from '@/servicios/registro';
import { obtenerContextoApp } from '@/servidor/contexto-app';

const ETIQUETAS: Record<TipoAccion, string> = {
  crear_trabajo: 'Crear trabajo',
  actualizar_trabajo: 'Actualizar trabajo',
  pedir_estado: 'Pedir estado',
  recordatorio: 'Recordatorio',
  escalamiento: 'Escalamiento',
  aviso: 'Aviso',
  crear_decision: 'Crear decisión',
  aplicar_decision: 'Aplicar decisión',
  responder_pregunta: 'Responder pregunta',
  corregir_existencia: 'Corregir existencia',
};

// Icono de cada tipo: el color de la insignia distingue lo que Nexo propone, lo ejecutado y lo que escala.
const ICONOS: Record<TipoAccion, LucideIcon> = {
  crear_trabajo: FilePlus2,
  actualizar_trabajo: FilePen,
  pedir_estado: BellRing,
  recordatorio: BellRing,
  escalamiento: ChevronsUp,
  aviso: Megaphone,
  crear_decision: Scale,
  aplicar_decision: CircleCheck,
  responder_pregunta: MessageSquareText,
  corregir_existencia: PackageCheck,
};

function IconoTipo({ tipo }: { tipo: TipoAccion }) {
  const Icono = ICONOS[tipo];
  return <Icono className="icono" aria-hidden="true" />;
}

export default async function PaginaRegistro() {
  const ctx = await obtenerContextoApp();
  const [cifras, acciones] = await Promise.all([obtenerCifras(ctx), listarAcciones(ctx)]);
  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Registro</h1>
      </header>
      <section aria-labelledby="titulo-cifras" className="seccion">
        <h2 id="titulo-cifras" className="seccion__titulo">
          Las tres cifras
        </h2>
        <CifrasDemo cifras={cifras} />
      </section>
      <section aria-labelledby="titulo-acciones" className="seccion">
        <h2 id="titulo-acciones" className="seccion__titulo">
          Acciones de Nexo <span className="seccion__cuenta">{acciones.length}</span>
        </h2>
        {acciones.length === 0 ? (
          <p className="vacio">Nexo todavía no ha hecho acciones.</p>
        ) : (
          <div className="tabla-envoltura" role="region" aria-labelledby="titulo-acciones" tabIndex={0}>
          <table className="tabla">
            <caption>Acciones de Nexo, la más reciente primero</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Tipo</th>
                <th scope="col">A quién</th>
                <th scope="col">Sobre qué trabajo</th>
                <th scope="col">Motivo</th>
                <th scope="col">Hecho de origen</th>
              </tr>
            </thead>
            <tbody>
              {acciones.map((a) => (
                <tr key={a.id}>
                  <td className="tabla__hora">
                    <time dateTime={a.en.toISOString()}>{formatearFecha(a.en)}</time>
                  </td>
                  <td>
                    <span className="insignia tipo-accion" data-tipo={a.tipo}>
                      <IconoTipo tipo={a.tipo} />
                      {ETIQUETAS[a.tipo]}
                    </span>
                  </td>
                  <td>{a.destinatario ? `${a.destinatario.nombre} (${a.destinatario.rol})` : '—'}</td>
                  <td className="tabla__trabajos">
                    {a.trabajoIds.length === 0
                      ? '—'
                      : a.trabajoIds.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ', '}
                            <Link href={`/trabajos/${id}`}>{id}</Link>
                          </span>
                        ))}
                  </td>
                  <td>{a.motivo}</td>
                  <td>{a.hechoOrigen}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </>
  );
}
