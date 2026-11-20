// Insignias Atrasado / En riesgo. Tarea 1.7; iconos en la 4.6.
import { Clock, TriangleAlert } from 'lucide-react';
import type { Marcas } from '@/dominio/tipos';

/** Muestra «Atrasado» y/o «En riesgo» según las marcas. No pinta nada si no hay ninguna. */
export function InsigniaMarcas({ marcas }: { marcas: Marcas }) {
  if (!marcas.atrasado && !marcas.enRiesgo) return null;
  return (
    <span className="insignias">
      {marcas.atrasado && (
        <span className="insignia insignia--atrasado">
          <Clock className="icono" aria-hidden="true" />
          Atrasado
        </span>
      )}{' '}
      {marcas.enRiesgo && (
        <span className="insignia insignia--riesgo">
          <TriangleAlert className="icono" aria-hidden="true" />
          En riesgo
        </span>
      )}
    </span>
  );
}
