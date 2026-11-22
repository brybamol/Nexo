'use client';
// Región de resultado de lo que se hace con propuestas y entregas (R7b). Vive fuera de las tarjetas: tras actuar, el trabajo
// cambia de sección o desaparece de la lista y su tarjeta se desmonta, pero el resultado sigue visible (role="status").
// `useAnunciar()` devuelve null fuera del proveedor: los componentes siguen funcionando sin él.
import { CircleCheck } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import '@/app/mi-dia/reformas.css';

type Anuncio = { id: number; mensaje: string };

const Contexto = createContext<((mensaje: string) => void) | null>(null);

export function useAnunciar(): ((mensaje: string) => void) | null {
  return useContext(Contexto);
}

/** Envuelve la página. El mensaje más reciente reemplaza al anterior; se puede cerrar. */
export function ResultadoPedidos({ children }: { children: ReactNode }) {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (anuncio) ref.current?.focus();
  }, [anuncio]);
  return (
    <Contexto.Provider value={(mensaje) => setAnuncio((prev) => ({ mensaje, id: (prev?.id ?? 0) + 1 }))}>
      <div aria-live="polite" className="resultado-pedidos">
        {anuncio && (
          <div key={anuncio.id} ref={ref} tabIndex={-1} role="status" className="aviso-ok">
            <CircleCheck className="icono" aria-hidden="true" />
            <p>
              {anuncio.mensaje}{' '}
              <button type="button" className="enlace-boton" onClick={() => setAnuncio(null)}>
                Cerrar
              </button>
            </p>
          </div>
        )}
      </div>
      {children}
    </Contexto.Provider>
  );
}
