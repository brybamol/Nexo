// Insignias Atrasado / En riesgo. Tarea 1.7.
import type { Marcas } from '@/dominio/tipos';

/** Muestra «Atrasado» y/o «En riesgo» según las marcas. No pinta nada si no hay ninguna. */
export function InsigniaMarcas({ marcas }: { marcas: Marcas }) {
  if (!marcas.atrasado && !marcas.enRiesgo) return null;
  return (
    <span className="insignias">
      {marcas.atrasado && <span className="insignia insignia--atrasado">Atrasado</span>}{' '}
      {marcas.enRiesgo && <span className="insignia insignia--riesgo">En riesgo</span>}
    </span>
  );
}
