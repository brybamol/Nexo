// Insignia de confianza de un trabajo (docs/08 regla 18 y §6). Los tres registros de DESIGN.md:
// una fuente = lo que Nexo propone (Mint tenue); dos buzones = coincidencia de dos fuentes (verde, ya registrado);
// persona = lo afirmó una persona o viene de la semilla (verde).
import { ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import type { Confianza } from '@/dominio/tipos';
import '@/app/correo/correo.css';

const ROTULO_POR_DEFECTO: Record<Confianza, string> = {
  una_fuente: 'Propuesto por Nexo · una fuente',
  dos_fuentes: 'Confirmado por dos buzones',
  persona: 'Confirmado por una persona',
};

/**
 * Props: `confianza` (Confianza del trabajo); `texto` (opcional) sustituye el rótulo, p. ej. «Confirmado por dos buzones:
 * Andrés Vargas y Ricardo Brenes» o «Lo escribió José Alfaro».
 */
export function InsigniaConfianza({ confianza, texto }: { confianza: Confianza; texto?: string }) {
  const Icono = confianza === 'una_fuente' ? Sparkles : confianza === 'dos_fuentes' ? ShieldCheck : UserCheck;
  return (
    <span className="insignia insignia--confianza" data-confianza={confianza}>
      <Icono className="icono" aria-hidden="true" />
      {texto ?? ROTULO_POR_DEFECTO[confianza]}
    </span>
  );
}
