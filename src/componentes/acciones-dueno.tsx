'use client';
// El dueño del resultado actúa (reforma de escalamiento, regla 2): Reasignar, Mover el plazo y Declarar bloqueo.
// `AccionesDueno` se muestra solo a quien puede actuar (lo decide el servidor con obtenerPermisosActuar, y lo vuelve a
// validar al ejecutar). Cada acción abre un formulario; enviar pide una confirmación ligera y, al confirmar, llama a la
// Server Action. Los errores se ven junto al formulario (role="alert"). El resultado se anuncia en `ResultadoAcciones`
// (role="status"), que vive fuera de la tarjeta: tras actuar, el trabajo puede salir de la lista y la tarjeta desmontarse.
// Props de AccionesDueno: `trabajoId`, `titulo`, `razon` (por qué puede actuar), `responsableId`, `personas`
// (para el selector), `plazoFecha` 'AAAA-MM-DD' y `plazoHora` 'HH:mm' (plazo actual en Costa Rica), `hoy` 'AAAA-MM-DD'.
import { Ban, CalendarClock, Check, CircleAlert, CircleCheck, UserRoundPen } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { accionDeclararBloqueo, accionMoverPlazo, accionReasignar, type ResultadoIntervencionUI } from '@/app/acciones/trabajos';

type Tipo = 'reasignar' | 'plazo' | 'bloqueo';
type Anuncio = { id: number; mensaje: string; avisosA: string[] };

const AnunciarContexto = createContext<((a: Omit<Anuncio, 'id'>) => void) | null>(null);

/** Región de resultado de las acciones del dueño, estable entre recargas de la página. Envuelve la página. */
export function ResultadoAcciones({ children }: { children: ReactNode }) {
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (anuncio) ref.current?.focus();
  }, [anuncio]);
  return (
    <AnunciarContexto.Provider value={(a) => setAnuncio((prev) => ({ ...a, id: (prev?.id ?? 0) + 1 }))}>
      <div aria-live="polite" className="dueno-resultado">
        {anuncio && (
          <div key={anuncio.id} ref={ref} tabIndex={-1} role="status" className="aviso-ok">
            <CircleCheck className="icono" aria-hidden="true" />
            <p>
              {anuncio.mensaje}
              {anuncio.avisosA.length > 0 ? <> Se avisó a: {anuncio.avisosA.join(', ')}.</> : <> No hizo falta avisar a nadie más.</>}{' '}
              <button type="button" className="enlace-boton" onClick={() => setAnuncio(null)}>
                Cerrar
              </button>
            </p>
          </div>
        )}
      </div>
      {children}
    </AnunciarContexto.Provider>
  );
}

const ETIQUETA: Record<Tipo, string> = { reasignar: 'Reasignar', plazo: 'Mover el plazo', bloqueo: 'Declarar bloqueo' };
const ICONO: Record<Tipo, typeof Ban> = { reasignar: UserRoundPen, plazo: CalendarClock, bloqueo: Ban };

