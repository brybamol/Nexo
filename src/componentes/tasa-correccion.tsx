// «Cuánto se equivoca Nexo» (docs/08 regla 22 y §6). Componente de servidor, reutilizable en Correo, Registro y Proyectos.
// Con `tasa === null` no se inventa nada: «Todavía no lo sé…».
import type { CampoCorregible, TasaCorreccion as Tasa } from '@/dominio/tipos';
import '@/app/correo/correo.css';

const CAMPOS: { campo: CampoCorregible; etiqueta: string }[] = [
  { campo: 'titulo', etiqueta: 'título' },
  { campo: 'responsable', etiqueta: 'responsable' },
  { campo: 'plazo', etiqueta: 'plazo' },
  { campo: 'proyecto', etiqueta: 'proyecto' },
];

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? uno : varios;
}

/** Frase completa de la tasa, sin la cifra (la usan las dos variantes). */
export function FraseTasa({ tasa }: { tasa: Tasa }) {
  if (tasa.tasa === null) {
    return <>Todavía no lo sé: nadie ha revisado lo que Nexo propuso.</>;
  }
  const porCampo = CAMPOS.filter((c) => tasa.porCampo[c.campo] > 0)
    .map((c) => `${c.etiqueta}: ${tasa.porCampo[c.campo]}`)
    .join(', ');
  return (
    <>
      De {tasa.revisadas} {plural(tasa.revisadas, 'propuesta revisada', 'propuestas revisadas')}, {tasa.confirmadas}{' '}
      {plural(tasa.confirmadas, 'se confirmó', 'se confirmaron')} tal cual, {tasa.corregidas}{' '}
      {plural(tasa.corregidas, 'se corrigió', 'se corrigieron')}
      {porCampo ? ` (${porCampo})` : ''} y {tasa.descartadas} {plural(tasa.descartadas, 'se descartó', 'se descartaron')} · tasa de
      corrección <span className="num">{tasa.tasa} %</span>.
      {tasa.confirmadasPorFuentes > 0 && (
        <>
          {' '}
          Además, {tasa.confirmadasPorFuentes} {plural(tasa.confirmadasPorFuentes, 'confirmada', 'confirmadas')} por dos buzones sin
          revisión de una persona.
        </>
      )}
    </>
  );
}

/**
 * Props: `tasa` (TasaCorreccion de obtenerTasaCorreccion o VistaCorreo.tasa); `compacta` (solo la línea de texto, sin cifra:
 * para Registro y Proyectos).
 */
export function TasaCorreccion({ tasa, compacta = false }: { tasa: Tasa; compacta?: boolean }) {
  const pendientes =
    tasa.sinRevisar > 0 ? (
      <>
        {' '}
        {tasa.sinRevisar} {plural(tasa.sinRevisar, 'propuesta espera', 'propuestas esperan')} revisión.
      </>
    ) : null;
  if (compacta) {
    return (
      <p className="tasa tasa--compacta">
        <strong>Cuánto se equivoca Nexo:</strong> <FraseTasa tasa={tasa} />
        {pendientes}
      </p>
    );
  }
  return (
    <div className="tasa" data-sin-dato={tasa.tasa === null ? 'si' : undefined}>
      <p className="tasa__cifra" aria-hidden="true">
        {tasa.tasa === null ? '—' : `${tasa.tasa} %`}
      </p>
      <p className="tasa__texto">
        <FraseTasa tasa={tasa} />
        {pendientes}
      </p>
    </div>
  );
}
