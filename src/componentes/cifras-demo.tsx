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
          <span className="cifras__etiqueta">Trabajos cerrados sin intervención de la gerente:</span>{' '}
          <strong className="cifras__valor">{`${cifras.resueltosSinGerente} de ${cifras.resueltosTotal} (${cifras.porcentaje} %)`}</strong>{' '}
          <span className="cifras__nota-valor">meta {META_SIN_INTERVENCION} %</span>
        </li>
        <li>
          <span className="cifras__etiqueta">Seguimientos hechos por Nexo:</span>{' '}
          <strong className="cifras__valor">{cifras.seguimientos}</strong>
        </li>
        <li>
          <span className="cifras__etiqueta">Horas de coordinación ahorradas esta semana:</span>{' '}
          <span>
            <strong className="cifras__valor">{formatearHoras(cifras.minutosAhorrados)}</strong>{' '}
            <span className="cifras__estimado">estimado</span>
          </span>
        </li>
      </ul>
      <p>
        Hipótesis de minutos, no medición. Línea base: 10 supervisores × 1 h diaria = 50 h/semana.
      </p>
    </div>
  );
}
