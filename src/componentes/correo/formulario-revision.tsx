'use client';
// Confirmar, corregir o descartar un compromiso que Nexo extrajo del correo (docs/06 §10).
// Props: `como` (persona que revisa), `compromiso` (datos actuales ya serializados), `personas` (para el responsable).
import { Check, PencilLine, Trash2 } from 'lucide-react';
import { useState, useTransition, type FormEvent } from 'react';
import { accionRevisarCompromiso } from '@/app/acciones/correo';

export interface DatosRevision {
  id: string;
  codigo: string;
  titulo: string;
  responsableId: string | null;
  plazoLocal: string; // AAAA-MM-DDTHH:MM en hora de Costa Rica, o ''
  estado: string;
  confirmado: boolean;
}

const ESTADOS = [
  { valor: 'abierto', texto: 'Abierto' },
  { valor: 'en_curso', texto: 'En curso' },
  { valor: 'bloqueado', texto: 'Bloqueado' },
  { valor: 'resuelto', texto: 'Resuelto' },
];

export function FormularioRevision({
  como,
  compromiso,
  personas,
}: {
  como: string;
  compromiso: DatosRevision;
  personas: { id: string; nombre: string; departamento: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [pendiente, iniciar] = useTransition();

  function enviar(datos: FormData) {
    datos.set('como', como);
    datos.set('compromisoId', compromiso.id);
    setError(null);
    iniciar(async () => {
      const r = await accionRevisarCompromiso(datos);
      setError(r.ok ? null : r.error);
      if (r.ok) setConfirmarDescarte(false);
    });
  }

  function simple(tipo: 'confirmar' | 'descartar') {
    const datos = new FormData();
    datos.set('tipo', tipo);
    enviar(datos);
  }

  function alCorregir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    datos.set('tipo', 'corregir');
    enviar(datos);
  }

  const p = `rev-${compromiso.id}`;
  return (
    <div className="revision" aria-busy={pendiente}>
      <div className="revision__botones">
        {!compromiso.confirmado && (
          <button type="button" className="boton" disabled={pendiente} onClick={() => simple('confirmar')}>
            <Check className="icono" aria-hidden="true" />
            Confirmar
          </button>
        )}
        <details className="revision__corregir">
          <summary className="boton">
            <PencilLine className="icono" aria-hidden="true" />
            Corregir
          </summary>
          <form onSubmit={alCorregir} className="responder__panel revision__panel">
            <fieldset disabled={pendiente}>
              <legend>Corregir {compromiso.codigo}</legend>
              <div className="revision__campos">
                <div className="revision__campo--ancho">
                  <label htmlFor={`${p}-titulo`} className="etiqueta-campo">
                    Qué se pidió
                  </label>
                  <input id={`${p}-titulo`} name="titulo" defaultValue={compromiso.titulo} maxLength={160} className="campo" />
                </div>
                <div>
                  <label htmlFor={`${p}-resp`} className="etiqueta-campo">
                    Quién lo hace
                  </label>
                  <select id={`${p}-resp`} name="responsableId" defaultValue={compromiso.responsableId ?? ''} className="campo">
                    {personas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre} · {x.departamento}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${p}-plazo`} className="etiqueta-campo">
                    Plazo
                  </label>
                  <input id={`${p}-plazo`} type="datetime-local" name="plazo" defaultValue={compromiso.plazoLocal} className="campo" />
                </div>
                <div>
                  <label htmlFor={`${p}-estado`} className="etiqueta-campo">
                    Estado
                  </label>
                  <select id={`${p}-estado`} name="estado" defaultValue={compromiso.estado} className="campo">
                    {ESTADOS.map((x) => (
                      <option key={x.valor} value={x.valor}>
                        {x.texto}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="responder__acciones">
                <button type="submit" className="boton boton--solido">
                  {pendiente ? 'Guardando…' : 'Guardar corrección'}
                </button>
              </div>
            </fieldset>
          </form>
        </details>
        {confirmarDescarte ? (
          <span className="revision__descarte">
            <span>¿Descartar {compromiso.codigo}? Deja de verse para todos.</span>
            <button type="button" className="boton boton--peligro" disabled={pendiente} onClick={() => simple('descartar')}>
              Sí, descartar
            </button>
            <button type="button" className="boton boton--quieto" disabled={pendiente} onClick={() => setConfirmarDescarte(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" className="boton boton--quieto" disabled={pendiente} onClick={() => setConfirmarDescarte(true)}>
            <Trash2 className="icono" aria-hidden="true" />
            Descartar
          </button>
        )}
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="alerta">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
