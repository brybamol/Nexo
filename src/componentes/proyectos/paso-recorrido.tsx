// Un trabajo dentro del recorrido de su proyecto: título, referencia, responsable, plazo, estado, marcas y lo que espera.
// Componente de servidor: formatea las fechas aquí.
import { Ban, Check, CornerDownRight, Hourglass, Link2, Package, Zap } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EnlaceTrabajo } from '@/componentes/enlaces-trabajos';
import { CodigoTrabajo, InsigniaEstado } from '@/componentes/insignia-estado';
import { InsigniaMarcas } from '@/componentes/insignia-marcas';
import { formatearFecha } from '@/dominio/formato';
import { proximidad } from '@/motor/secuencia';
import type { PasoRecorrido } from '@/servicios/proyectos';
import { sinPunto } from './textos';

function Enlaces({ refs }: { refs: { id: string; titulo: string; referencia: string }[] }) {
  return refs.map((r, i) => (
    <span key={r.id}>
      {i > 0 && (i === refs.length - 1 ? ' y ' : ', ')}
      <EnlaceTrabajo trabajo={r} />
    </span>
  ));
}

/** Las relaciones del paso: bloqueo, esperas dentro y fuera del proyecto, repuestos y riesgos heredados. */
function Relaciones({ paso }: { paso: PasoRecorrido }) {
  const t = paso.trabajo;
  const pendientesAntes = paso.antes.filter((a) => !a.resuelto && a.id !== t.bloqueadoPor?.id);
  const fueraPendientes = paso.fuera.filter((a) => !a.resuelto && a.id !== t.bloqueadoPor?.id);
  const bloqueoFuera = t.bloqueadoPor ? paso.fuera.find((a) => a.id === t.bloqueadoPor?.id) : undefined;
  const todoAntesHecho = paso.antes.length > 0 && paso.antes.every((a) => a.resuelto);
  const repuestos = t.estado !== 'resuelto' ? Object.values(t.causasRepuestos) : [];
  const riesgoHeredado =
    t.estado !== 'resuelto'
      ? t.marcas.causas
          .flatMap((c) => {
            const r = c.tipo === 'cadena' && c.trabajoId ? t.causasTrabajos[c.trabajoId] : undefined;
            return r ? [r] : [];
          })
          .filter((r) => r.id !== t.bloqueadoPor?.id && !paso.antes.some((a) => a.id === r.id && !a.resuelto))
      : [];

  const filas: ReactNode[] = [];
  if (t.estado === 'bloqueado' && t.bloqueadoPor) {
    filas.push(
      <li key="bloqueo" data-tono="critico">
        <Ban className="icono" aria-hidden="true" />
        <span>
          Bloqueado por <EnlaceTrabajo trabajo={t.bloqueadoPor} />
          {bloqueoFuera && <>, de {bloqueoFuera.proyecto.nombre}</>}
          {paso.motivoBloqueo && <>. {sinPunto(paso.motivoBloqueo)}</>}
          {t.fechaSolucion && (
            <>
              {' '}
              · solución prevista <time dateTime={t.fechaSolucion.toISOString()}>{formatearFecha(t.fechaSolucion)}</time>
            </>
          )}
        </span>
      </li>,
    );
  }
  if (pendientesAntes.length > 0) {
    filas.push(
      <li key="espera">
        <Hourglass className="icono" aria-hidden="true" />
        <span>
          Espera a <Enlaces refs={pendientesAntes} />
        </span>
      </li>,
    );
  }
  if (fueraPendientes.length > 0) {
    for (const [nombre, refs] of agrupar(fueraPendientes)) {
      filas.push(
        <li key={`fuera-${nombre}`} data-tono="aviso">
          <Link2 className="icono" aria-hidden="true" />
          <span>
            Espera a otro proyecto, {nombre}: <Enlaces refs={refs} />
          </span>
        </li>,
      );
    }
  }
  for (const r of repuestos) {
    filas.push(
      <li key={`rep-${r}`} data-tono="aviso">
        <Package className="icono" aria-hidden="true" />
        <span>Necesita un repuesto que falta: {r.charAt(0).toLowerCase() + r.slice(1)}</span>
      </li>,
    );
  }
  if (riesgoHeredado.length > 0) {
    filas.push(
      <li key="cadena" data-tono="aviso">
        <Link2 className="icono" aria-hidden="true" />
        <span>
          En riesgo porque depende de <Enlaces refs={riesgoHeredado} />
        </span>
      </li>,
    );
  }
  if (filas.length === 0 && todoAntesHecho && t.estado === 'abierto') {
    filas.push(
      <li key="despues" data-tono="quieto">
        <CornerDownRight className="icono" aria-hidden="true" />
        <span>
          Puede empezar: ya se hizo <Enlaces refs={paso.antes} />
        </span>
      </li>,
    );
  }
  if (filas.length === 0) return null;
  return <ul className="paso__relaciones">{filas}</ul>;
}

function agrupar(xs: PasoRecorrido['fuera']): [string, PasoRecorrido['fuera']][] {
  const m = new Map<string, PasoRecorrido['fuera']>();
  for (const x of xs) m.set(x.proyecto.nombre, [...(m.get(x.proyecto.nombre) ?? []), x]);
  return [...m];
}

export function PasoRecorridoTarjeta({ paso, ahora }: { paso: PasoRecorrido; ahora: Date }) {
  const t = paso.trabajo;
  const cuando = proximidad(t.plazo, ahora);
  return (
    <article className="paso" data-estado={t.estado}>
      <div className="paso__cabeza">
        <h4 className="paso__titulo">
          <CodigoTrabajo referencia={t.referencia} estado={t.estado} />{' '}
          <Link href={`/trabajos/${t.id}`}>{t.titulo}</Link>
        </h4>
        <p className="paso__insignias">
          <InsigniaEstado estado={t.estado} />
          {t.urgente && (
            <span className="insignia insignia--urgente">
              <Zap className="icono" aria-hidden="true" />
              Urgente
            </span>
          )}
          <InsigniaMarcas marcas={t.marcas} />
        </p>
      </div>
      <dl className="paso__datos">
        <div>
          <dt>Responsable</dt>
          <dd>{t.responsable.nombre}</dd>
        </div>
        <div>
          <dt>Plazo</dt>
          <dd>
            <time dateTime={t.plazo.toISOString()}>{formatearFecha(t.plazo)}</time>
            {t.estado !== 'resuelto' && <span className="paso__cuando" data-vencido={cuando.vencido || undefined}> · {cuando.texto}</span>}
          </dd>
        </div>
      </dl>
      <Relaciones paso={paso} />
    </article>
  );
}

/** Versión compacta para lo ya hecho: una línea con referencia, título y responsable. */
export function PasoHecho({ paso }: { paso: PasoRecorrido }) {
  const t = paso.trabajo;
  return (
    <span className="paso-hecho" data-estado={t.estado}>
      <Check className="icono" aria-hidden="true" />
      <Link href={`/trabajos/${t.id}`}>{t.titulo}</Link> <span className="ref">{t.referencia}</span>
      <span className="paso-hecho__quien"> · {t.responsable.nombre}</span>
      <span className="sr-only"> · Resuelto</span>
    </span>
  );
}
