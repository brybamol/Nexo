// Campo de pregunta y respuesta con fuentes e insignia de implementación. Tarea 4.3.
import { FormularioPregunta } from '@/componentes/formulario-pregunta';

export default function PaginaPreguntar() {
  return (
    <>
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Preguntar</h1>
        <p className="pagina__sub">
          Pregunta cómo van los pedidos, los proyectos o qué está atrasado. Nexo responde con los datos actuales y enlaza a
          los trabajos de origen; si no tiene el dato, dice «no lo sé».
        </p>
      </header>
      <FormularioPregunta />
    </>
  );
}
