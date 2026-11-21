// Marco común: barra lateral (navegación y consola de la demo), caja de captura siempre visible y contenido. Tarea 1.7.
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { BarraSuperior } from '@/componentes/barra-superior';
import { CajaCaptura } from '@/componentes/caja-captura';
import { ZonaCaptura } from '@/componentes/zona-captura';
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
  // Cambia con cada «Reiniciar demo» (la acción `reiniciar` sube la cookie): remonta la caja de captura.
  const reinicios = (await cookies()).get('nexo-reinicio')?.value ?? '0';
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="app">
        <a href="#contenido" className="app__saltar">
          Saltar al contenido
        </a>
        <BarraSuperior />
        <div className="app__principal">
          {/* Escritorio: la captura va arriba del contenido. Teléfono: fija abajo (ver globals.css). */}
          <ZonaCaptura>
            <div className="app__captura" role="region" aria-label="Captura">
              <CajaCaptura key={reinicios} />
            </div>
          </ZonaCaptura>
          <main id="contenido" className="app__contenido">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
