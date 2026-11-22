// «Qué entendió Nexo» y «Sin convertir»: lo leído del buzón de quien mira, mensaje por mensaje.
// Nunca asunto ni remitente de lo personal o de los boletines (el servicio ni los trae). Sin ids internos: título y referencia.
import { ArrowRight, BellRing, Check, CircleCheck, CircleHelp, ExternalLink, Hourglass, Link2, MailOpen, PackageCheck, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Referencia } from '@/componentes/enlaces-trabajos';
import type { TrabajoRef } from '@/dominio/nombres';
import { formatearFecha } from '@/dominio/formato';
import type { PersonaBreve, ProveedorCorreo, ResultadoLectura } from '@/dominio/tipos';
import type { LineaCorreoVista, RemitenteVista, SinConvertirVista } from '@/servicios/vistas';

const ABRIR_EN: Record<ProveedorCorreo, string> = { gmail: 'Abrir en Gmail', outlook: 'Abrir en Outlook' };

/** Registro visual: `nexo` = lo que Nexo propone; `hecho` = ya registrado; `neutro` = sin efecto. */
const REGISTRO: Record<ResultadoLectura, { icono: LucideIcon; registro: 'nexo' | 'hecho' | 'neutro' }> = {
  propuso: { icono: Sparkles, registro: 'nexo' },
  creo: { icono: CircleCheck, registro: 'hecho' },
  reconocio: { icono: Link2, registro: 'hecho' },
  entrega: { icono: PackageCheck, registro: 'hecho' },
  espera: { icono: Hourglass, registro: 'neutro' },
  aceptacion: { icono: Check, registro: 'neutro' },
  recepcion: { icono: PackageCheck, registro: 'hecho' },
  insistencia: { icono: BellRing, registro: 'neutro' },
  sin_compromisos: { icono: MailOpen, registro: 'neutro' },
  sin_plazo: { icono: CircleHelp, registro: 'neutro' },
  sin_parte: { icono: MailOpen, registro: 'neutro' },
  descartado: { icono: MailOpen, registro: 'neutro' },
};

/** «Título» y, al lado y en pequeño, su referencia (PEDIDOS-13). Varios trabajos van separados por «;». */
function Comillas({ trabajos }: { trabajos: TrabajoRef[] }) {
  return trabajos.map((t, i) => (
    <span key={t.id}>
      {i > 0 && '; '}«<Link href={`/trabajos/${t.id}`}>{t.titulo}</Link>»{' '}
      <Referencia valor={t.referencia} />
    </span>
  ));
}

/** El resultado en una frase, con los trabajos como enlaces (título y referencia). */
function Resultado({ linea }: { linea: LineaCorreoVista }) {
  const t = linea.trabajos;
  const trabajos = t.length > 0 ? <Comillas trabajos={t} /> : null;
  switch (linea.resultado) {
    case 'propuso':
      return <>Propuso {trabajos ?? 'un trabajo'}</>;
    case 'creo':
      return (
        <>
          Creó {trabajos ?? 'un trabajo'} — lo vieron los dos buzones
        </>
      );
    case 'reconocio':
      return <>Es lo mismo que {trabajos ?? 'un trabajo que ya existía'}</>;
    case 'entrega':
      return <>Entrega de {trabajos ?? 'un trabajo'}</>;
    case 'espera':
      return <>Una espera{trabajos ? <> sobre {trabajos}</> : ' entre trabajos'}</>;
    case 'aceptacion':
      return <>Aceptó un pedido{trabajos ? <> de {trabajos}</> : ''}</>;
    case 'recepcion':
      return <>Recibido{trabajos ? <>: {trabajos}</> : ''}</>;
    case 'insistencia':
      return <>Insistió sobre {trabajos ?? 'un pedido'}</>;
    case 'sin_parte':
      return <>Pedido sin una parte de la empresa en un buzón conectado: Nexo no lo convirtió</>;
    case 'sin_plazo':
      return <>Pedido sin plazo: Nexo no lo convirtió</>;
    case 'descartado':
      return <>Descartado sin abrir</>;
    case 'sin_compromisos':
      return <>Mensaje de trabajo sin pedidos</>;
  }
}

function Nombre({ de }: { de: RemitenteVista }) {
  return (
    <>
      <strong>{de.nombre}</strong>
      {de.persona ? <span className="correo__depto"> · {de.persona.area}</span> : <span className="correo__depto"> · de fuera</span>}
    </>
  );
}

function Para({ para }: { para: PersonaBreve[] }) {
  if (para.length === 0) return <span className="correo__depto">sin destinatarios de la empresa</span>;
  if (para.length > 4) {
    return (
      <span title={para.map((p) => p.nombre).join(', ')}>
        {para
          .slice(0, 3)
          .map((p) => p.nombre)
          .join(', ')}{' '}
        y {para.length - 3} más
      </span>
    );
  }
  return <>{para.map((p) => p.nombre).join(', ')}</>;
}

export function ListaLineas({ lineas, proveedor }: { lineas: LineaCorreoVista[]; proveedor: ProveedorCorreo | null }) {
  return (
    <ol className="entendido">
      {lineas.map((l, i) => {
        const { icono: Icono, registro } = REGISTRO[l.resultado];
        return (
          <li key={`${l.en.toISOString()}-${i}`} className="entendido__linea" data-registro={registro}>
            <time className="entendido__hora" dateTime={l.en.toISOString()}>
              {formatearFecha(l.en)}
            </time>
            <div className="entendido__cuerpo">
              <p className="entendido__ruta">
                <Nombre de={l.de} />
                <ArrowRight className="icono" aria-hidden="true" />
                <Para para={l.para} />
              </p>
              <p className="entendido__resultado">
                <Icono className="icono" aria-hidden="true" />
                <span>
                  <Resultado linea={l} />
                </span>
              </p>
              <blockquote className="entendido__cita">{l.cita}</blockquote>
              {l.enlace && (
                <a className="entendido__abrir" href={l.enlace} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="icono" aria-hidden="true" />
                  {ABRIR_EN[proveedor ?? 'gmail']}
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ListaSinConvertir({ pedidos }: { pedidos: SinConvertirVista[] }) {
  return (
    <ul className="lista">
      {pedidos.map((p, i) => (
        <li key={`${p.en.toISOString()}-${i}`} className="sin-convertir">
          <p className="entendido__ruta">
            <time dateTime={p.en.toISOString()}>{formatearFecha(p.en)}</time>
            <span aria-hidden="true">·</span>
            <Nombre de={p.de} />
          </p>
          <blockquote className="entendido__cita">{p.cita}</blockquote>
          <p className="sin-convertir__pregunta">
            <CircleHelp className="icono" aria-hidden="true" />
            <strong>¿Para cuándo?</strong> Nexo no inventa plazos: no lo convirtió en trabajo.
          </p>
        </li>
      ))}
    </ul>
  );
}
