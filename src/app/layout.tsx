// Marco común: barra superior, reloj, selector «ver como» y caja de captura siempre visible. Tarea 1.7.
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { BarraSuperior } from '@/componentes/barra-superior';
import { CajaCaptura } from '@/componentes/caja-captura';
import './globals.css';

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
    <html lang="es">
      <body className="app">
        <a href="#contenido" className="app__saltar">
          Saltar al contenido
        </a>
        <BarraSuperior />
        {/* Escritorio: la captura va arriba del contenido. Teléfono: fija abajo (ver globals.css). */}
        <div className="app__captura" role="region" aria-label="Captura">
          <CajaCaptura key={reinicios} />
        </div>
        <main id="contenido" className="app__contenido">
          {children}
        </main>
      </body>
    </html>
  );
}
