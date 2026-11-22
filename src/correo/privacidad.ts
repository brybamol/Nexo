// Filtro de privacidad (docs/06 §5). Lo que no es laboral se descarta: solo se cuenta, nunca se guarda ni se muestra.
// Decide con encabezados (remitente y señales de lista), sin abrir el cuerpo.
import type { ClasePrivacidad, EmpresaCorreo, MensajeCorreo } from '@/correo/tipos';

const REMITENTE_AUTOMATICO = /^(no-?reply|no-?responder|noreply)@/i;

function dominioDe(correo: string): string {
  return (correo.split('@')[1] ?? '').toLowerCase();
}

export function clasificarMensaje(m: Pick<MensajeCorreo, 'de' | 'automatico'>, empresa: EmpresaCorreo): ClasePrivacidad {
  const remitente = m.de.correo.toLowerCase();
  if (m.automatico || REMITENTE_AUTOMATICO.test(remitente)) return 'boletin';
  const dominio = dominioDe(remitente);
  if (dominio === empresa.dominio || empresa.dominiosLaborales.includes(dominio)) return 'laboral';
  return 'personal';
}
