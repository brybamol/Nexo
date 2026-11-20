# Nexo — Exploración: demasiadas capas de coordinación

*Fecha: 20-11-2026 · Estado: exploración (todavía no es un plan)*

Etiquetas de evidencia: **[V]** verificado en fuente primaria · **[S]** prensa secundaria o dato de la propia empresa · **[NV]** no verificado o con cifras que no cuadran entre fuentes.

---

## 1. El problema según Sequoia

Fuente: *From Hierarchy to Intelligence*, de Jack Dorsey (Block) y Roelof Botha (Sequoia). La firma del artículo dice 31-3-2026.

- **Tesis.** La jerarquía es, sobre todo, un **protocolo de enrutamiento de información**. Un líder solo puede gestionar entre 3 y 8 personas (*span of control*). Para crecer se añaden capas, pero cada capa ralentiza y distorsiona la información. En dos mil años, de las legiones romanas al Estado Mayor prusiano, los ferrocarriles y Taylor, solo se ha conseguido rodear este intercambio, no eliminarlo.
- **Por qué fallaron los intentos anteriores.** Según el ensayo, Spotify volvió a la gestión clásica, Zappos sufrió mucha rotación y Valve no escala más allá de unos cientos de personas.
- **Qué cambia ahora.** La IA puede mantener un **"world model" de la empresa**, continuamente actualizado, y hacer la coordinación que antes hacían mandos intermedios pasando información de una capa a otra.
- **Copiloto vs. inteligencia.** Dar a cada empleado un copiloto mejora un poco la estructura actual, pero no la cambia. Block propone una empresa construida como una "inteligencia" con cuatro piezas:
  1. capacidades atómicas;
  2. world model de la empresa y del cliente;
  3. capa de inteligencia;
  4. interfaces.
- **Tres roles en lugar de la pirámide:**
  - **IC** (especialistas). El world model les da el contexto que antes les daba un manager.
  - **DRI** (dueño de un resultado transversal). Por ejemplo, la rotación de comerciantes de un segmento durante 90 días, con autoridad para tomar recursos de otros equipos.
  - **Player-coach.** Construye y además desarrolla a las personas.
  - Para los autores, ya no hace falta una capa permanente de mandos intermedios.
- **Lo que reconocen los propios autores.** Block está en una fase temprana, algunas partes fallarán antes de funcionar y, sin un conocimiento profundo de la empresa, la IA se queda en recorte de costes.
- **Lo que el ensayo no aporta.** No da métricas de resultados de Block. Es una visión, no evidencia, y los autores son parte interesada.

### Contexto relevante
- **Block [S]:** 931 salidas en marzo de 2025, de ellas 80 puestos de mando eliminados y 193 mandos que pasaron a IC. En febrero de 2026, más de 4.000 salidas (alrededor del 40 %), justificadas con IA y "equipos más pequeños y planos".
- **Sequoia [S]:** en noviembre de 2026 aplana su propia estructura de socios y cierra Londres. Reconoce que su crecimiento introdujo jerarquía sin pretenderlo.

---

## 2. La crítica más sólida: la "interfaz organizativa"

Fuente: yage.ai, 5-4-2026. Es un análisis generado por IA y sin autor identificado, así que se usa como marco de ideas, no como autoridad.

La IA ya puede **coordinar**. Lo que no avanza al mismo ritmo es todo lo que la jerarquía hace **además** de enrutar información:

| Función de la jerarquía | ¿La resuelve la IA? |
|---|---|
| Enrutar información y reportar estado | Sí, en gran parte |
| Definir objetivos y prioridades | No, es juicio de negocio |
| Evaluar si un resultado es "suficientemente bueno" | Solo donde existen estándares claros |
| Autorizar ejecución (presupuestos, límites de firma) | Requiere diseño de permisos y auditoría |
| Asumir la responsabilidad cuando algo sale mal | No, la responsabilidad legal es humana |
| Desarrollar personas y carrera | No |

**Consecuencia:** quitar capas sin rediseñar evaluación, autorización y responsabilidad hace que el trabajo de coordinación vuelva de forma informal o que se pierda calidad.

---

## 3. Qué dice la evidencia real

### Casos

