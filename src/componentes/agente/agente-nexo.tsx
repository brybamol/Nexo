'use client';
// Nexo como asistente: botón flotante con el isotipo que abre un panel no modal con la captura en forma de hilo.
// Sustituye a la caja fija de arriba y a la pantalla Preguntar: la captura ya responde preguntas.
// El hilo vive solo en el cliente; el layout lo reinicia con su `key` (Reiniciar demo o cambio de «ver como»).
import {
  CircleAlert,
  FolderKanban,
  ListChecks,
  Maximize2,
  Minimize2,
  Package,
  PenLine,
  SendHorizontal,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  accionCapturar,
  accionResponderCaptura,
  type EstadoFormularioCaptura,
} from '@/app/acciones/captura';
import { IsotipoNexo, LogoNexo } from '../marca/logo-nexo';
import { TarjetaResultadoCaptura } from '../tarjeta-resultado-captura';
import { ARRANQUES_FRASE, SUGERENCIAS_PREGUNTA, type SugerenciaPregunta } from './sugerencias';
import './agente.css';

const ESTADO_INICIAL: EstadoFormularioCaptura = { resultado: null, error: null };
const ERROR_RED = 'No pude comunicarme con Nexo. Revisa la conexión e inténtalo de nuevo.';

const ICONOS_TEMA: Record<SugerenciaPregunta['tema'], LucideIcon> = {
  mis_pendientes: ListChecks,
  atrasados: TriangleAlert,
  pedidos_semana: Package,
  estado_proyectos: FolderKanban,
};

/** Un intercambio del hilo: lo que dijo la persona y lo que contestó Nexo (null mientras espera). */
type Intercambio = { id: number; frase: string; estado: EstadoFormularioCaptura | null };

type Props = {
  /** Nombre de pila de la persona de «ver como», para el saludo. */
  nombre: string;
};

