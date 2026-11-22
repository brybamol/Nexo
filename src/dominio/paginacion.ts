// Paginación de listas largas (hoy, la tabla de Registro). Código puro: recibe lo que llega de la dirección y lo corrige.

/** Tamaños de lote que se ofrecen. El primero es el de por defecto. */
export const LOTES = [10, 20, 50] as const;
export type Lote = (typeof LOTES)[number];

export interface Pagina {
  /** Filas por página. */
  por: Lote;
  /** Página actual, desde 1. */
  pagina: number;
  /** Total de páginas; al menos 1. */
  paginas: number;
  /** Índices para `slice(desde, hasta)`. */
  desde: number;
  hasta: number;
  total: number;
}

function entero(v: string | string[] | undefined): number | null {
  const texto = Array.isArray(v) ? v[0] : v;
  if (texto === undefined || !/^\d{1,6}$/.test(texto)) return null;
  return Number(texto);
}

/**
 * Página a mostrar de una lista de `total` filas. `porPedido` y `paginaPedida` vienen tal cual de la dirección
 * (`?por=20&pagina=2`): un lote que no se ofrece vuelve a 10 y una página fuera de rango se ajusta a la más cercana.
 */
export function paginar(
  total: number,
  porPedido?: string | string[],
  paginaPedida?: string | string[],
): Pagina {
  const pedido = entero(porPedido);
  const por = LOTES.find((l) => l === pedido) ?? LOTES[0];
  const paginas = Math.max(1, Math.ceil(total / por));
  const pagina = Math.min(paginas, Math.max(1, entero(paginaPedida) ?? 1));
  const desde = (pagina - 1) * por;
  return { por, pagina, paginas, desde, hasta: Math.min(total, desde + por), total };
}
