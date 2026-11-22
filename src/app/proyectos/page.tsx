// Proyectos por proximidad, cada uno leído como recorrido; las tres cifras al pie. Lee listarRecorridos y obtenerCifras.
import { CifrasDemo } from '@/componentes/cifras-demo';
import { FilaProyecto } from '@/componentes/proyectos/fila-proyecto';
import { TasaCorreccion } from '@/componentes/tasa-correccion';
import { obtenerCifras } from '@/servicios/cifras';
import { listarRecorridos, type ProyectoRecorrido } from '@/servicios/proyectos';
import { obtenerTasaCorreccion } from '@/servicios/tasa';
import { obtenerContextoApp } from '@/servidor/contexto-app';
import './proyectos.css';

const GRUPOS: { clave: 'fecha' | 'sin' | 'hecho'; titulo: string }[] = [
  { clave: 'fecha', titulo: 'Por entregar' },
  { clave: 'sin', titulo: 'Sin fecha de entrega' },
  { clave: 'hecho', titulo: 'Terminados' },
];

function grupo(r: ProyectoRecorrido): 'fecha' | 'sin' | 'hecho' {
  return r.terminado ? 'hecho' : r.fecha ? 'fecha' : 'sin';
}

export default async function PaginaProyectos() {
  const ctx = await obtenerContextoApp();
  const [cifras, recorridos, tasa] = await Promise.all([
    obtenerCifras(ctx),
    listarRecorridos(ctx),
    obtenerTasaCorreccion(ctx),
  ]);
  return (
    <div className="proyectos-lista">
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Proyectos</h1>
        <p className="pagina__sub">Primero lo que vence antes. Cada fila muestra cuánto falta, por dónde va y qué lo frena.</p>
      </header>

      {GRUPOS.map(({ clave, titulo }) => {
        const lista = recorridos.filter((r) => grupo(r) === clave);
        if (lista.length === 0) return null;
        return (
          <section key={clave} className="seccion" aria-labelledby={`grupo-${clave}`}>
            <h2 className="seccion__titulo" id={`grupo-${clave}`}>
              {titulo} <span className="seccion__cuenta">{lista.length}</span>
            </h2>
            <ol className="filas-proyecto">
              {lista.map((r) => (
                <li key={r.id}>
                  <FilaProyecto r={r} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <section className="seccion proyectos-lista__cifras" aria-labelledby="cifras-titulo">
        <h2 className="seccion__titulo" id="cifras-titulo">
          Lo que Nexo coordinó esta semana
        </h2>
        <CifrasDemo cifras={cifras} />
        <TasaCorreccion tasa={tasa} compacta />
      </section>
    </div>
  );
}
