// Barra superior: navegación, selector «ver como», reloj y Reiniciar demo. Tarea 1.7.
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import { listarPersonas } from '@/servicios/personas';
import { obtenerAhora } from '@/servicios/reloj';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import { ControlReloj } from './control-reloj';
import { NavPrincipal } from './nav-principal';
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
      <div className="consola" role="region" aria-label="Consola de la demo">
        <div className="consola__interior barra__controles">
          <span className="consola__titulo" aria-hidden="true">
            Demo
          </span>
          <SelectorPersona personas={personas} actual={actual} />
          <ControlReloj ahoraTexto={formatearFecha(ahora)} />
        </div>
      </div>
      <div className="barra__fila">
        <Link href="/mi-dia" className="barra__marca">
          <span className="barra__logo">Nexo</span>
          <span className="barra__empresa">Frío del Valle</span>
        </Link>
        <nav aria-label="Principal" className="barra__nav-contenedor">
          <NavPrincipal enlaces={ENLACES} />
        </nav>
      </div>
    </header>
  );
}
