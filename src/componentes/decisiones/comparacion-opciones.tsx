// Comparación de las opciones de una decisión: una tabla con una columna por opción y una fila por dato
// (costo, llegada, efecto en cada proyecto, detalle por trabajo), para leer A, B y C en la misma línea.
// Los botones «Aprobar opción X» van al pie, en la misma fila. Lo usa TarjetaDecision (componente de cliente).
import { ArrowRight, CalendarCheck, CalendarClock, Check, ChevronDown } from 'lucide-react';
import { EnlaceTrabajo } from '@/componentes/enlaces-trabajos';
import { formatearColones, formatearFecha } from '@/dominio/formato';
import type { LetraOpcion } from '@/dominio/tipos';
import type { DecisionVista, OpcionVista } from '@/servicios/vistas';
import { efectosPorProyecto, nombreOpcion, plural, textoProveedor, type Efecto } from './presentacion';

interface Props {
  decision: DecisionVista;
  /** Muestra los botones de aprobar (solo el decisor, con la decisión pendiente). */
  puedeDecidir: boolean;
  ocupado: boolean;
  /** Opción que se está confirmando: su columna se tiñe de azul. */
  confirmando: LetraOpcion | null;
  onAprobar: (letra: LetraOpcion) => void;
}

const trabajoDe = (d: DecisionVista, id: string) => d.trabajos[id] ?? { id, titulo: 'otro trabajo', referencia: '' };

