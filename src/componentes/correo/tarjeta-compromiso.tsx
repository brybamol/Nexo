// Tarjeta de un compromiso extraído del correo (docs/06 §10): qué se pidió, entre quiénes, a quién espera,
// evidencia citada y su revisión. Componente de servidor; la revisión es un componente de cliente.
import { Banknote, ExternalLink, Mail, Repeat } from 'lucide-react';
import { CodigoTrabajo, InsigniaEstado } from '@/componentes/insignia-estado';
import { InsigniaMarcas } from '@/componentes/insignia-marcas';
import type { CausaCorreo, CompromisoConMarcas, ModeloCorreo, PersonaCorreo } from '@/correo/tipos';
import { formatearColones, formatearFecha } from '@/dominio/formato';
import { partesCR } from '@/dominio/tiempo';
import { FormularioRevision } from './formulario-revision';

const MOTIVOS: Record<Extract<CausaCorreo, { tipo: 'espera' }>['motivo'], string> = {
  atrasado: 'que está atrasado',
  bloqueado: 'que está bloqueado',
  en_riesgo: 'que también está en riesgo',
  plazo_posterior: 'que vence después que este',
};

function Persona({ persona }: { persona: PersonaCorreo | undefined }) {
  if (!persona) return <>No lo sé</>;
  return (
    <>
      {persona.nombre} <span className="correo__depto">· {persona.departamento}</span>
    </>
  );
}

export function TarjetaCompromiso({ c, modelo, como }: { c: CompromisoConMarcas; modelo: ModeloCorreo; como: string }) {
  const personas = new Map(modelo.empresa.personas.map((p) => [p.id, p]));
  const porId = new Map(modelo.compromisos.map((x) => [x.id, x]));
  const esperado = c.esperaA?.compromisoId ? porId.get(c.esperaA.compromisoId) : undefined;
  const puedeRevisar = c.solicitanteId === como || c.responsableId === como;
  const revisor = c.revision.porId ? personas.get(c.revision.porId) : undefined;
  const plazoLocal = c.plazo ? `${partesCR(c.plazo).fecha}T${partesCR(c.plazo).hora}` : '';
  const proveedor = modelo.conteos.find((k) => k.personaId === como)?.proveedor;
  const abrirEn = proveedor === 'outlook' ? 'Abrir en Outlook' : 'Abrir en Gmail';

  return (
    <article className="tarjeta trabajo compromiso" data-estado={c.estado} id={c.id}>
      <div className="trabajo__codigo" aria-hidden="true">
        <CodigoTrabajo id={c.codigo} estado={c.estado} />
      </div>
      <div>
        <h3 className="trabajo__titulo">
          <span className="sr-only">{c.codigo} · </span>
          {c.titulo}
        </h3>
        <p className="trabajo__insignias">
          <InsigniaEstado estado={c.estado} />
          <InsigniaMarcas marcas={{ atrasado: c.marcas.atrasado, enRiesgo: c.marcas.enRiesgo, causas: [] }} />
          {c.revision.tipo === 'propuesto' ? (
            <span className="insignia insignia--ia">Propuesto por Nexo</span>
          ) : (
            <span className="insignia insignia--revisado">
              {c.revision.tipo === 'confirmado' ? 'Confirmado' : 'Corregido'} por {revisor?.nombre ?? 'alguien'}
            </span>
          )}
        </p>
      </div>
      <dl className="trabajo__datos">
        <div>
          <dt>Pidió</dt>
          <dd>
            <Persona persona={personas.get(c.solicitanteId ?? '')} />
          </dd>
        </div>
        <div>
          <dt>Lo hace</dt>
          <dd>
            <Persona persona={personas.get(c.responsableId ?? '')} />
          </dd>
        </div>
        <div>
          <dt>Plazo</dt>
          <dd>{c.plazo ? <time dateTime={c.plazo.toISOString()}>{formatearFecha(c.plazo)}</time> : 'No lo sé'}</dd>
        </div>
        <div>
          <dt>Proyecto</dt>
          <dd>{c.proyecto}</dd>
        </div>
        {c.esperaA && (
          <div className="trabajo__dato--ancho">
            <dt>{c.esperaA.tipo === 'bloqueo' ? 'Bloqueado por' : 'Depende de'}</dt>
            <dd>
              {esperado ? (
                <>
                  <a href={`#${esperado.id}`}>
                    {esperado.codigo} · {esperado.titulo}
                  </a>{' '}
                  (<Persona persona={personas.get(esperado.responsableId ?? '')} />)
                </>
              ) : (
                <>«{c.esperaA.texto}»: no sé de qué compromiso depende.</>
              )}
            </dd>
          </div>
        )}
        {c.monto !== null && (
          <div className="trabajo__dato--ancho">
            <dt>Costo</dt>
            <dd className="correo__dato-icono">
              <Banknote className="icono" aria-hidden="true" />
              {formatearColones(c.monto)}: lo aprueba una persona, nunca Nexo.
            </dd>
          </div>
        )}
      </dl>

      <div className="compromiso__extra">
        {c.marcas.causas
          .filter((k): k is Extract<CausaCorreo, { tipo: 'espera' }> => k.tipo === 'espera')
          .map((k) => {
            const d = porId.get(k.compromisoId);
            return (
              <p key={k.compromisoId} className="compromiso__causa">
                En riesgo: espera a {d?.codigo ?? k.compromisoId}, {MOTIVOS[k.motivo]}.
              </p>
            );
          })}
        {c.insistencias > 0 && (
          <p className="correo__dato-icono compromiso__insiste">
            <Repeat className="icono" aria-hidden="true" />
            {personas.get(c.solicitanteId ?? '')?.nombre ?? 'Quien lo pidió'} ya preguntó {c.insistencias === 1 ? '1 vez' : `${c.insistencias} veces`} cómo iba.
          </p>
        )}

        <details className="evidencias">
          <summary>
            <Mail className="icono" aria-hidden="true" />
            De dónde lo sacó Nexo ({c.evidencias.length} {c.evidencias.length === 1 ? 'correo' : 'correos'})
          </summary>
          <ul className="evidencias__lista">
            {c.evidencias.map((e) => {
              const enlace = e.enlaces[como];
              return (
                <li key={`${e.mensajeId}-${e.cita}`}>
                  <blockquote className="evidencias__cita">«{e.cita}»</blockquote>
                  <p className="evidencias__meta">
                    {personas.get(e.autorId ?? '')?.nombre ?? 'Remitente externo'} ·{' '}
                    <time dateTime={e.en.toISOString()}>{formatearFecha(e.en)}</time>
                    {enlace ? (
                      <>
                        {' · '}
                        <a href={enlace} target="_blank" rel="noreferrer">
                          {abrirEn}
                          <ExternalLink className="icono" aria-hidden="true" />
                        </a>
                      </>
                    ) : (
                      <> · No está en tu buzón</>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>

        {puedeRevisar && (
          <FormularioRevision
            como={como}
            personas={modelo.empresa.personas.map((p) => ({ id: p.id, nombre: p.nombre, departamento: p.departamento }))}
            compromiso={{
              id: c.id,
              codigo: c.codigo,
              titulo: c.titulo,
              responsableId: c.responsableId,
              plazoLocal,
              estado: c.estado,
              confirmado: c.revision.tipo === 'confirmado',
            }}
          />
        )}
      </div>
    </article>
  );
}
