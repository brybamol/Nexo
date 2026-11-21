// Barra de la aplicación: lateral Navy en escritorio, cabecera en teléfono. Lleva la marca, la navegación
// y, aparte y etiquetada como DEMO, la consola de la demo (ver como, reloj y Reiniciar demo). Tarea 1.7.
import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/dominio/formato';
import { listarPersonas } from '@/servicios/personas';
import { obtenerAhora } from '@/servicios/reloj';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import { ControlReloj } from './control-reloj';
import { LogoNexo } from './marca/logo-nexo';
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
      <div className="barra__marca-fila">
        <Link href="/mi-dia" className="barra__marca" aria-label="Nexo · Frío del Valle, ir a Mi día">
          <LogoNexo fondo="oscuro" tamano={30} titulo="" />
          <span className="barra__empresa">Frío del Valle</span>
        </Link>
      </div>
      <nav aria-label="Principal" className="barra__nav-contenedor">
        <NavPrincipal enlaces={ENLACES} />
      </nav>
      <div className="consola" role="region" aria-label="Consola de la demo">
        <p className="consola__titulo">
          <FlaskConical className="icono" aria-hidden="true" />
          <span>Demo</span>
          <span className="consola__nota">datos de demostración</span>
        </p>
        <div className="consola__controles barra__controles">
          <SelectorPersona personas={personas} actual={actual} />
          <ControlReloj ahoraTexto={formatearFecha(ahora)} />
        </div>
      </div>
    </header>
  );
}
