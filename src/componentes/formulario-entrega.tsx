'use client';
// Declarar una entrega o resolver con una nota (docs/08 regla 19). Dos modos:
//  - 'entregar': el responsable de un trabajo que otra persona pidió. NO lo resuelve: lo deja entregado (nota o enlace) y
//    quien lo pidió confirma que lo recibió.
//  - 'resolver': quien puede darlo por resuelto directamente (responsable sin solicitante, o quien lo pidió). Nota obligatoria.
// Props: `trabajoId`, `cita` («Título» (REF)), `modo`, `solicitanteNombre` (solo en 'entregar', para el mensaje),
// `etiqueta` (texto del botón; por defecto «Marcar entregado» o «Resuelto»).
import { CircleAlert, PackageCheck } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionDeclararEntrega, accionResolverConNota } from '@/app/acciones/propuestas';
import { useAnunciar } from '@/componentes/resultado-pedidos';
import '@/app/mi-dia/reformas.css';

export function FormularioEntrega({
  trabajoId,
  cita,
  modo,
  solicitanteNombre,
  etiqueta,
}: {
  trabajoId: string;
  cita: string;
  modo: 'entregar' | 'resolver';
  solicitanteNombre?: string | null;
  etiqueta?: string;
}) {
  const anunciar = useAnunciar();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const base = `entrega-${trabajoId}`;
  const entregar = modo === 'entregar';
  const rotulo = etiqueta ?? (entregar ? 'Marcar entregado' : 'Resuelto');

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const nota = String(datos.get('nota') ?? '').trim();
    const enlace = String(datos.get('enlace') ?? '').trim();
    if (entregar ? !nota && !enlace : !nota) return setError('Escribe qué entregaste o pega el enlace.');
    setError(null);
    iniciar(async () => {
      const r = await (entregar ? accionDeclararEntrega : accionResolverConNota)(datos);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      anunciar?.(
        entregar
          ? `Quedó entregado ${cita}. ${solicitanteNombre ? `Falta que ${solicitanteNombre} confirme que lo recibió; ya se le preguntó.` : 'Falta que quien lo pidió confirme que lo recibió.'}`
          : `Resolviste ${cita}. Quedó registrado con tu nota.`,
      );
    });
  }

  return (
    <div className="entrega-form">
      <button
        type="button"
        className="boton"
        aria-expanded={abierto}
        aria-controls={`${base}-panel`}
        aria-label={`${rotulo}: ${cita}`}
        disabled={pendiente}
        onClick={() => {
          setAbierto((a) => !a);
          setError(null);
        }}
      >
        <PackageCheck className="icono" aria-hidden="true" />
        {rotulo}
      </button>
      {abierto && (
        <form id={`${base}-panel`} onSubmit={alEnviar} aria-busy={pendiente} className="panel-prop">
          <input type="hidden" name="trabajoId" value={trabajoId} />
          <fieldset disabled={pendiente}>
            <legend>{entregar ? `¿Qué entregaste de ${cita}?` : `¿Cómo quedó ${cita}?`}</legend>
            <div className="panel-prop__campos">
              <div className="panel-prop__ancho">
                <label htmlFor={`${base}-nota`} className="etiqueta-campo">
                  {entregar ? 'Nota (o pega el enlace abajo)' : 'Nota (obligatoria)'}
                </label>
                <textarea id={`${base}-nota`} name="nota" rows={2} maxLength={1000} className="campo" autoFocus />
              </div>
              {entregar && (
                <div className="panel-prop__ancho">
                  <label htmlFor={`${base}-enlace`} className="etiqueta-campo">
                    Enlace (opcional si escribes una nota)
                  </label>
                  <input id={`${base}-enlace`} name="enlace" type="url" placeholder="https://" className="campo" />
                </div>
              )}
            </div>
            {entregar && (
              <p className="panel-prop__aviso">
                No queda Resuelto todavía: {solicitanteNombre ?? 'quien lo pidió'} tiene que confirmar que lo recibió.
              </p>
            )}
            <div className="panel-prop__acciones">
              <button type="submit" className="boton boton--solido">
                {pendiente ? 'Guardando…' : entregar ? 'Declarar entregado' : 'Marcar resuelto'}
              </button>
              <button type="button" className="boton boton--quieto" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
            </div>
          </fieldset>
          <div aria-live="polite">
            {error && (
              <p role="alert" className="alerta">
                <CircleAlert className="icono" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
