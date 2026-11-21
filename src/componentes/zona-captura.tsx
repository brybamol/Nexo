'use client';
// Oculta la caja de captura en /correo: allí nadie escribe frases, todo sale del correo (docs/06 §10).
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function ZonaCaptura({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  if (ruta === '/correo' || ruta.startsWith('/correo/')) return null;
  return <>{children}</>;
}
