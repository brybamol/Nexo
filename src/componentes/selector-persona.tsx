'use client';
// Selector «ver como» (cookie nexo_persona). Tarea 1.7.
import { useTransition } from 'react';
import { cambiarPersona } from '@/app/acciones/persona';
import type { PersonaBreve } from '@/servicios/vistas';

/** Props: `personas` (todas), `actual` (id de la persona vista). */
export function SelectorPersona({ personas, actual }: { personas: PersonaBreve[]; actual: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="selector-persona">
      <label htmlFor="ver-como">Ver como </label>
      <select
        id="ver-como"
        value={actual}
        disabled={pendiente}
        onChange={(e) => {
          const id = e.target.value;
          iniciar(async () => {
            await cambiarPersona(id);
          });
        }}
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} · {p.rol}
          </option>
        ))}
      </select>
    </div>
  );
}
