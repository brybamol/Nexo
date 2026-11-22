// «Quién espera a quién» (docs/08 regla 23): cadenas sobre todos los trabajos que ve quien mira, vengan del correo o de la
// captura, y el cuello de botella si lo hay.
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { EnlacesTrabajos } from '@/componentes/enlaces-trabajos';
import type { EsperasVista } from '@/servicios/vistas';

function unir(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export function Esperas({ esperas }: { esperas: EsperasVista }) {
  if (esperas.cadenas.length === 0) {
    return <p className="vacio">Nadie espera a otra persona ahora, entre los trabajos que ves.</p>;
  }
  return (
    <div className="cadenas">
      {esperas.cuellos.map((k) => (
        <p key={k.persona.id} className="cuello">
          <TriangleAlert className="icono" aria-hidden="true" />
          <span>
            <strong>{k.persona.nombre}</strong> ({k.persona.area}) es el final de cadenas en {unir(k.proyectos.map((p) => p.nombre))}:{' '}
            {k.esperando.length} {k.esperando.length === 1 ? 'persona espera' : 'personas esperan'} detrás.
          </span>
        </p>
      ))}
      <ul className="lista">
        {esperas.cadenas.map((c) => (
          <li key={c.trabajos.map((t) => t.id).join('>')} className="tarjeta cadenas__proyecto">
            <h3 className="cadenas__titulo">{unir(c.proyectos.map((p) => p.nombre))}</h3>
            <ol className="cadena" aria-label="Quién espera a quién, de quien espera a quien debe">
              {c.personas.map((p, i) => (
                <li key={`${p.id}-${i}`} className="cadena__eslabon">
                  {i > 0 && <ArrowRight className="icono cadena__flecha" aria-hidden="true" />}
                  <span className="cadena__persona" data-ultimo={i === c.personas.length - 1 ? 'si' : undefined}>
                    <strong>{p.nombre}</strong>
                    <span className="correo__depto">{p.area}</span>
                    <span className="cadena__debe">{i === c.personas.length - 1 ? 'es quien debe' : 'espera'}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="cadenas__trabajos">
              <span className="cadena__debe">Trabajos en la cadena, del primero al último: </span>
              <EnlacesTrabajos trabajos={c.trabajos} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
