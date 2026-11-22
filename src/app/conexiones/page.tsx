// Conexiones (docs/08 §6): de dónde saca Nexo el trabajo. Hoy, los buzones de correo de la empresa. El correo alimenta al
// motor (cada pedido leído es un trabajo normal); aquí se ve qué buzones están conectados, qué leyó Nexo del buzón de quien
// mira y qué pedidos quedaron sin plazo. Usa el «Ver como» general de la barra lateral.
import { Inbox, MailX } from 'lucide-react';
import { ListaLineas, ListaSinConvertir } from '@/componentes/correo/lineas-correo';
import { TablaBuzones } from '@/componentes/correo/tabla-buzones';
import { formatearFecha } from '@/dominio/formato';
import { obtenerVistaCorreo } from '@/servicios/correo';
import { obtenerContextoApp, personaActual } from '@/servidor/contexto-app';
import './conexiones.css';

function Cuenta({ n }: { n: number }) {
  return <span className="seccion__cuenta">{n}</span>;
}

export default async function PaginaConexiones() {
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
        <h1 className="pagina__titulo">Conexiones</h1>
        <p className="pagina__sub">
          De dónde saca Nexo el trabajo: hoy, los buzones de correo de la empresa, Gmail y Outlook.{' '}
          <time dateTime={vista.ahora.toISOString()}>{formatearFecha(vista.ahora)}</time>.
        </p>
        <p className="aviso-prototipo">
          <Inbox className="icono" aria-hidden="true" />
          Prototipo: correos de ejemplo, solo cuentas de la empresa. Lo personal y los boletines se descartan sin abrirse.
        </p>
      </header>

      <section aria-labelledby="co-buzones" className="seccion">
        <h2 id="co-buzones" className="seccion__titulo">
          Buzones conectados <Cuenta n={conectados} />
        </h2>
        {conectados === 0 ? (
          <p className="vacio">
            Ningún buzón conectado: reinicia la demo. Mientras tanto, Nexo no lee correo y los trabajos salen solo de la captura.
          </p>
        ) : (
          <p className="seccion__nota">
            {conectados} de {vista.buzones.length} personas tienen el buzón conectado. De lo descartado solo se cuenta.
          </p>
        )}
        <TablaBuzones buzones={vista.buzones} quienMira={personaId} />
      </section>

      <section aria-labelledby="co-entendio" className="seccion">
        <h2 id="co-entendio" className="seccion__titulo">
          Lo que Nexo leyó de tu buzón <Cuenta n={lineas.length} />
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
          Pedidos sin plazo <Cuenta n={vista.sinConvertir.length} />
        </h2>
        {vista.sinConvertir.length === 0 ? (
          <p className="vacio">Ningún pedido de este buzón se quedó sin plazo.</p>
        ) : (
          <ListaSinConvertir pedidos={vista.sinConvertir} />
        )}
      </section>
    </>
  );
}
