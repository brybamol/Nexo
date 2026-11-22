'use client';
// Las tres acciones sobre una propuesta de Nexo (docs/08 regla 16): Confirmar, Corregir y Descartar, sin salir de la página.
// Confirmar y corregir son azul (esperan a una persona; al enviar, queda confirmado); descartar pide una confirmación ligera.
// Los errores se ven junto al formulario (role="alert"); el resultado se anuncia en ResultadoPedidos (role="status").
// Props: ver `DatosAcciones`. Los textos de los avisos solo dicen lo que garantiza la regla 16.
import { Check, CircleAlert, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionRevisarPropuesta, type ResultadoPropuesta } from '@/app/acciones/propuestas';
import { useAnunciar } from '@/componentes/resultado-pedidos';
import '@/app/mi-dia/reformas.css';

export interface DatosAccionesPropuesta {
  trabajoId: string;
  /** «Título» (REFERENCIA), ya formateado. */
  cita: string;
  yoId: string;
  titulo: string;
  responsableId: string;
  proyectoId: string;
  /** Plazo actual en Costa Rica: 'AAAA-MM-DD' y 'HH:mm'. */
  plazoFecha: string;
  plazoHora: string;
  hoy: string;
  /** Quien pidió el trabajo (puede ser null) y quien lo entregó, si ya hay entrega. */
  solicitanteId: string | null;
  solicitanteNombre: string | null;
  entregadoPor: string | null;
  personas: { id: string; nombre: string; rol: string }[];
  proyectos: { id: string; nombre: string }[];
}

type Panel = 'corregir' | 'descartar' | null;

const ETIQUETA_CAMPO = { titulo: 'el título', responsableId: 'el responsable', plazo: 'el plazo', proyectoId: 'el proyecto' } as const;