export function ComparacionOpciones({ decision, puedeDecidir, ocupado, confirmando, onAprobar }: Props) {
  const { opciones } = decision;
  const efectos = efectosPorProyecto(opciones);
  const columnas = opciones.length + 1;

  /** Atributos de cada celda de una opción: marcan la columna elegida y la que se está confirmando. */
  const col = (o: OpcionVista) => ({
    'data-letra': o.letra,
    'data-elegida': decision.opcionElegida === o.letra || undefined,
    'data-confirmando': confirmando === o.letra || undefined,
  });

  return (
    <div className="dec__comparar">
      <table className="dec__tabla">
        <caption className="sr-only">
          Opciones de la decisión {decision.titulo}: costo, llegada y efecto en las fechas de cada proyecto
        </caption>
        <thead>
          <tr>
            <td className="dec__esquina" />
            {opciones.map((o) => {
              const elegida = decision.opcionElegida === o.letra;
              const propuesta = decision.opcionPropuesta === o.letra;
              return (
                <th key={o.letra} scope="col" className="dec__opcion" {...col(o)}>
                  <span className="dec__opcion-nombre">
                    <span className="dec__letra" aria-hidden="true">
                      {o.letra}
                    </span>
                    <span>
                      <span className="dec__opcion-titulo">Opción {o.letra}</span>
                      {nombreOpcion(o) && <span className="dec__opcion-sub">{nombreOpcion(o)}</span>}
                    </span>
                  </span>
                  {(propuesta || elegida) && (
                    <span className="dec__marcas">
                      {elegida && (
                        <span className="dec__sello">
                          <Check className="icono" aria-hidden="true" />
                          Elegida
                        </span>
                      )}
                      {propuesta && <span className="dec__propuesta">Propuesta por {decision.proponente.nombre}</span>}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          <tr>
            <th scope="row">Costo</th>
            {opciones.map((o) => (
              <td key={o.letra} {...col(o)}>
                <span className="dec__costo">{o.costoTexto}</span>
                {o.lineas.length > 0 && (
                  <span className="dec__desglose">
                    {o.lineas
                      .map((l) =>
                        o.lineas.length === 1
                          ? `${l.cantidad} × ${formatearColones(l.precioUnitario)}`
                          : `${l.cantidad} ${l.proveedor} × ${formatearColones(l.precioUnitario)}`,
                      )
                      .join(' + ')}
                  </span>
                )}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Llega</th>
            {opciones.map((o) => (
              <td key={o.letra} {...col(o)}>
                {o.lineas.length === 0 ? (
                  'No lo sé'
                ) : o.lineas.length === 1 ? (
                  <time className="dec__fecha" dateTime={o.lineas[0]!.llegada.toISOString()}>
                    {formatearFecha(o.lineas[0]!.llegada)}
                  </time>
                ) : (
                  <ul className="dec__llegadas">
                    {o.lineas.map((l, i) => (
                      <li key={i}>
                        <span className="dec__llegada-cuanto">
                          {l.cantidad} del {textoProveedor(l.proveedor)}
                        </span>
                        <time className="dec__fecha" dateTime={l.llegada.toISOString()}>
                          {formatearFecha(l.llegada)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            ))}
          </tr>
        </tbody>

        <tbody>
          <tr className="dec__grupo">
            <th scope="colgroup" colSpan={columnas}>
              Efecto en las fechas
            </th>
          </tr>
          {efectos ? (
            efectos.proyectos.map((p) => (
              <tr key={p}>
                <th scope="row" className="dec__fila-proyecto">
                  {p}
                </th>
                {opciones.map((o) => (
                  <td key={o.letra} {...col(o)}>
                    <EfectoProyecto efecto={efectos.porOpcion[o.letra]?.[p] ?? { tipo: 'sin_cambios' }} />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <th scope="row">Consecuencia</th>
              {opciones.map((o) => (
                <td key={o.letra} {...col(o)} className="dec__consecuencia">
                  {o.consecuencia}
                </td>
              ))}
            </tr>
          )}
          <tr>
            <th scope="row">Trabajo por trabajo</th>
            {opciones.map((o) => (
              <td key={o.letra} {...col(o)}>
                <DetalleOpcion decision={decision} opcion={o} />
              </td>
            ))}
          </tr>
        </tbody>

        {puedeDecidir && (
          <tfoot>
            <tr>
              <th scope="row">
                <span className="sr-only">Decidir</span>
              </th>
              {opciones.map((o) => (
                <td key={o.letra} {...col(o)}>
                  <button
                    type="button"
                    className="boton dec__aprobar"
                    disabled={ocupado}
                    aria-label={`Aprobar opción ${o.letra} de la decisión ${decision.titulo}`}
                    onClick={() => onAprobar(o.letra)}
                  >
                    Aprobar opción {o.letra}
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function EfectoProyecto({ efecto }: { efecto: Efecto }) {
  if (efecto.tipo === 'atrasa') {
    return (
      <span className="dec__efecto" data-efecto="atrasa">
        <CalendarClock className="icono" aria-hidden="true" />
        <span>
          Se atrasa hasta el <span className="dec__fecha">{efecto.hasta}</span>
        </span>
      </span>
    );
  }
  return (
    <span className="dec__efecto" data-efecto="a_tiempo">
      <CalendarCheck className="icono" aria-hidden="true" />
      {efecto.tipo === 'a_tiempo' ? 'A tiempo' : 'Sin cambios de fecha'}
    </span>
  );
}

/** Para qué trabajo va cada compra y cada fecha que cambia, plegado. */
function DetalleOpcion({ decision, opcion }: { decision: DecisionVista; opcion: OpcionVista }) {
  const cubre = opcion.lineas.filter((l) => l.trabajoIds.length > 0);
  const n = opcion.cambiosFecha.length;
  if (n === 0 && cubre.length === 0) return <span className="dec__nada">Ninguna fecha cambia</span>;
  return (
    <details className="dec__detalle">
      <summary>
        <ChevronDown className="icono" aria-hidden="true" />
        {n > 0 ? `${plural(n, 'trabajo cambia', 'trabajos cambian')} de fecha` : 'Ninguna fecha cambia'}
      </summary>
      <div className="dec__detalle-cuerpo">
        {cubre.length > 0 && (
          <>
            <p className="dec__detalle-titulo">Para qué trabajo es</p>
            <ul className="dec__lista">
              {cubre.map((l, i) => (
                <li key={i}>
                  <span className="dec__detalle-dato">
                    {l.cantidad} del {textoProveedor(l.proveedor)}:
                  </span>{' '}
                  {l.trabajoIds.map((id, k) => (
                    <span key={id}>
                      {k > 0 && '; '}
                      <EnlaceTrabajo trabajo={trabajoDe(decision, id)} />
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
        {n > 0 && (
          <>
            <p className="dec__detalle-titulo">Fechas nuevas</p>
            <ul className="dec__lista">
              {opcion.cambiosFecha.map((c) => (
                <li key={c.trabajoId}>
                  <EnlaceTrabajo trabajo={trabajoDe(decision, c.trabajoId)} />
                  <span className="dec__cambio">
                    <time dateTime={c.de.toISOString()}>{formatearFecha(c.de)}</time>
                    <ArrowRight className="icono" aria-hidden="true" />
                    <span className="sr-only"> pasa a </span>
                    <time dateTime={c.a.toISOString()}>{formatearFecha(c.a)}</time>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
