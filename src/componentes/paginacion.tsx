// Barra de paginación de una tabla: qué filas se ven, cuántas mostrar (10, 20 o 50) y Anterior / Siguiente.
// Componente de servidor: todo son enlaces con `?por=` y `?pagina=` en la dirección, sin estado en el navegador.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { LOTES, type Pagina } from '@/dominio/paginacion';

type Props = {
  /** Resultado de `paginar`. */
  pagina: Pagina;
  /** Ruta de la pantalla, sin parámetros: '/registro'. */
  ruta: string;
  /** Nombre accesible de la barra; hay una arriba y otra abajo de la tabla. */
  etiqueta: string;
  /** Qué se cuenta, en plural: «acciones». */
  que: string;
};

/** Dirección de una página; lo que es valor por defecto (10 filas, página 1) no se escribe. */
function direccion(ruta: string, por: number, n: number): string {
  const q = new URLSearchParams();
  if (por !== LOTES[0]) q.set('por', String(por));
  if (n > 1) q.set('pagina', String(n));
  const texto = q.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

export function Paginacion({ pagina: p, ruta, etiqueta, que }: Props) {
  const anterior = p.pagina > 1 ? direccion(ruta, p.por, p.pagina - 1) : null;
  const siguiente = p.pagina < p.paginas ? direccion(ruta, p.por, p.pagina + 1) : null;
  return (
    <nav className="paginacion" aria-label={etiqueta}>
      <p className="paginacion__rango">
        Mostrando{' '}
        <strong>
          {p.desde + 1}–{p.hasta}
        </strong>{' '}
        de {p.total} {que}
      </p>
      <div className="paginacion__lotes" role="group" aria-label="Filas por página">
        <span className="paginacion__lotes-titulo" aria-hidden="true">
          Mostrar
        </span>
        {LOTES.map((l) => (
          // Cambiar el tamaño del lote vuelve a la primera página.
          <Link
            key={l}
            href={direccion(ruta, l, 1)}
            scroll={false}
            className="paginacion__lote"
            aria-current={l === p.por ? 'true' : undefined}
            aria-label={`Mostrar ${l} ${que} por página`}
          >
            {l}
          </Link>
        ))}
      </div>
      <div className="paginacion__pasos">
        {anterior ? (
          <Link href={anterior} scroll={false} className="boton boton--quieto" rel="prev">
            <ChevronLeft className="icono" aria-hidden="true" />
            Anterior
          </Link>
        ) : (
          <span className="boton boton--quieto paginacion__inactivo" aria-disabled="true">
            <ChevronLeft className="icono" aria-hidden="true" />
            Anterior
          </span>
        )}
        <span className="paginacion__donde" aria-current="page">
          Página {p.pagina} de {p.paginas}
        </span>
        {siguiente ? (
          <Link href={siguiente} scroll={false} className="boton boton--quieto" rel="next">
            Siguiente
            <ChevronRight className="icono" aria-hidden="true" />
          </Link>
        ) : (
          <span className="boton boton--quieto paginacion__inactivo" aria-disabled="true">
            Siguiente
            <ChevronRight className="icono" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
