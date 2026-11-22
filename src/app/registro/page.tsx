// Las tres cifras y la lista de acciones de Nexo. Lee listarAcciones y obtenerCifras. Tarea 4.4.
// La tabla se ve por lotes (10, 20 o 50 acciones) con `?por=` y `?pagina=` en la dirección.
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
import { CifrasDemo } from '@/componentes/cifras-demo';
import { EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import { Paginacion } from '@/componentes/paginacion';
import { TasaCorreccion } from '@/componentes/tasa-correccion';
import { formatearFecha } from '@/dominio/formato';
import { paginar } from '@/dominio/paginacion';
import type { TipoAccion } from '@/dominio/tipos';
import { obtenerCifras } from '@/servicios/cifras';
import { listarAcciones } from '@/servicios/registro';
import { obtenerTasaCorreccion } from '@/servicios/tasa';
import { listarTrabajos } from '@/servicios/consultas-trabajos';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import '@/app/mi-dia/reformas.css';

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
  // Reformas v2 (docs/08 §6). R7b puede afinar iconos y textos.
  leer_correo: 'Lectura de correo',
  proponer_trabajo: 'Propuesta',
  reconocer_correo: 'Reconocido en el correo',
  revisar_propuesta: 'Revisión',
  registrar_entrega: 'Entrega',
  confirmar_recepcion: 'Recibido',
  rechazar_entrega: 'Entrega rechazada',
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
  leer_correo: MessageSquareText,
  proponer_trabajo: FilePlus2,
  reconocer_correo: FilePen,
  revisar_propuesta: CircleCheck,
  registrar_entrega: PackageCheck,
  confirmar_recepcion: CircleCheck,
  rechazar_entrega: FilePen,
};

function IconoTipo({ tipo }: { tipo: TipoAccion }) {
  const Icono = ICONOS[tipo];
  return <Icono className="icono" aria-hidden="true" />;
}

// El tipo va escrito a mano: el `PageProps` global lo genera Next al compilar y no existe en un `typecheck` limpio (CI).
type Props = { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> };

export default async function PaginaRegistro({ searchParams }: Props) {
  const ctx = await obtenerContextoApp();
  const consulta = await searchParams;
  const [cifras, acciones, tasa, trabajos] = await Promise.all([
    obtenerCifras(ctx),
    listarAcciones(ctx),
    obtenerTasaCorreccion(ctx),
    listarTrabajos(ctx),
  ]);
  // Las cifras cuentan solo Resueltos (regla 21): lo entregado y sin confirmar se cuenta aparte.
  const entregados = trabajos.filter((t) => t.entrega !== null && t.estado !== 'resuelto').length;
  const pagina = paginar(acciones.length, consulta.por, consulta.pagina);
  const visibles = acciones.slice(pagina.desde, pagina.hasta);
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
        <div className="registro-tasa">
          <TasaCorreccion tasa={tasa} compacta />
          <p className="registro-entregados">
            Entregados por confirmar: <strong>{entregados}</strong>. Aún no cuentan como resueltos en las cifras.
          </p>
        </div>
      </section>
      <section aria-labelledby="titulo-acciones" className="seccion">
        <h2 id="titulo-acciones" className="seccion__titulo">
          Acciones de Nexo <span className="seccion__cuenta">{acciones.length}</span>
        </h2>
        {acciones.length === 0 ? (
          <p className="vacio">Nexo todavía no ha hecho acciones.</p>
        ) : (
          <>
            <Paginacion pagina={pagina} ruta="/registro" etiqueta="Páginas de acciones, arriba de la tabla" que="acciones" />
            <div className="tabla-envoltura" role="region" aria-labelledby="titulo-acciones" tabIndex={0}>
              <table className="tabla tabla--registro">
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
                  {visibles.map((a) => (
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
                      {/* Cada celda de texto tiene alto máximo: lo que no cabe se desplaza dentro de la celda. */}
                      <td>
                        <div className="tabla__celda">{a.destinatario ? `${a.destinatario.nombre} (${a.destinatario.rol})` : '—'}</div>
                      </td>
                      <td className="tabla__trabajos">
                        <div className="tabla__celda">{a.trabajos.length === 0 ? '—' : <EnlacesTrabajos trabajos={a.trabajos} />}</div>
                      </td>
                      <td>
                        <div className="tabla__celda">{a.motivo}</div>
                      </td>
                      <td>
                        <div className="tabla__celda">{a.hechoOrigen}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} ruta="/registro" etiqueta="Páginas de acciones, abajo de la tabla" que="acciones" />
          </>
        )}
      </section>
    </>
  );
}
