// Campo de pregunta y respuesta con fuentes e insignia de implementación. Tarea 4.3.
import { FormularioPregunta } from '@/componentes/formulario-pregunta';

export default function PaginaPreguntar() {
  return (
    <>
      <h1>Preguntar</h1>
      <p>
        Pregunta cómo van los pedidos, los proyectos o qué está atrasado. Nexo responde con los datos actuales y enlaza a los
        trabajos de origen; si no tiene el dato, dice «no lo sé».
      </p>
      <FormularioPregunta />
    </>
  );
}
