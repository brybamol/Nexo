'use client';
// Isotipo y wordmark de Nexo (arte exploratorio, ver DESIGN.md). Solo presentación.
// La N está hecha de dos cintas: la primera sube por la izquierda, gira arriba y baja por la diagonal;
// la segunda entra por encima de la primera en la diagonal, gira abajo y sube por la derecha.
// Un hueco (máscara) separa las cintas donde se cruzan, así el cruce se lee en cualquier fondo.
import { useId } from 'react';

/** Trazos del isotipo en una caja de 48 × 48. */
const CINTA_A = 'M8.6 38.2 L13.9 16.1 C15 11.6 21.1 10.9 23.1 15.2 L29.6 29.8';
const CINTA_B = 'M27.3 24.6 L30.1 31.4 C32.1 35.8 38.1 35.4 39.1 30.9 L43.5 11.5';
/** Solo el arranque de la cinta B recorta a la A: el hueco marca el cruce sin tocar el resto. */
const CRUCE = 'M27.3 24.6 L29.4 29.4';
const GROSOR = 8;
const HUECO = 1.3;

type Fondo = 'claro' | 'oscuro';

type PropsIsotipo = {
  /** Lado en píxeles. */
  tamano?: number;
  /** true: una sola tinta (currentColor). */
  mono?: boolean;
  className?: string;
  /** Texto accesible; sin él, el isotipo es decorativo. */
  titulo?: string;
};

/** Isotipo solo: N de dos cintas con degradado Mint → Blue, o en una tinta. */
export function IsotipoNexo({ tamano = 32, mono = false, className, titulo }: PropsIsotipo) {
  const id = useId().replace(/:/g, '');
  const gA = `${id}-a`;
  const gB = `${id}-b`;
  const mascara = `${id}-m`;
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="3 2 46 46"
      fill="none"
      className={className}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gA} x1="8" y1="40" x2="30" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#69E1C7" />
          <stop offset="1" stopColor="#5CC3D8" />
        </linearGradient>
        <linearGradient id={gB} x1="26" y1="34" x2="44" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#56A9EE" />
          <stop offset="1" stopColor="#4B8FF7" />
        </linearGradient>
        {/* La cinta A se recorta donde la B pasa por encima. */}
        <mask id={mascara} maskUnits="userSpaceOnUse" x="0" y="0" width="50" height="50">
          <rect x="0" y="0" width="50" height="50" fill="#fff" />
          <path d={CRUCE} stroke="#000" strokeWidth={GROSOR + HUECO * 2} strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <g strokeWidth={GROSOR} strokeLinecap="round" strokeLinejoin="round">
        <path d={CINTA_A} stroke={mono ? 'currentColor' : `url(#${gA})`} mask={`url(#${mascara})`} />
        <path d={CINTA_B} stroke={mono ? 'currentColor' : `url(#${gB})`} />
      </g>
    </svg>
  );
}

type PropsLogo = {
  /** `horizontal`: isotipo + «nexo». `isotipo`: solo el símbolo. */
  variante?: 'horizontal' | 'isotipo';
  /** Fondo sobre el que va: el wordmark es blanco sobre oscuro y Core Navy sobre claro. */
  fondo?: Fondo;
  /** Una sola tinta: isotipo y wordmark en currentColor. */
  mono?: boolean;
  /** Alto del isotipo en píxeles; el wordmark escala con él. */
  tamano?: number;
  className?: string;
  /** Texto accesible del logo (por defecto «Nexo»). Vacío para dejarlo decorativo. */
  titulo?: string;
};

/** Logo de Nexo: lockup horizontal o isotipo solo, para fondo claro u oscuro, a color o en una tinta. */
export function LogoNexo({
  variante = 'horizontal',
  fondo = 'claro',
  mono = false,
  tamano = 32,
  className,
  titulo = 'Nexo',
}: PropsLogo) {
  const clases = ['logo-nexo', `logo-nexo--${fondo}`, mono ? 'logo-nexo--mono' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  if (variante === 'isotipo') {
    return (
      <span className={clases}>
        <IsotipoNexo tamano={tamano} mono={mono} titulo={titulo || undefined} />
      </span>
    );
  }
  return (
    <span className={clases} style={{ ['--logo-alto' as string]: `${tamano}px` }} role={titulo ? 'img' : undefined} aria-label={titulo || undefined}>
      <IsotipoNexo tamano={tamano} mono={mono} />
      <span className="logo-nexo__palabra" aria-hidden="true">
        nexo
      </span>
    </span>
  );
}
