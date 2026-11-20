// Trabajos del proyecto con estado, marcas, responsable, plazo y dependencias. Lee obtenerProyecto. Tarea 1.7.
export default async function PaginaProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main>Proyecto {id} (no implementado: 1.7)</main>;
}
