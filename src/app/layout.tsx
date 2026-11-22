// Marco común: barra lateral (navegación y consola de la demo), contenido y Nexo como asistente flotante. Tarea 1.7.
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AgenteNexo } from '@/componentes/agente/agente-nexo';
import { BarraSuperior } from '@/componentes/barra-superior';
import { listarPersonas } from '@/servicios/personas';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import './globals.css';

// Tipografías de marca, autoalojadas por next/font en el build (el navegador no llama a Google).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--fuente-inter',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--fuente-space-grotesk',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

// Nada se prerenderiza: cada página lee la base al pedirla (§9 de docs/05).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nexo',
  description: 'Plataforma central de coordinación',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Cambia con cada «Reiniciar demo» (la acción `reiniciar` sube la cookie).
  const reinicios = (await cookies()).get('nexo-reinicio')?.value ?? '0';
  const ctx = await obtenerContextoApp();
  const [personaId, personas] = await Promise.all([personaActual(), listarPersonas(ctx)]);
  const nombre = personas.find((p) => p.id === personaId)?.nombre.split(' ')[0] ?? '';
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="app">
        <a href="#contenido" className="app__saltar">
          Saltar al contenido
        </a>
        <BarraSuperior />
        <div className="app__principal">
          <main id="contenido" className="app__contenido">
            {children}
          </main>
        </div>
        {/* La conversación es de una persona y de una demo: se reinicia al cambiar cualquiera de las dos. */}
        <AgenteNexo key={`${reinicios}-${personaId}`} nombre={nombre} />
      </body>
    </html>
  );
}
