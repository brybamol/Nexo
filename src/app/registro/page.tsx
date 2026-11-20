// Las tres cifras y la lista de acciones de Nexo. Lee listarAcciones y obtenerCifras. Tarea 4.4.
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

export default async function PaginaRegistro() {
  const ctx = await obtenerContextoApp();
  const [cifras, acciones] = await Promise.all([obtenerCifras(ctx), listarAcciones(ctx)]);
  return (
    <>
      <h1>Registro</h1>
      <section aria-labelledby="titulo-cifras">
        <h2 id="titulo-cifras">Las tres cifras</h2>
        <CifrasDemo cifras={cifras} />
      </section>
      <section aria-labelledby="titulo-acciones">
        <h2 id="titulo-acciones">Acciones de Nexo</h2>
        {acciones.length === 0 ? (
          <p>Nexo todavía no ha hecho acciones.</p>
        ) : (
          <table>
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
                  <td>
                    <time dateTime={a.en.toISOString()}>{formatearFecha(a.en)}</time>
                  </td>
                  <td>{ETIQUETAS[a.tipo]}</td>
                  <td>{a.destinatario ? `${a.destinatario.nombre} (${a.destinatario.rol})` : '—'}</td>
                  <td>
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
        )}
      </section>
    </>
  );
}
