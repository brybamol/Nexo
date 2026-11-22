// Correo · Lo que Nexo lee (docs/08 §6): la vista de la FUENTE. El correo alimenta al motor (cada pedido leído es un trabajo
// normal); aquí se ve qué buzones están conectados, qué leyó Nexo del buzón de quien mira, qué propuso, qué reconoció, qué no
// pudo convertir y quién espera a quién. Usa el «Ver como» general de la barra lateral.
import { Inbox, MailX } from 'lucide-react';
import { Esperas } from '@/componentes/correo/esperas';
import { ListaLineas, ListaSinConvertir } from '@/componentes/correo/lineas-correo';
import { TablaBuzones } from '@/componentes/correo/tabla-buzones';
import { TasaCorreccion } from '@/componentes/tasa-correccion';
import { formatearFecha } from '@/dominio/formato';
import { obtenerVistaCorreo } from '@/servicios/correo';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import './correo.css';

function Cuenta({ n }: { n: number }) {
  return <span className="seccion__cuenta">{n}</span>;
}

export default async function PaginaCorreo() {
  const ctx = await obtenerContextoApp();
  const personaId = await personaActual();
  const vista = await obtenerVistaCorreo(ctx, personaId);

  const yo = vista.buzones.find((b) => b.persona.id === personaId);
  const conectados = vista.buzones.filter((b) => b.conectado).length;
  const lineas = vista.lineas.filter((l) => l.resultado !== 'sin_plazo');
  const nombre = yo?.persona.nombre ?? 'esta persona';

  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Correo · Lo que Nexo lee</h1>
        <p className="pagina__sub">
          Nadie escribió estas tareas: Nexo las saca de los correos de los buzones conectados y las vuelve trabajos, igual que los
          que nacen de una frase. Aquí ves la fuente.{' '}
          <time dateTime={vista.ahora.toISOString()}>{formatearFecha(vista.ahora)}</time>.
        </p>
        <p className="aviso-prototipo">
          <Inbox className="icono" aria-hidden="true" />
          Prototipo: correos ficticios con el formato de la API de Gmail y Outlook, leídos por un intérprete local. Solo cuentas
          de la empresa. Lo personal y los boletines se descartan sin abrirse; los borradores, el spam y la papelera no se leen.
        </p>
      </header>

      <section aria-labelledby="co-buzones" className="seccion">
        <h2 id="co-buzones" className="seccion__titulo">
          Buzones <Cuenta n={conectados} />
        </h2>
        {conectados === 0 ? (
          <p className="vacio">
            Ningún buzón conectado: reinicia la demo. Mientras tanto, Nexo no lee correo y los trabajos salen solo de la captura.
          </p>
        ) : (
          <p className="seccion__nota">
            {conectados} de {vista.buzones.length} personas tienen el buzón conectado. De lo descartado aquí solo se cuenta: nunca
            se guarda ni se muestra el asunto ni el remitente.
          </p>
        )}
        <TablaBuzones buzones={vista.buzones} quienMira={personaId} />
      </section>

      <section aria-labelledby="co-entendio" className="seccion">
        <h2 id="co-entendio" className="seccion__titulo">
          Qué entendió Nexo <Cuenta n={lineas.length} />
        </h2>
        {yo && !yo.conectado ? (
          <div className="vacio vacio--fuente">
            <MailX className="icono" aria-hidden="true" />
            <p>
              <strong>El buzón de {nombre} no está conectado.</strong> Nexo no lee su correo, así que aquí no hay nada que mostrar.
              Los trabajos que le tocan siguen llegando por la captura, o por el correo de otras personas si lo piden.
            </p>
          </div>
        ) : lineas.length === 0 ? (
          <p className="vacio">
            Nexo todavía no ha leído mensajes de trabajo de este buzón. Nexo lee el correo cuando el reloj de la demo avanza.
          </p>
        ) : (
          <ListaLineas lineas={lineas} proveedor={yo?.proveedor ?? null} />
        )}
      </section>

      <section aria-labelledby="co-sin-convertir" className="seccion">
        <h2 id="co-sin-convertir" className="seccion__titulo">
          Sin convertir <Cuenta n={vista.sinConvertir.length} />
        </h2>
        {vista.sinConvertir.length === 0 ? (
          <p className="vacio">Ningún pedido de este buzón se quedó sin plazo.</p>
        ) : (
          <ListaSinConvertir pedidos={vista.sinConvertir} />
        )}
      </section>

      <section aria-labelledby="co-esperas" className="seccion">
        <h2 id="co-esperas" className="seccion__titulo">
          Quién espera a quién
        </h2>
        <p className="seccion__nota">Calculado sobre los trabajos que ves, vengan del correo o de la captura.</p>
        <Esperas esperas={vista.esperas} />
      </section>

      <section aria-labelledby="co-tasa" className="seccion">
        <h2 id="co-tasa" className="seccion__titulo">
          Cuánto se equivoca Nexo
        </h2>
        <TasaCorreccion tasa={vista.tasa} />
      </section>
    </>
  );
}
