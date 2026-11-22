// «Entregado · falta que X confirme que lo recibió» (docs/08 regla 21). Lo entregado espera a una persona: registro azul.
// No es un estado ni una marca: es el campo `entrega`. Componentes de servidor.
import { ExternalLink, PackageCheck } from 'lucide-react';
import { formatearFecha } from '@/dominio/formato';
import type { EntregaVista, PersonaBreve } from '@/servicios/vistas';
import '@/app/mi-dia/reformas.css';

/** Props: `confirma` (quien lo pidió, o null si no se sabe). */
export function InsigniaEntrega({ confirma }: { confirma: PersonaBreve | null }) {
  return (
    <p className="insignia-entrega">
      <PackageCheck className="icono" aria-hidden="true" />
      <span>Entregado · falta que {confirma ? confirma.nombre : 'quien lo pidió'} confirme que lo recibió</span>
    </p>
  );
}

/** Quién entregó, cuándo, con qué nota y enlace. Props: `entrega` (EntregaVista). */
export function DetalleEntrega({ entrega }: { entrega: EntregaVista }) {
  return (
    <div className="detalle-entrega">
      <p>
        {entrega.por.nombre} lo entregó el <time dateTime={entrega.en.toISOString()}>{formatearFecha(entrega.en)}</time>
        {entrega.nota ? ':' : '.'}
      </p>
      {entrega.nota && <blockquote className="cita">{entrega.nota}</blockquote>}
      {entrega.enlace && (
        <p>
          <a href={entrega.enlace} target="_blank" rel="noreferrer noopener" className="enlace-externo">
            <ExternalLink className="icono" aria-hidden="true" />
            Abrir el enlace de la entrega
          </a>
        </p>
      )}
    </div>
  );
}
