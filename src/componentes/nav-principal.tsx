'use client';
// Navegación principal con la pantalla actual marcada (aria-current). Tarea 4.6, solo presentación.
import { FolderKanban, Plug, ScrollText, Scale, Sun, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Icono de cada pantalla, por ruta. Las rutas sin icono se muestran solo con texto. */
const ICONOS: Record<string, LucideIcon> = {
  '/mi-dia': Sun,
  '/proyectos': FolderKanban,
  '/decisiones': Scale,
  '/registro': ScrollText,
  '/conexiones': Plug,
};

/** Props: `enlaces` (href y texto). Marca como actual el enlace cuya ruta coincide con la de la página. */
export function NavPrincipal({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <ul className="barra__nav">
      {enlaces.map((e) => {
        const actual = ruta === e.href || ruta.startsWith(`${e.href}/`);
        const Icono = ICONOS[e.href];
        return (
          <li key={e.href}>
            <Link href={e.href} aria-current={actual ? 'page' : undefined}>
              {Icono && <Icono className="icono" aria-hidden="true" />}
              <span>{e.texto}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
