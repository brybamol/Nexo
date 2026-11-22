// Insignia del estado de un trabajo (icono + nombre) y código del trabajo. Tarea 4.6, solo presentación.
import { Ban, Circle, CircleCheck, CircleDot } from 'lucide-react';
import type { EstadoTrabajo } from '@/dominio/tipos';

const ETIQUETAS: Record<EstadoTrabajo, string> = {
  abierto: 'Abierto',
  en_curso: 'En curso',
  bloqueado: 'Bloqueado',
  resuelto: 'Resuelto',
};

const ICONOS = { abierto: Circle, en_curso: CircleDot, bloqueado: Ban, resuelto: CircleCheck } as const;

/** Estado escrito con su icono; el color acompaña, nunca sustituye al texto. */
export function InsigniaEstado({ estado }: { estado: EstadoTrabajo }) {
  const Icono = ICONOS[estado];
  return (
    <span className="insignia insignia--estado" data-estado={estado}>
      <Icono className="icono" aria-hidden="true" />
      {ETIQUETAS[estado]}
    </span>
  );
}

/**
 * Referencia visible del trabajo (COLINA-4) en Space Grotesk, teñida con el color de su estado. Nunca el id interno:
 * la referencia sale de dominio/nombres.ts. Sin referencia no muestra nada.
 */
export function CodigoTrabajo({ referencia, estado, grande = false }: { referencia: string; estado: EstadoTrabajo; grande?: boolean }) {
  if (!referencia) return null;
  return (
    <span className={grande ? 'codigo codigo--grande' : 'codigo'} data-estado={estado}>
      {referencia}
    </span>
  );
}
