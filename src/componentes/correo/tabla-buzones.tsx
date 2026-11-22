// Sección «Buzones»: las 12 personas, conectadas o no, con lo leído. De lo personal y los boletines solo se cuenta.
import { Check, Minus } from 'lucide-react';
import type { BuzonVista } from '@/servicios/vistas';

const NOMBRE_PROVEEDOR = { gmail: 'Gmail', outlook: 'Outlook' } as const;

export function TablaBuzones({ buzones, quienMira }: { buzones: BuzonVista[]; quienMira: string }) {
  return (
    <div className="tabla-envoltura" role="region" aria-label="Buzones de Frío del Valle" tabIndex={0}>
      <table className="tabla fuente-buzones">
        <thead>
          <tr>
            <th scope="col">Persona</th>
            <th scope="col">Buzón</th>
            <th scope="col">Leídos</th>
            <th scope="col">De trabajo</th>
            <th scope="col">Personales descartados</th>
            <th scope="col">Boletines descartados</th>
          </tr>
        </thead>
        <tbody>
          {buzones.map((b) => (
            <tr key={b.persona.id} data-yo={b.persona.id === quienMira ? 'si' : undefined}>
              <th scope="row">
                {b.persona.nombre}
                {b.persona.id === quienMira && <span className="fuente-buzones__yo"> (tú)</span>}{' '}
                <span className="correo__depto">· {b.persona.area}</span>
              </th>
              <td>
                {b.conectado && b.proveedor ? (
                  <span className="fuente-estado" data-conectado="si">
                    <Check className="icono" aria-hidden="true" />
                    Conectado · {NOMBRE_PROVEEDOR[b.proveedor]}
                  </span>
                ) : (
                  <span className="fuente-estado">
                    <Minus className="icono" aria-hidden="true" />
                    Sin conectar
                  </span>
                )}
              </td>
              {b.conectado ? (
                <>
                  <td className="num">{b.leidos}</td>
                  <td className="num">{b.laborales}</td>
                  <td className="num">{b.personales}</td>
                  <td className="num">{b.boletines}</td>
                </>
              ) : (
                <td colSpan={4} className="fuente-buzones__nada">
                  Nexo no lee este correo
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
