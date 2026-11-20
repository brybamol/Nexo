// Marco común: barra superior, reloj, selector «ver como» y caja de captura siempre visible. Tarea 1.7 (esqueleto de 1.1).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Nada se prerenderiza: cada página lee la base al pedirla (§9 de docs/05).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nexo',
  description: 'Plataforma central de coordinación',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
