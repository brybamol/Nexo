// Insignia del estado de un trabajo (icono + nombre) y rótulo del código. Tarea 4.6, solo presentación.
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

/** Rótulo de ubicación con el código del trabajo, relleno con el color de su estado. */
export function Rotulo({ id, estado, grande = false }: { id: string; estado: EstadoTrabajo; grande?: boolean }) {
  return (
    <span className={grande ? 'rotulo rotulo--grande' : 'rotulo'} data-estado={estado}>
      {id}
    </span>
  );
}