| Empresa | Qué hizo | Resultado | Evidencia |
|---|---|---|---|
| **Meta** (2023) | "Year of Efficiency": eliminó varias capas, convirtió mandos en IC y fijó un máximo orientativo de unos 10 reportes por mando | Margen operativo del 41 % en el 4T23 (20 % un año antes), plantilla −22 % | [V], pero coincide con recortes generales y no aísla el efecto de quitar capas |
| **Amazon** (2024) | Ratio de IC por mando +15 % para el 1T25 y un "Bureaucracy Mailbox" | Amazon dice que lo cumplió sin despidos masivos | [V] memo / [S] resultado |
| **Bayer** (2024–) | DSO: de 12 niveles a equipos autoorganizados en ciclos de 90 días; −40 % de mandos en EE. UU. | La empresa reporta menos rotación y ciclos más rápidos; la acción cayó alrededor del 50 % en un año | [V] medidas / [S] resultados |
| **Haier** | RenDanHeYi: miles de microempresas con cuenta de resultados propia y más de 10.000 mandos eliminados | Beneficio ×12 en una década, según Haier | [S] |
| **Buurtzorg** | Equipos de enfermería autogestionados | Coste por cliente de 6.428 € frente a 7.995 € de media (KPMG); el coste total del sistema queda en la media | [V]/[S] |
| **Zappos** (2015) | Holacracia impuesta con ultimátum | 18 % de salidas y 29 % de rotación anual; un proyecto clave se retrasó | [V], el fracaso mejor documentado |
| **Valve** | Sin managers, según su handbook | Ex-empleados describen una "jerarquía oculta" | [S] anecdótico |
| **Klarna** (2023–25) | IA en lugar de unos 700 agentes y congelación de contratación | El CEO admitió menor calidad y volvió a contratar humanos | [S] |
| **Shopify** (2025) | Antes de pedir más plantilla, hay que demostrar que la IA no puede hacer el trabajo | Sin resultados publicados | [V] memo |

### Datos de contexto
- **Gallup (enero de 2026) [V]:** media de 12,1 reportes por mando, frente a 10,9 un año antes. El 97 % de los mandos también hace trabajo de IC, con una mediana del 40 % de su tiempo, y aumenta el burnout. **Ampliar *spans* sin quitar carga de IC empeora la gestión.**
- **McKinsey [V parcial]:** no hay un número mágico de reportes. Depende del arquetipo: un player-coach lleva entre 3 y 5 personas; un coordinador de trabajo muy estandarizado, 15 o más.
- **Gartner (2024) [S]:** predijo que, hasta 2026, 1 de cada 5 organizaciones usaría la IA para eliminar más de la mitad de sus mandos intermedios. En 2026 indica que la "preparación va por detrás".
- **"Great Flattening" [S]:** los mandos intermedios pasan de alrededor del 20 % al 29–32 % de los despidos, y las ofertas de mando bajan entre un 42 % y un 43 % desde 2022.
- **Wulf (HBS) [S]:** al aplanar, los CEO **centralizaron** más decisiones, lo contrario de lo que se prometía.
- **Clásicos:**
  - Brooks: los canales de comunicación crecen como n(n−1)/2.
  - Conway: los sistemas copian la estructura de comunicación de quien los diseña.
  - Freeman, *Tyranny of Structurelessness*: sin estructura formal aparece una estructura informal y menos rendible.

**Conclusión honesta:** ningún caso aísla con rigor el efecto de quitar capas. Los costes sí están bien documentados: rotación, jerarquía informal, pérdida de calidad, centralización y desgaste de los mandos que quedan.

---

## 4. Qué se puede hacer: opciones

Ordenadas de menor a mayor radicalidad.

### A. Higiene de coordinación, sin tocar el organigrama
Auditar reuniones, reportes de estado y aprobaciones; eliminar las redundantes y pasar a una cultura escrita y asíncrona (memos de 6 páginas de Amazon, *handbook-first* de GitLab).
- ✅ Bajo riesgo, rápido y medible (horas en reuniones, tiempo de ciclo).
- ❌ No cambia la estructura y el efecto puede diluirse.

### B. Claridad de decisión: DRI y RAPID
Cada iniciativa tiene un único responsable con nombre y apellido. Las decisiones importantes siguen RAPID (Bain): un solo *Decider* y los vetos explícitos.
- ✅ Elimina el "¿quién decide esto?", que es la fuente principal de capas de coordinación.
- ❌ Exige cultura de *accountability* y puede sobrecargar a los DRI.

### C. IA como capa de coordinación (el "world model" en pequeño)
Agentes que generan reportes de estado, resumen el trabajo de los equipos, detectan bloqueos y dependencias y responden "¿en qué está X?" a partir de las herramientas reales (tickets, repos, CRM, documentos).
- ✅ Ataca justo la función que, según Sequoia, sobra en los mandos. Se puede probar en un piloto sin cambiar a nadie de puesto.
- ❌ Depende de que el trabajo quede registrado digitalmente (Block es *remote-first*, y esa es su ventaja). También plantea privacidad y sensación de vigilancia, y riesgo de alucinaciones en información de gestión.

### D. Rediseño de roles: IC, DRI y player-coach
Convertir mandos que solo enrutan información en player-coaches o IC, y aumentar los *spans* donde el trabajo esté estandarizado.
- ✅ Organización más rápida y más barata, con decisiones más cerca de la realidad.
- ❌ Es el paso con más riesgo humano: rotación (Zappos), pérdida de mentoring y carrera, y burnout (Gallup). Requiere A, B y C maduros antes.

