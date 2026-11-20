// Las tres cifras de la demo. Tarea 4.4.
import { formatearHoras } from '@/dominio/formato';
import type { Cifras } from '@/servicios/vistas';

const META_SIN_INTERVENCION = 50;

export function CifrasDemo(props: { cifras: Cifras }) {
  const { cifras } = props;
  return (
    <div className="cifras">
      <ul>
        <li>
          Trabajos cerrados sin intervención de la gerente:{' '}
          <strong>{`${cifras.resueltosSinGerente} de ${cifras.resueltosTotal} (${cifras.porcentaje} %)`}</strong>{' '}
          · meta {META_SIN_INTERVENCION} %
        </li>
        <li>
          Seguimientos hechos por Nexo: <strong>{cifras.seguimientos}</strong>
        </li>
        <li>
          Horas de coordinación ahorradas esta semana: <strong>{formatearHoras(cifras.minutosAhorrados)}</strong> · estimado
        </li>
      </ul>
      <p>
        Hipótesis de minutos, no medición. Línea base: 10 supervisores × 1 h diaria = 50 h/semana.
      </p>
    </div>
  );
}
