// Enlaces a trabajos por su nombre visible: el título enlazado y, al lado y en pequeño, su referencia (COLINA-4).
// El id interno solo va en la ruta. Componente de servidor o de cliente (no usa estado).
import Link from 'next/link';
import type { TrabajoRef } from '@/dominio/nombres';

/** Referencia visible (COLINA-4, COLINA-D1) en Space Grotesk, pequeña, junto a un título. */
export function Referencia({ valor }: { valor: string }) {
  if (!valor) return null;
  return <span className="ref">{valor}</span>;
}

export function EnlaceTrabajo({ trabajo }: { trabajo: TrabajoRef }) {
  return (
    <>
      <Link href={`/trabajos/${trabajo.id}`}>{trabajo.titulo}</Link>
      {trabajo.referencia && (
        <>
          {' '}
          <Referencia valor={trabajo.referencia} />
        </>
      )}
    </>
  );
}

export function EnlacesTrabajos({ trabajos }: { trabajos: TrabajoRef[] }) {
  return trabajos.map((t, i) => (
    <span key={t.id}>
      {i > 0 && '; '}
      <EnlaceTrabajo trabajo={t} />
    </span>
  ));
}
