// Correo (docs/06 §10): lo que Nexo reconstruyó de los buzones de Frío del Valle, sin que nadie creara tareas.
// Tiene su propio «ver como» (?como=<id>) porque las personas no son las de Frío del Valle.
import { ArrowRight, Inbox, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { TarjetaCompromiso } from '@/componentes/correo/tarjeta-compromiso';
import { Referencia } from '@/componentes/enlaces-trabajos';
import { PERSONA_CORREO_POR_DEFECTO } from '@/correo/ejemplo/empresa';
import { personasDeCadena } from '@/correo/modelo';
import type { CompromisoConMarcas, ModeloCorreo, Proveedor } from '@/correo/tipos';
import { formatearFecha } from '@/dominio/formato';
import { obtenerModeloCorreo, personaCorreoValida, vistaPersonaCorreo } from '@/servicios/correo';
import { obtenerContextoApp } from '@/servidor/contexto-app';

const NOMBRE_PROVEEDOR: Record<Proveedor, string> = { gmail: 'Gmail', outlook: 'Outlook' };

function Cuenta({ n }: { n: number }) {
  return <span className="seccion__cuenta">{n}</span>;
}

function Lista({ items, modelo, como, vacio }: { items: CompromisoConMarcas[]; modelo: ModeloCorreo; como: string; vacio: string }) {
  if (items.length === 0) return <p className="vacio">{vacio}</p>;
  return (
    <ul className="lista">
      {items.map((c) => (
        <li key={c.id}>
          <TarjetaCompromiso c={c} modelo={modelo} como={como} />
        </li>
      ))}
    </ul>
  );
}

function Cadenas({ modelo }: { modelo: ModeloCorreo }) {
  const personas = new Map(modelo.empresa.personas.map((p) => [p.id, p]));
  const porId = new Map(modelo.compromisos.map((c) => [c.id, c]));
  const conCadenas = modelo.proyectos.filter((p) => p.cadenas.length > 0);
  if (conCadenas.length === 0) return <p className="vacio">Nadie está esperando a otra persona ahora.</p>;
  return (
    <div className="cadenas">
      {conCadenas.map((p) => (
        <div key={p.nombre} className="tarjeta cadenas__proyecto">
          <h3 className="cadenas__titulo">{p.nombre}</h3>
          {p.cadenas.map((k) => {
            const gente = personasDeCadena(k, modelo.compromisos);
            const eslabones = k.compromisoIds.map((id) => porId.get(id)).filter((c): c is CompromisoConMarcas => !!c);
            return (
              <ol key={k.compromisoIds.join('-')} className="cadena" aria-label={`Cadena de espera de ${p.nombre}`}>
                {gente.map((id, i) => {
                  const persona = personas.get(id);
                  const debe = eslabones.find((c) => c.responsableId === id);
                  return (
                    <li key={`${id}-${i}`} className="cadena__eslabon">
                      {i > 0 && <ArrowRight className="icono cadena__flecha" aria-hidden="true" />}
                      <span className="cadena__persona" data-ultimo={i === gente.length - 1 ? 'si' : undefined}>
                        <strong>{persona?.nombre ?? id}</strong>
                        <span className="correo__depto">{persona?.departamento}</span>
                        {debe ? (
                          <>
                            <a href={`#${debe.id}`} className="cadena__debe" data-estado={debe.estado}>
                              {debe.titulo}
                            </a>
                            <span className="cadena__debe">
                              {debe.marcas.atrasado ? 'atrasado' : debe.estado === 'bloqueado' ? 'bloqueado' : debe.marcas.enRiesgo ? 'en riesgo' : 'pendiente'}
                              {debe.referencia && (
                                <>
                                  {' · '}
                                  <Referencia valor={debe.referencia} />
                                </>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="cadena__debe">espera</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            );
          })}
        </div>
      ))}
      {modelo.cuellos.map((k) => {
        const persona = personas.get(k.personaId);
        return (
          <p key={k.personaId} className="cuello">
            <TriangleAlert className="icono" aria-hidden="true" />
            <span>
              <strong>{persona?.nombre}</strong> ({persona?.departamento}) aparece en {k.cadenas} cadenas de espera
              {k.proyectos.length > 1 ? `, en ${k.proyectos.join(' y ')}` : ''}. Destrabar lo suyo acelera a todos los que esperan detrás.
            </span>
          </p>
        );
      })}
    </div>
  );
}

function Buzones({ modelo }: { modelo: ModeloCorreo }) {
  const personas = new Map(modelo.empresa.personas.map((p) => [p.id, p]));
  return (
    <>
      <p className="pagina__sub">
        Solo cuentas de la empresa (Google Workspace), nunca cuentas personales de Gmail. Lo que no es de trabajo (correo
        personal, promociones y boletines) se descarta sin abrirse: aquí solo se cuenta. Los borradores, el spam y la
        papelera no se leen. De lo laboral, Nexo guarda lo que se pidió, una cita corta y el enlace al correo, que solo abre
        quien lo tiene en su buzón.
      </p>
      <div className="tabla-envoltura" role="region" aria-labelledby="co-buzones" tabIndex={0}>
        <table className="tabla buzones">
          <thead>
            <tr>
              <th scope="col">Buzón</th>
              <th scope="col">Leídos</th>
              <th scope="col">De trabajo</th>
              <th scope="col">Personales descartados</th>
              <th scope="col">Boletines descartados</th>
            </tr>
          </thead>
          <tbody>
            {modelo.conteos.map((k) => (
              <tr key={k.personaId}>
                <th scope="row">
                  {personas.get(k.personaId)?.nombre}{' '}
                  <span className="correo__depto">
                    · {personas.get(k.personaId)?.departamento} · {NOMBRE_PROVEEDOR[k.proveedor]}
                  </span>
                </th>
                <td>{k.leidos}</td>
                <td>{k.laborales}</td>
                <td>{k.personales}</td>
                <td>{k.boletines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function PaginaCorreo({ searchParams }: { searchParams: Promise<{ [clave: string]: string | string[] | undefined }> }) {
  const pedido = (await searchParams).como;
  const como = personaCorreoValida(typeof pedido === 'string' ? pedido : null)?.id ?? PERSONA_CORREO_POR_DEFECTO;
  const ctx = await obtenerContextoApp();
  const modelo = await obtenerModeloCorreo(ctx);
  const vista = vistaPersonaCorreo(modelo, como);

  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Correo · Frío del Valle</h1>
        <p className="pagina__sub">
          Nadie creó estas tareas: Nexo las sacó de los correos de cada buzón conectado y une lo que ve cada departamento.{' '}
          <time dateTime={modelo.ahora.toISOString()}>{formatearFecha(modelo.ahora)}</time>.
        </p>
        <p className="aviso-prototipo">
          <Inbox className="icono" aria-hidden="true" />
          Prototipo: correos ficticios con el formato de la API de Gmail (cuentas de Google Workspace), leídos por un intérprete
          local. Todavía no se conecta a un buzón real.
        </p>
      </header>

      <nav aria-label="Ver como (Frío del Valle)" className="ver-como">
        <span className="etiqueta-campo">Ver como</span>
        <ul className="ver-como__lista">
          {modelo.empresa.personas.map((p) => (
            <li key={p.id}>
              <Link href={`/correo?como=${p.id}`} aria-current={p.id === como ? 'page' : undefined} className="ver-como__persona">
                {p.nombre}
                <span className="correo__depto">{p.departamento}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="co-cadenas" className="seccion">
        <h2 id="co-cadenas" className="seccion__titulo">
          Quién espera a quién
        </h2>
        <Cadenas modelo={modelo} />
      </section>

      <section aria-labelledby="co-piden" className="seccion">
        <h2 id="co-piden" className="seccion__titulo">
          Te piden <Cuenta n={vista.tePiden.length} />
        </h2>
        <Lista items={vista.tePiden} modelo={modelo} como={como} vacio="Nadie te está pidiendo nada por correo." />
      </section>

      <section aria-labelledby="co-esperas" className="seccion">
        <h2 id="co-esperas" className="seccion__titulo">
          Pediste y esperas <Cuenta n={vista.esperas.length} />
        </h2>
        <Lista items={vista.esperas} modelo={modelo} como={como} vacio="No estás esperando nada de otras personas." />
      </section>

      {vista.resueltos.length > 0 && (
        <section aria-labelledby="co-resueltos" className="seccion">
          <h2 id="co-resueltos" className="seccion__titulo">
            Resuelto <Cuenta n={vista.resueltos.length} />
          </h2>
          <Lista items={vista.resueltos} modelo={modelo} como={como} vacio="" />
        </section>
      )}

      <section aria-labelledby="co-buzones" className="seccion">
        <h2 id="co-buzones" className="seccion__titulo">
          <ShieldCheck className="icono" aria-hidden="true" />
          Buzones conectados
        </h2>
        <Buzones modelo={modelo} />
      </section>
    </>
  );
}