const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AgenteNexo({ nombre }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [amplio, setAmplio] = useState(false);
  const [texto, setTexto] = useState('');
  const [hilo, setHilo] = useState<Intercambio[]>([]);
  const [pendiente, iniciar] = useTransition();
  // Guarda síncrona: `pendiente` llega un render tarde, y dos Enter seguidos lo atravesarían.
  const enviando = useRef(false);
  const siguienteId = useRef(1);
  const boton = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const ultimo = useRef<HTMLLIElement>(null);
  const yaAbierto = useRef(false);
  const idTitulo = useId();
  const idPanel = useId();
  const idCampo = useId();
  const idAyuda = useId();

  // Al abrir, el foco va a la caja; al cerrar, vuelve al botón (no en el primer render).
  useEffect(() => {
    if (abierto) {
      yaAbierto.current = true;
      campo.current?.focus();
    } else if (yaAbierto.current) {
      boton.current?.focus();
    }
  }, [abierto]);

  // Cada intercambio nuevo (o su respuesta) se lleva a la vista, con la frase arriba.
  const ultimoId = hilo.at(-1)?.id;
  const ultimoListo = hilo.at(-1)?.estado !== null;
  useEffect(() => {
    if (ultimoId === undefined) return;
    ultimo.current?.scrollIntoView({ block: 'start', behavior: sinMovimiento() ? 'auto' : 'smooth' });
  }, [ultimoId, ultimoListo]);

  /** Envía una frase nueva o la respuesta a la pregunta de Nexo; `frase` es lo que se muestra en el hilo. */
  function lanzar(frase: string, datos: FormData, anterior: EstadoFormularioCaptura | null, limpiarCaja: boolean) {
    if (enviando.current) return;
    enviando.current = true;
    const id = siguienteId.current++;
    setHilo((h) => [...h, { id, frase, estado: null }]);
    if (limpiarCaja) setTexto('');
    const esRespuesta = datos.has('capturaId');
    iniciar(async () => {
      let estado: EstadoFormularioCaptura;
      try {
        estado = esRespuesta
          ? await accionResponderCaptura(anterior ?? ESTADO_INICIAL, datos)
          : await accionCapturar(ESTADO_INICIAL, datos);
      } catch {
        // Sin respuesta del servidor: se conserva lo anterior para poder reintentar.
        estado = { ...(anterior ?? ESTADO_INICIAL), error: ERROR_RED };
      }
      setHilo((h) => h.map((x) => (x.id === id ? { ...x, estado } : x)));
      // Si la frase no se aceptó, vuelve a la caja (salvo que la persona ya esté escribiendo otra).
      const fallo = estado.error !== null || estado.resultado?.estado === 'error';
      if (fallo && limpiarCaja) setTexto((t) => (t.trim() === '' ? frase : t));
      enviando.current = false;
    });
  }

  function enviarFrase(frase: string) {
    const limpia = frase.trim();
    if (!limpia) return;
    const datos = new FormData();
    datos.set('texto', limpia);
    lanzar(limpia, datos, null, true);
  }

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    enviarFrase(texto);
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Mayús+Enter agrega una línea.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviarFrase(texto);
    }
  }

  function preguntarYa(s: SugerenciaPregunta) {
    if (enviando.current) return;
    const datos = new FormData();
    datos.set('texto', s.texto);
    lanzar(s.texto, datos, null, false);
  }

  function arrancar(inicio: string) {
    setTexto(inicio);
    requestAnimationFrame(() => {
      const c = campo.current;
      if (!c) return;
      c.focus();
      c.setSelectionRange(inicio.length, inicio.length);
    });
  }

  function alTeclaPanel(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  const ultimoEstado = hilo.at(-1)?.estado ?? null;

  /** Respuesta a «Nexo necesita un dato»: en el hilo se muestra la etiqueta elegida, no su valor interno. */
  function enviarRespuesta(datos: FormData) {
    const valor = String(datos.get('respuesta') ?? '').trim();
    if (!valor) return;
    const r = ultimoEstado?.resultado;
    const etiqueta = r?.estado === 'pregunta' ? r.opciones.find((o) => o.valor === valor)?.etiqueta : undefined;
    lanzar(etiqueta ?? valor, datos, ultimoEstado, false);
  }

  const vacio = hilo.length === 0;

  return (
    <div className="agente" data-abierto={abierto || undefined} data-amplio={amplio || undefined} onKeyDown={alTeclaPanel}>
      {abierto && (
        <div
          id={idPanel}
          className="agente__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={idTitulo}
        >
          <header className="agente__cabecera">
            <h2 id={idTitulo} className="agente__titulo">
              <LogoNexo fondo="oscuro" tamano={22} titulo="Nexo" />
            </h2>
            <div className="agente__herramientas">
              <button
                type="button"
                className="agente__herramienta agente__ampliar"
                aria-pressed={amplio}
                aria-label={amplio ? 'Reducir el panel' : 'Ampliar el panel'}
                title={amplio ? 'Reducir' : 'Ampliar'}
                onClick={() => setAmplio((a) => !a)}
              >
                {amplio ? <Minimize2 className="icono" aria-hidden="true" /> : <Maximize2 className="icono" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="agente__herramienta"
                aria-label="Cerrar el panel de Nexo"
                title="Cerrar"
                onClick={() => setAbierto(false)}
              >
                <X className="icono" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="agente__cuerpo">
            {vacio ? (
              <div className="agente__inicio">
                <IsotipoNexo tamano={48} className="agente__isotipo" />
                <p className="agente__saludo">{nombre ? `Hola, ${nombre}, ¿cómo te ayudo?` : 'Hola, ¿cómo te ayudo?'}</p>
                <p className="agente__explica">
                  Cuéntame qué pasó, pídeme algo o pregúntame cómo va el trabajo. Yo lo convierto en trabajos, avisos y
                  respuestas con sus fuentes.
                </p>

                <section className="agente__grupo" aria-labelledby={`${idPanel}-preguntas`}>
                  <h3 id={`${idPanel}-preguntas`} className="agente__grupo-titulo">
                    Pregúntame
                  </h3>
                  <ul className="agente__sugerencias">
                    {SUGERENCIAS_PREGUNTA.map((s) => {
                      const Icono = ICONOS_TEMA[s.tema];
                      return (
                        <li key={s.texto}>
                          <button
                            type="button"
                            className="agente__sugerencia"
                            disabled={pendiente}
                            onClick={() => preguntarYa(s)}
                          >
                            <span className="agente__sugerencia-icono">
                              <Icono className="icono" aria-hidden="true" />
                            </span>
                            {s.texto}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="agente__grupo" aria-labelledby={`${idPanel}-arranques`}>
                  <h3 id={`${idPanel}-arranques`} className="agente__grupo-titulo">
                    O empieza una frase
                  </h3>
                  <ul className="agente__arranques">
                    {ARRANQUES_FRASE.map((a) => (
                      <li key={a.etiqueta}>
                        <button type="button" className="agente__arranque" onClick={() => arrancar(a.texto)}>
                          <PenLine className="icono" aria-hidden="true" />
                          {a.etiqueta}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : (
              <ol className="agente__hilo" role="log" aria-label="Conversación con Nexo">
                {hilo.map((x, i) => {
                  const esUltimo = i === hilo.length - 1;
                  return (
                    <li key={x.id} ref={esUltimo ? ultimo : undefined} className="agente__intercambio">
                      <p className="agente__frase">
                        <span className="sr-only">Tú: </span>
                        {x.frase}
                      </p>
                      {x.estado === null ? (
                        <p className="agente__pensando" role="status">
                          <IsotipoNexo tamano={20} className="agente__pensando-isotipo" />
                          Nexo está revisando…
                        </p>
                      ) : (
                        <div className="agente__respuesta">
                          {x.estado.error && (
                            <p role="alert" className="alerta">
                              <CircleAlert className="icono" aria-hidden="true" />
                              {x.estado.error}
                            </p>
                          )}
                          {x.estado.resultado && (
                            <TarjetaResultadoCaptura
                              resultado={x.estado.resultado}
                              trabajos={x.estado.trabajos}
                              enviarRespuesta={esUltimo ? enviarRespuesta : undefined}
                              pendiente={pendiente}
                              soloLectura={!esUltimo}
                            />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <form className="agente__caja" onSubmit={alEnviar} aria-busy={pendiente}>
            <label htmlFor={idCampo} className="sr-only">
              Cuéntale a Nexo qué pasó, qué necesitas o qué quieres saber
            </label>
            <div className="agente__fila">
              <textarea
                ref={campo}
                id={idCampo}
                name="texto"
                rows={2}
                maxLength={1000}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={alTeclear}
                placeholder="Escribe qué pasó, qué necesitas o qué quieres saber…"
                aria-describedby={idAyuda}
              />
              <button
                type="submit"
                className="agente__enviar"
                disabled={pendiente || texto.trim() === ''}
                aria-label={pendiente ? 'Enviando' : 'Enviar'}
              >
                <SendHorizontal className="icono" aria-hidden="true" />
              </button>
            </div>
            <p id={idAyuda} className="agente__ayuda">
              Enter envía · Mayús+Enter agrega una línea
            </p>
          </form>
        </div>
      )}

      <button
        ref={boton}
        type="button"
        className="agente__boton"
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        aria-label={abierto ? 'Cerrar el panel de Nexo' : 'Cuéntale a Nexo qué pasó, pídele algo o pregúntale'}
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? (
          <X className="icono agente__boton-cerrar" aria-hidden="true" />
        ) : (
          <IsotipoNexo tamano={28} />
        )}
        <span className="agente__boton-texto" aria-hidden="true">
          {abierto ? 'Cerrar' : 'Cuéntale a Nexo'}
        </span>
      </button>
    </div>
  );
}