### E. Modelo radical: microempresas o autogestión total (Haier, Bayer, holacracia)
- ✅ Máxima autonomía.
- ❌ El historial es mixto o negativo, cuesta años y no es aconsejable como punto de partida.

**Recomendación preliminar:** secuenciar **A → B → C** como pilotos medibles. Plantear **D** solo con datos del piloto. Descartar **E** por ahora.

---

## 5. Cómo podríamos empezar

Propuesta para discutir en el plan:

1. **Diagnóstico (2–3 semanas).** Escoger un área o unidad piloto y medir la línea base:
   - número de niveles y *span* medio;
   - horas por semana en reuniones de coordinación y reportes de estado;
   - tiempo de ciclo de una decisión típica (desde que se pide hasta que se decide);
   - número de "saltos" que da la información hasta quien decide;
   - encuesta breve: "¿sabes quién decide X?".
2. **Mapa de coordinación.** Por cada reunión, reporte y aprobación: quién lo produce, quién lo consume, qué decisión habilita y si podría hacerlo un agente o un documento.
3. **Quick wins (A + B).** Eliminar o fusionar las reuniones redundantes, asignar DRI a las 5–10 iniciativas principales y adoptar RAPID para las decisiones clave.
4. **Piloto de IA de coordinación (C).** Un agente que genere el reporte semanal de estado y el radar de bloqueos del área piloto a partir de sus herramientas. Medir horas ahorradas y precisión frente al reporte humano.
5. **Revisión a las 8–12 semanas.** Comparar con la línea base y decidir si se escala, se ajusta o se plantea D.

### Preguntas abiertas para el plan
- ¿Qué organización es el objetivo: la propia (TREISS), clientes, o un producto que resuelva esto para terceros?
- ¿Qué herramientas concentran el trabajo hoy (Jira o Asana, Slack, Notion, Google Workspace, CRM)? Es la condición de viabilidad del punto C.
- ¿Cuántos niveles y cuántas personas tiene el área piloto candidata?
- ¿Hay apoyo de dirección? Todos los casos de éxito los empujó el CEO.

---

## Fuentes principales
- Sequoia, *From Hierarchy to Intelligence*: https://sequoiacap.com/article/from-hierarchy-to-intelligence
- Crítica "organizational interface": https://yage.ai/share/sequoia-autopilot-organizational-interface-en-20260405.html
- Forbes sobre el playbook de empresas nativas de IA (no se pudo leer, error 403): https://www.forbes.com/sites/josipamajic/2026/03/31/dorsey-sequoia-and-redpoint-lay-out-a-new-playbook-for-ai-native-companies/
- Sequoia aplana su estructura: https://www.crowdfundinsider.com/2026/11/321477-vc-firm-sequoia-capital-shuts-london-office-to-focus-on-silicon-valley-operations/
- Meta: https://about.fb.com/news/2023/03/mark-zuckerberg-meta-year-of-efficiency/
- Amazon: https://www.aboutamazon.com/news/company-news/ceo-andy-jassy-latest-update-on-amazon-return-to-office-manager-team-ratio
- Bayer: https://fortune.com/2025/05/20/not-just-slash-and-burn-real-reason-this-major-pharmaceutical-company-ousted-e-40-of-its-middle-managers/
- Haier: https://www.mckinsey.com/capabilities/people-and-organization/our-insights/shattering-the-status-quo-a-conversation-with-haiers-zhang-ruimin
- Zappos: https://fortune.com/2016/01/14/zappos-holacracy-losing-employees/
- Valve: https://pcgamer.com/valves-flat-structure-contains-hidden-layer-of-powerful-management-claims-ex-employee
- Buurtzorg: https://zoek.officielebekendmakingen.nl/kst-31765-114.pdf
- Block: https://techcrunch.com/2025/03/25/read-the-email-jack-dorsey-sent-when-he-cut-931-of-blocks-staff ; https://www.theblock.co/post/391520/block-inc-slashes-40-staff-jack-dorsey-pushes-smaller-flatter-ai-strategy
- Klarna: https://www.bloomberg.com/news/articles/2025-05-08/klarna-turns-from-ai-to-real-person-customer-service
- Shopify: https://fortune.com/2025/04/08/shopify-ceo-ai-automation-no-new-hires-tech-jobs/
- Gallup, *span of control*: https://www.gallup.com/workplace/700718/span-control-optimal-team-size-managers.aspx
- McKinsey, *spans*: https://www.mckinsey.com/capabilities/people-and-organizational-performance/our-insights/how-to-identify-the-right-spans-of-control-for-your-organization
- Gartner: https://www.gartner.com/en/articles/ai-shaped-organization
- Great Flattening: https://fortune.com/2026/06/09/ai-agents-flattening-corporate-hierarchies-companies-managers-develop-new-playbook/
- Bain RAPID: https://www.bain.com/insights/rapid-decision-making/
- GitLab async: https://handbook.gitlab.com/handbook/company/culture/all-remote/asynchronous/