export function AccionesDueno(p: {
  trabajoId: string;
  titulo: string;
  razon: string;
  responsableId: string;
  personas: { id: string; nombre: string; rol: string }[];
  plazoFecha: string;
  plazoHora: string;
  hoy: string;
}) {
  const anunciar = useContext(AnunciarContexto);
  const [abierto, setAbierto] = useState<Tipo | null>(null);
  const [confirmando, setConfirmando] = useState<{ datos: FormData; resumen: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<ResultadoIntervencionUI | null>(null);
  const [pendiente, iniciar] = useTransition();
  const base = `dueno-${p.trabajoId}`;
  const candidatos = p.personas.filter((x) => x.id !== p.responsableId);

  function abrir(t: Tipo) {
    setAbierto((a) => (a === t ? null : t));
    setConfirmando(null);
    setError(null);
  }

  /** Primer envío: valida lo básico y pide confirmación con un resumen de lo que va a pasar. */
  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const valor = (k: string) => String(datos.get(k) ?? '').trim();
    let resumen = '';
    if (abierto === 'reasignar') {
      const quien = candidatos.find((x) => x.id === valor('responsableId'));
      if (!quien) return setError('Elige a quién reasignar el trabajo.');
      resumen = `¿Reasignar «${p.titulo}» a ${quien.nombre}? Se cierra el seguimiento y se avisa a los dos.`;
    } else if (abierto === 'plazo') {
      if (!valor('fecha') || !valor('hora')) return setError('Indica la fecha y la hora del plazo nuevo.');
      if (!valor('motivo')) return setError('Escribe el motivo del cambio de plazo.');
      resumen = `¿Mover el plazo de «${p.titulo}» al ${valor('fecha').split('-').reverse().join('/')} a las ${valor('hora')}?`;
    } else if (abierto === 'bloqueo') {
      if (!valor('motivo')) return setError('Escribe el motivo del bloqueo.');
      resumen = `¿Declarar bloqueado «${p.titulo}»? Los trabajos que dependen de él pueden quedar en riesgo.`;
    } else return;
    setError(null);
    setConfirmando({ datos, resumen });
  }

  function confirmar() {
    if (!confirmando || !abierto) return;
    const accion = abierto === 'reasignar' ? accionReasignar : abierto === 'plazo' ? accionMoverPlazo : accionDeclararBloqueo;
    const datos = confirmando.datos;
    iniciar(async () => {
      const r = await accion(datos);
      if (!r.ok) {
        setError(r.error);
        setConfirmando(null);
        return;
      }
      setAbierto(null);
      setConfirmando(null);
      if (anunciar) anunciar({ mensaje: r.mensaje ?? 'Listo.', avisosA: r.avisosA });
      else setHecho(r);
    });
  }

  return (
    <div className="dueno" role="group" aria-labelledby={`${base}-titulo`}>
      <p id={`${base}-titulo`} className="dueno__titulo">
        Puedes actuar como {p.razon}:
      </p>
      <div className="dueno__botones">
        {(Object.keys(ETIQUETA) as Tipo[]).map((t) => {
          const Icono = ICONO[t];
          return (
            <button
              key={t}
              type="button"
              className="boton"
              aria-expanded={abierto === t}
              aria-controls={`${base}-panel`}
              aria-label={`${ETIQUETA[t]}: «${p.titulo}»`}
              disabled={pendiente}
              onClick={() => abrir(t)}
            >
              <Icono className="icono" aria-hidden="true" />
              {ETIQUETA[t]}
            </button>
          );
        })}
      </div>

      {abierto && (
        <form id={`${base}-panel`} onSubmit={alEnviar} aria-busy={pendiente} className="dueno__panel">
          <input type="hidden" name="trabajoId" value={p.trabajoId} />
          <fieldset disabled={pendiente || confirmando !== null}>
            <legend>
              {ETIQUETA[abierto]} «{p.titulo}»
            </legend>
            {abierto === 'reasignar' && (
              <div className="dueno__campos">
                <div>
                  <label htmlFor={`${base}-persona`} className="etiqueta-campo">
                    Nuevo responsable
                  </label>
                  <select id={`${base}-persona`} name="responsableId" required className="campo" defaultValue="" autoFocus>
                    <option value="" disabled>
                      Elige a una persona
                    </option>
                    {candidatos.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre} · {x.rol}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dueno__campo--ancho">
                  <label htmlFor={`${base}-motivo`} className="etiqueta-campo">
                    Motivo (opcional)
                  </label>
                  <textarea id={`${base}-motivo`} name="motivo" rows={2} maxLength={1000} className="campo" />
                </div>
              </div>
            )}
            {abierto === 'plazo' && (
              <div className="dueno__campos">
                <div>
                  <label htmlFor={`${base}-fecha`} className="etiqueta-campo">
                    Fecha
                  </label>
                  <input id={`${base}-fecha`} name="fecha" type="date" required min={p.hoy} defaultValue={p.plazoFecha} className="campo" autoFocus />
                </div>
                <div>
                  <label htmlFor={`${base}-hora`} className="etiqueta-campo">
                    Hora (Costa Rica)
                  </label>
                  <input id={`${base}-hora`} name="hora" type="time" required step={300} defaultValue={p.plazoHora} className="campo" />
                </div>
                <div className="dueno__campo--ancho">
                  <label htmlFor={`${base}-motivo`} className="etiqueta-campo">
                    Motivo (obligatorio)
                  </label>
                  <textarea id={`${base}-motivo`} name="motivo" rows={2} maxLength={1000} required className="campo" />
                </div>
              </div>
            )}
            {abierto === 'bloqueo' && (
              <div className="dueno__campos">
                <div className="dueno__campo--ancho">
                  <label htmlFor={`${base}-motivo`} className="etiqueta-campo">
                    Motivo del bloqueo (obligatorio)
                  </label>
                  <textarea id={`${base}-motivo`} name="motivo" rows={2} maxLength={1000} required className="campo" autoFocus />
                </div>
              </div>
            )}
            {!confirmando && (
              <div className="dueno__acciones">
                <button type="submit" className="boton boton--solido">
                  {ETIQUETA[abierto]}
                </button>
                <button type="button" className="boton boton--quieto" onClick={() => abrir(abierto)}>
                  Cancelar
                </button>
              </div>
            )}
          </fieldset>

          {confirmando && (
            <div role="group" aria-label="Confirmar" className="dueno__confirmar">
              <p>{confirmando.resumen}</p>
              <div className="dueno__acciones">
                <button type="button" autoFocus disabled={pendiente} className="boton boton--solido" onClick={confirmar}>
                  <Check className="icono" aria-hidden="true" />
                  {pendiente ? 'Guardando…' : 'Sí, confirmar'}
                </button>
                <button type="button" disabled={pendiente} className="boton boton--quieto" onClick={() => setConfirmando(null)}>
                  Volver
                </button>
              </div>
            </div>
          )}
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
      {hecho?.ok && (
        <div role="status" className="aviso-ok">
          <CircleCheck className="icono" aria-hidden="true" />
          <p>
            {hecho.mensaje}
            {hecho.avisosA.length > 0 && <> Se avisó a: {hecho.avisosA.join(', ')}.</>}
          </p>
        </div>
      )}
    </div>
  );
}
