// Barra superior: navegación, selector «ver como», reloj y Reiniciar demo. Tarea 1.7.
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import { listarPersonas } from '@/servicios/personas';
import { obtenerAhora } from '@/servicios/reloj';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import { ControlReloj } from './control-reloj';
import { SelectorPersona } from './selector-persona';

const ENLACES = [
  { href: '/mi-dia', texto: 'Mi día' },
  { href: '/proyectos', texto: 'Proyectos' },
  { href: '/decisiones', texto: 'Decisiones' },
  { href: '/preguntar', texto: 'Preguntar' },
  { href: '/registro', texto: 'Registro' },
];

/** Componente de servidor sin props: lee personas, persona actual y reloj. */
export async function BarraSuperior() {
  const ctx = await obtenerContextoApp();
  const [personas, actual, ahora] = await Promise.all([
    listarPersonas(ctx),
    personaActual(),
    obtenerAhora(ctx),
  ]);
  return (
    <header className="barra">
      <Link href="/mi-dia" className="barra__marca">
        <strong>Nexo</strong>
      </Link>
      <nav aria-label="Principal">
        <ul className="barra__nav">
          {ENLACES.map((e) => (
            <li key={e.href}>
              <Link href={e.href}>{e.texto}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="barra__controles">
        <SelectorPersona personas={personas} actual={actual} />
        <ControlReloj ahoraTexto={formatearFecha(ahora)} />
      </div>
    </header>
  );
}
