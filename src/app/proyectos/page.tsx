// Proyectos por proximidad, cada uno leído como recorrido. Las cifras y la tasa de corrección viven solo en Registro.
import { AvisoCuello } from '@/componentes/proyectos/aviso-cuello';
import { FilaProyecto } from '@/componentes/proyectos/fila-proyecto';
import { obtenerCuellos } from '@/servicios/esperas';
import { listarRecorridos, type ProyectoRecorrido } from '@/servicios/proyectos';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
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
  const personaId = await personaActual();
  const [recorridos, cuellos] = await Promise.all([listarRecorridos(ctx), obtenerCuellos(ctx, personaId)]);
  return (
    <div className="proyectos-lista">
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Proyectos</h1>
        <p className="pagina__sub">Primero lo que vence antes. Cada fila muestra cuánto falta, por dónde va y qué lo frena.</p>
      </header>

      <AvisoCuello cuellos={cuellos} />

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
    </div>
  );
}
