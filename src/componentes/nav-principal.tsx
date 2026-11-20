'use client';
// Navegación principal con la pantalla actual marcada (aria-current). Tarea 4.6, solo presentación.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Props: `enlaces` (href y texto). Marca como actual el enlace cuya ruta coincide con la de la página. */
export function NavPrincipal({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <ul className="barra__nav">
      {enlaces.map((e) => {
        const actual = ruta === e.href || ruta.startsWith(`${e.href}/`);
        return (
          <li key={e.href}>
            <Link href={e.href} aria-current={actual ? 'page' : undefined}>
              {e.texto}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