export function AccionesPropuesta({ d }: { d: DatosAccionesPropuesta }) {
  const anunciar = useAnunciar();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const base = `prop-${d.trabajoId}`;
  const nombreDe = (id: string) => d.personas.find((p) => p.id === id)?.nombre ?? 'la persona elegida';

  function enviar(datos: FormData, mensaje: (r: ResultadoPropuesta) => string) {
    setError(null);
    iniciar(async () => {
      const r = await accionRevisarPropuesta(datos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPanel(null);
      anunciar?.(mensaje(r));
    });
  }

  /** Lo que sigue a confirmar o corregir (regla 16): el aviso de asignación y la recepción. */
  function consecuencia(responsableFinal: string): string {
    if (d.entregadoPor) {
      if (d.solicitanteId === d.yoId) return ` ${d.entregadoPor} ya lo había entregado: confirma que lo recibiste.`;
      if (d.solicitanteNombre) return ` Se le preguntó a ${d.solicitanteNombre} si lo recibió.`;
      return '';
    }
    return responsableFinal !== d.yoId ? ` Se le avisó a ${nombreDe(responsableFinal)}.` : '';
  }

  function confirmar() {
    const datos = new FormData();
    datos.set('trabajoId', d.trabajoId);
    datos.set('tipo', 'confirmar');
    enviar(datos, () => `Confirmaste ${d.cita}: ya es un trabajo y todos lo ven.${consecuencia(d.responsableId)}`);
  }

  function alCorregir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    const datos = new FormData();
    datos.set('trabajoId', d.trabajoId);
    datos.set('tipo', 'corregir');
    const cambiados: string[] = [];
    if (v('titulo') !== d.titulo) {
      datos.set('titulo', v('titulo'));
      cambiados.push(ETIQUETA_CAMPO.titulo);
    }
    if (v('responsableId') !== d.responsableId) {
      datos.set('responsableId', v('responsableId'));
      cambiados.push(ETIQUETA_CAMPO.responsableId);
    }
    if (v('fecha') !== d.plazoFecha || v('hora') !== d.plazoHora) {
      datos.set('fecha', v('fecha'));
      datos.set('hora', v('hora'));
      cambiados.push(ETIQUETA_CAMPO.plazo);
    }
    if (v('proyectoId') !== d.proyectoId) {
      datos.set('proyectoId', v('proyectoId'));
      cambiados.push(ETIQUETA_CAMPO.proyectoId);
    }
    if (cambiados.length === 0) return setError('No cambiaste nada. Cambia al menos un dato o usa Confirmar.');
    const final = v('responsableId') || d.responsableId;
    enviar(
      datos,
      () => `Corregiste ${cambiados.join(', ')} de ${d.cita} y quedó confirmado.${consecuencia(final)}`,
    );
  }

  function alDescartar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.set('trabajoId', d.trabajoId);
    datos.set('tipo', 'descartar');
    enviar(datos, () => `Descartaste ${d.cita}. Nexo no lo volverá a proponer.`);
  }

  function abrir(p: Exclude<Panel, null>) {
    setPanel((a) => (a === p ? null : p));
    setError(null);
  }

  return (
    <div className="acciones-prop" role="group" aria-label={`Revisar la propuesta ${d.cita}`}>
      <div className="acciones-prop__botones">
        <button type="button" className="boton boton--solido" disabled={pendiente} onClick={confirmar}>
          <Check className="icono" aria-hidden="true" />
          {pendiente && panel === null ? 'Confirmando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          className="boton"
          aria-expanded={panel === 'corregir'}
          aria-controls={`${base}-panel`}
          disabled={pendiente}
          onClick={() => abrir('corregir')}
        >
          <Pencil className="icono" aria-hidden="true" />
          Corregir
        </button>
        <button
          type="button"
          className="boton boton--quieto"
          aria-expanded={panel === 'descartar'}
          aria-controls={`${base}-panel`}
          disabled={pendiente}
          onClick={() => abrir('descartar')}
        >
          <Trash2 className="icono" aria-hidden="true" />
          Descartar
        </button>
      </div>

      {panel === 'corregir' && (
        <form id={`${base}-panel`} onSubmit={alCorregir} aria-busy={pendiente} className="panel-prop">
          <fieldset disabled={pendiente}>
            <legend>Corrige lo que Nexo entendió mal</legend>
            <div className="panel-prop__campos">
              <div className="panel-prop__ancho">
                <label htmlFor={`${base}-titulo`} className="etiqueta-campo">
                  Título
                </label>
                <input id={`${base}-titulo`} name="titulo" defaultValue={d.titulo} maxLength={200} required className="campo" autoFocus />
              </div>
              <div>
                <label htmlFor={`${base}-resp`} className="etiqueta-campo">
                  Responsable
                </label>
                <select id={`${base}-resp`} name="responsableId" defaultValue={d.responsableId} className="campo">
                  {d.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {p.rol}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${base}-proy`} className="etiqueta-campo">
                  Proyecto
                </label>
                <select id={`${base}-proy`} name="proyectoId" defaultValue={d.proyectoId} className="campo">
                  {d.proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${base}-fecha`} className="etiqueta-campo">
                  Plazo: fecha
                </label>
                <input id={`${base}-fecha`} name="fecha" type="date" required defaultValue={d.plazoFecha} className="campo" />
              </div>
              <div>
                <label htmlFor={`${base}-hora`} className="etiqueta-campo">
                  Plazo: hora (Costa Rica)
                </label>
                <input id={`${base}-hora`} name="hora" type="time" required step={300} defaultValue={d.plazoHora} className="campo" />
              </div>
            </div>
            <div className="panel-prop__acciones">
              <button type="submit" className="boton boton--solido">
                <Check className="icono" aria-hidden="true" />
                {pendiente ? 'Guardando…' : 'Guardar y confirmar'}
              </button>
              <button type="button" className="boton boton--quieto" onClick={() => abrir('corregir')}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {panel === 'descartar' && (
        <form id={`${base}-panel`} onSubmit={alDescartar} aria-busy={pendiente} className="panel-prop">
          <fieldset disabled={pendiente}>
            <legend>¿Descartar esta propuesta?</legend>
            <p className="panel-prop__aviso">Nexo no la volverá a proponer y nadie más la verá.</p>
            <label htmlFor={`${base}-motivo`} className="etiqueta-campo">
              Motivo (opcional)
            </label>
            <textarea id={`${base}-motivo`} name="motivo" rows={2} maxLength={1000} className="campo" autoFocus />
            <div className="panel-prop__acciones">
              <button type="submit" className="boton boton--peligro boton--solido">
                <Trash2 className="icono" aria-hidden="true" />
                {pendiente ? 'Descartando…' : 'Sí, descartar'}
              </button>
              <button type="button" className="boton boton--quieto" onClick={() => abrir('descartar')}>
                Volver
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <div aria-live="polite">
        {error && (
          <p role="alert" className="alerta">
            <CircleAlert className="icono" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
