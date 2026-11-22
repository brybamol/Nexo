// Aviso de cuello de botella en Proyectos: a quién espera más gente (el final de varias cadenas de espera) y en qué proyectos.
// Sin cuellos no pinta nada. El estilo `.cuello` es el de globals.css.
import { TriangleAlert } from 'lucide-react';
import type { EsperasVista } from '@/servicios/vistas';

function unir(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function AvisoCuello({ cuellos }: { cuellos: EsperasVista['cuellos'] }) {
  if (cuellos.length === 0) return null;
  return (
    <div className="avisos-cuello" role="status">
      {cuellos.map((k) => (
        <p key={k.persona.id} className="cuello">
          <TriangleAlert className="icono" aria-hidden="true" />
          <span>
            {k.esperando.length} {k.esperando.length === 1 ? 'persona espera' : 'personas esperan'} a{' '}
            <strong>{k.persona.nombre}</strong> ({k.persona.area}) en {unir(k.proyectos.map((p) => p.nombre))}.
          </span>
        </p>
      ))}
    </div>
  );
}
