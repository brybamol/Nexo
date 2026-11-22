// Tarjeta de una propuesta de Nexo (docs/08 §6): lo que Nexo infirió, de dónde salió y con qué confianza. Lo que Nexo
// propone es Mint tenue; solo su dueño la ve hasta que se confirma. Nunca se presenta como un hecho.
// Componente de servidor; las acciones (Confirmar, Corregir, Descartar) son de cliente. Props: `trabajo` (TrabajoVista de una
// propuesta), `yoId`, `personas` y `proyectos` (para el formulario de corrección), `hoy` ('AAAA-MM-DD').
import { ExternalLink, Quote } from 'lucide-react';
import Link from 'next/link';
import { AccionesPropuesta } from '@/componentes/acciones-propuesta';
import { Referencia } from '@/componentes/enlaces-trabajos';
import { InsigniaConfianza } from '@/componentes/insignia-confianza';
import { DetalleEntrega } from '@/componentes/insignia-entrega';
import { formatearFecha } from '@/dominio/formato';
import { citaConReferencia } from '@/dominio/nombres';
import { partesCR } from '@/dominio/tiempo';
import type { TrabajoVista } from '@/servicios/vistas';
import '@/app/mi-dia/reformas.css';

export function TarjetaPropuesta({
  trabajo: t,
  yoId,
  personas,
  proyectos,
  hoy,
  conEnlace = true,
}: {
  trabajo: TrabajoVista;
  yoId: string;
  personas: { id: string; nombre: string; rol: string }[];
  proyectos: { id: string; nombre: string }[];
  hoy: string;
  /** El título enlaza al detalle (en el detalle mismo no hace falta). */
  conEnlace?: boolean;
}) {
  const pedido = t.evidencias.find((e) => e.tipo === 'pedido') ?? t.evidencias[0];
  const plazo = partesCR(t.plazo);
  const cita = citaConReferencia(t.titulo, t.referencia);
  return (
    <article className="propuesta" aria-label={`Propuesta de Nexo: ${t.titulo}`}>
      <header className="propuesta__cabecera">
        <h3 className="propuesta__titulo">
          {conEnlace ? <Link href={`/trabajos/${t.id}`}>{t.titulo}</Link> : t.titulo}{' '}
          <Referencia valor={t.referencia} />
        </h3>
        <InsigniaConfianza confianza={t.confianza} />
      </header>
      <p className="propuesta__origen">
        {t.origen === 'correo' && pedido ? (
          <>
            Lo vi en tu buzón (<time dateTime={pedido.en.toISOString()}>{formatearFecha(pedido.en)}</time>). Solo tú lo ves hasta
            que lo confirmes.
          </>
        ) : (
          <>Solo tú lo ves hasta que lo confirmes.</>
        )}
      </p>
      {pedido && (
        <blockquote className="cita propuesta__cita">
          <Quote className="icono" aria-hidden="true" />
          <span>{pedido.cita}</span>
          {pedido.enlace && (
            <a href={pedido.enlace} target="_blank" rel="noreferrer noopener" className="enlace-externo">
              <ExternalLink className="icono" aria-hidden="true" />
              Abrir en Gmail
            </a>
          )}
        </blockquote>
      )}
      <dl className="propuesta__datos">
        <div>
          <dt>Responsable</dt>
          <dd>{t.responsable.nombre}</dd>
        </div>
        <div>
          <dt>Lo pidió</dt>
          <dd>{t.solicitadoPor ? t.solicitadoPor.nombre : 'Nadie de la empresa'}</dd>
        </div>
        <div>
          <dt>Plazo</dt>
          <dd>
            <time dateTime={t.plazo.toISOString()}>{formatearFecha(t.plazo)}</time>
          </dd>
        </div>
        <div>
          <dt>Proyecto</dt>
          <dd>{t.proyecto.nombre}</dd>
        </div>
      </dl>
      {t.entrega && (
        <div className="propuesta__entrega">
          <p className="propuesta__entrega-titulo">Ya hay una entrega en el correo</p>
          <DetalleEntrega entrega={t.entrega} />
        </div>
      )}
      <AccionesPropuesta
        d={{
          trabajoId: t.id,
          cita,
          yoId,
          titulo: t.titulo,
          responsableId: t.responsable.id,
          proyectoId: t.proyecto.id,
          plazoFecha: plazo.fecha,
          plazoHora: plazo.hora,
          hoy,
          solicitanteId: t.solicitadoPor?.id ?? null,
          solicitanteNombre: t.solicitadoPor?.nombre ?? null,
          entregadoPor: t.entrega?.por.nombre ?? null,
          personas,
          proyectos,
        }}
      />
    </article>
  );
}
