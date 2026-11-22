// Un proyecto en la lista, leído como recorrido: cuánto falta, cómo va la secuencia, dónde está ahora y qué lo frena.
// Toda la fila lleva al detalle (el enlace del nombre la cubre); dentro no hay otros enlaces.
import { Ban, CalendarCheck, CalendarClock, CalendarX, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Referencia } from '@/componentes/enlaces-trabajos';
import { formatearFecha } from '@/dominio/formato';
import type { ProyectoRecorrido } from '@/servicios/proyectos';
import { MapaRecorrido } from './mapa-recorrido';
import { faltanDespues, plural, textoAvance, textoEtapaActual, textoFreno } from './textos';

function tonoFecha(r: ProyectoRecorrido): 'hecho' | 'vencido' | 'cerca' | 'normal' | 'sin' {
  if (r.terminado) return 'hecho';
  if (r.proximidad.dias === null) return 'sin';
  if (r.proximidad.vencido) return 'vencido';
  if (r.proximidad.dias <= 1) return 'cerca';
  return 'normal';
}

const ICONO_FECHA = { hecho: CalendarCheck, vencido: CalendarX, cerca: CalendarClock, normal: CalendarClock, sin: CalendarClock };

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function FilaProyecto({ r }: { r: ProyectoRecorrido }) {
  const tono = tonoFecha(r);
  const IconoFecha = ICONO_FECHA[tono];
  const faltan = faltanDespues(r);
  const ahoraEn = r.ahoraEn.slice(0, 2);
  const masAhora = r.ahoraEn.length - ahoraEn.length;
  const freno = r.frenos[0];
  const cuenta = {
    bloqueados: r.frenos.filter((f) => f.trabajo.estado === 'bloqueado').length,
    atrasados: r.atrasados,
    enRiesgo: r.enRiesgo,
  };

  return (
    <article className="fila-proyecto" data-tono={tono} data-frenado={r.frenos.length > 0 || undefined}>
      <div className="fila-proyecto__fecha">
        <p className="fila-proyecto__cuando">
          <IconoFecha className="icono" aria-hidden="true" />
          {r.terminado ? 'Terminado' : mayuscula(r.proximidad.texto)}
        </p>
        <p className="fila-proyecto__dia">
          {r.fecha ? <time dateTime={r.fecha.toISOString()}>{formatearFecha(r.fecha)}</time> : 'Sin fecha de entrega'}
        </p>
      </div>

      <div className="fila-proyecto__principal">
        <h3 className="fila-proyecto__nombre">
          <Link href={`/proyectos/${r.id}`}>{r.nombre}</Link> <Referencia valor={r.clave} />
        </h3>
        <p className="fila-proyecto__meta">
          {r.responsable.nombre} · {r.resultado}
        </p>
        <div className="fila-proyecto__avance">
          <MapaRecorrido etapas={r.etapas} />
          <p className="fila-proyecto__avance-texto">
            <strong>{textoAvance(r)}</strong>
            {faltan > 0 && <> · después {plural(faltan, 'trabajo más', 'trabajos más')}</>}
          </p>
        </div>
      </div>

      <div className="fila-proyecto__ahora">
        {r.total === 0 ? (
          <p className="fila-proyecto__vacio">Aún no tiene trabajos. Aparecerán aquí cuando alguien capture uno.</p>
        ) : r.terminado ? (
          <p className="fila-proyecto__listo">
            <CircleCheck className="icono" aria-hidden="true" />
            Todos sus trabajos están resueltos
          </p>
        ) : (
          <>
            <p className="fila-proyecto__etapa">
              <span className="fila-proyecto__rotulo">Ahora</span> {textoEtapaActual(r)}
              {r.ahoraEn.length > 1 && <> · {r.ahoraEn.length} a la vez</>}
            </p>
            <ul className="fila-proyecto__pasos">
              {ahoraEn.map((p) => (
                <li key={p.trabajo.id}>
                  <span className="fila-proyecto__paso">{p.trabajo.titulo}</span> <Referencia valor={p.trabajo.referencia} />
                  <span className="fila-proyecto__quien"> · {p.trabajo.responsable.nombre}</span>
                </li>
              ))}
              {masAhora > 0 && <li className="fila-proyecto__quien">y {plural(masAhora, 'trabajo más', 'trabajos más')}</li>}
            </ul>
          </>
        )}
        {freno && (
          <div className="fila-proyecto__frenos">
            <p className="fila-proyecto__freno" data-tono={freno.trabajo.estado === 'bloqueado' || freno.trabajo.marcas.atrasado ? 'critico' : 'aviso'}>
              {freno.trabajo.estado === 'bloqueado' ? (
                <Ban className="icono" aria-hidden="true" />
              ) : freno.trabajo.marcas.atrasado ? (
                <Clock className="icono" aria-hidden="true" />
              ) : (
                <TriangleAlert className="icono" aria-hidden="true" />
              )}
              <span>
                {textoFreno(freno)}
                {freno.trabajo.referencia && <span className="fila-proyecto__freno-ref"> ({freno.trabajo.referencia})</span>}
              </span>
            </p>
            <p className="insignias">
              {cuenta.bloqueados > 0 && (
                <span className="insignia insignia--estado" data-estado="bloqueado">
                  <Ban className="icono" aria-hidden="true" />
                  {plural(cuenta.bloqueados, 'bloqueado', 'bloqueados')}
                </span>
              )}
              {cuenta.atrasados > 0 && (
                <span className="insignia insignia--atrasado">
                  <Clock className="icono" aria-hidden="true" />
                  {plural(cuenta.atrasados, 'atrasado', 'atrasados')}
                </span>
              )}
              {cuenta.enRiesgo > 0 && (
                <span className="insignia insignia--riesgo">
                  <TriangleAlert className="icono" aria-hidden="true" />
                  {cuenta.enRiesgo} en riesgo
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
