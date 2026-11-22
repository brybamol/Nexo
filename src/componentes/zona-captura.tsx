// Zona de la caja de captura. Antes se ocultaba en /correo; desde las reformas v2 (docs/08 §6) está visible en todas las pantallas.
import type { ReactNode } from 'react';

export function ZonaCaptura({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
