# Nexo — Empresa ficticia y casos de control

*Fecha: 20-11-2026 · Estado: borrador para aprobar · Pertenece a: `03-etapa-0-definicion.md`*

Este documento es la fuente de los datos de ejemplo (etapa 1) y el examen de la IA y del motor de coordinación (etapas 2 y 3). Todo es inventado: la empresa, las personas, los clientes y los precios.

---

## 1. La empresa

**Frío del Valle S.A.** vende, instala y mantiene equipos de refrigeración comercial (cámaras frías, vitrinas y congeladores) en el Valle Central de Costa Rica. Tiene 80 empleados; la demo usa 12.

- **Áreas:** Gerencia, Oficina, Bodega y Campo.
- **Semana de la demo:** lunes 23 a viernes 27 de noviembre de 2026.
- **"Hoy":** miércoles 25 de noviembre, 7:00.

### Personas

| Persona | Rol | Área | Jefe directo |
|---|---|---|---|
| Marcela Solís | Gerente general | Gerencia | — |
| Andrés Vargas | Jefe de operaciones | Gerencia | Marcela Solís |
| Ricardo Brenes | Contabilidad y facturación | Oficina | Marcela Solís |
| Paola Herrera | Ejecutiva de ventas | Oficina | Andrés Vargas |
| Sofía Navarro | Servicio al cliente | Oficina | Andrés Vargas |
| Karla Jiménez | Encargada de compras | Oficina | Andrés Vargas |
| Lucía Mora | Supervisora de bodega | Bodega | Andrés Vargas |
| Diego Rojas | Bodeguero y despacho | Bodega | Lucía Mora |
| Esteban Castro | Supervisor de campo | Campo | Andrés Vargas |
| José Alfaro | Técnico | Campo | Esteban Castro |
| Daniela Quesada | Técnica | Campo | Esteban Castro |
| Mario Chaves | Técnico | Campo | Esteban Castro |

La columna "Jefe directo" es la cadena de escalamiento de la regla R3.

### Repuestos

| Repuesto | Existencia según el sistema | Proveedor habitual | Proveedor local |
|---|---|---|---|
| Compresor de 2 HP | 3 | ₡380.000, entrega en 6 días | ₡460.000, entrega el mismo día a las 15:00 |
| Termostato digital | 12 | ₡18.000, 3 días | ₡24.000, mismo día |
| Empaque de puerta (metro) | 40 | ₡3.500, 3 días | ₡4.200, mismo día |
| Gas refrigerante (cilindro) | 4 | ₡95.000, 3 días | ₡110.000, mismo día |
| Motor de ventilador | 6 | ₡42.000, 6 días | ₡55.000, mismo día |

**El problema plantado:** el sistema dice que hay 3 compresores de 2 HP, pero en la bodega hay 0. El conteo físico del lunes está en papel y nadie lo ha conciliado con el sistema (trabajo T15, atrasado). Es información que hoy solo vive en la cabeza de una persona.

---

## 2. Proyectos

| Proyecto | Resultado | Responsable | Fecha |
|---|---|---|---|
| **P1 · Cámara fría La Colina** | Cámara fría instalada y entregada al Supermercado La Colina | Esteban Castro | vie 27 nov |
| **P2 · Mantenimiento Trigal** | Mantenimiento trimestral de los 6 locales de Panadería Trigal | Daniela Quesada | lun 30 nov |
| **P3 · Repuestos críticos** | Inventario conciliado y reorden de repuestos críticos aprobado | Lucía Mora | lun 30 nov |
| **P4 · Pedidos de la semana** | Los 7 pedidos de la semana entregados y facturados | Andrés Vargas | vie 27 nov |
| **Operación diaria** | Trabajos sueltos que no pertenecen a un proyecto | Andrés Vargas | — |

---

## 3. Trabajos al inicio de la demo

30 trabajos: 8 resueltos, 2 en curso y 20 abiertos, de los cuales 2 están atrasados.

### P1 · Cámara fría La Colina

| ID | Trabajo | Responsable | Plazo | Estado | Depende de | Necesita |
|---|---|---|---|---|---|---|
| T01 | Visita técnica y medidas | José Alfaro | lun 23 | Resuelto | — | — |
| T02 | Preparar paneles y materiales en bodega | Diego Rojas | mar 24 | Resuelto | T01 | — |
| T03 | Montar paneles y puerta | José Alfaro | mar 24 | Resuelto | T02 | — |
| T04 | Instalar unidad condensadora y compresor | José Alfaro | mié 25, 17:00 | En curso | T03 | 1 compresor de 2 HP |
| T05 | Cableado y tablero de control | Mario Chaves | jue 26 | Abierto | T04 | — |
| T06 | Prueba de frío y entrega al cliente | Esteban Castro | vie 27 | Abierto | T05 | — |
| T07 | Facturar la instalación | Ricardo Brenes | vie 27 | Abierto | T06 | — |

### P2 · Mantenimiento Trigal

| ID | Trabajo | Responsable | Plazo | Estado | Depende de | Necesita |
|---|---|---|---|---|---|---|
| T08 | Agendar visitas con los 6 locales | Sofía Navarro | lun 23 | Resuelto | — | — |
| T09 | Mantenimiento en Heredia y Alajuela | Daniela Quesada | mar 24 | Resuelto | T08 | — |
| T10 | Cambiar compresor en local Cartago | Daniela Quesada | jue 26 | Abierto | T08 | 1 compresor de 2 HP |
| T11 | Cambiar compresor en local Curridabat | Mario Chaves | jue 26 | Abierto | T08 | 1 compresor de 2 HP |
| T12 | Mantenimiento en Escazú y Tibás | Daniela Quesada | vie 27 | Abierto | T08 | — |
| T13 | Informe de mantenimiento al cliente | Sofía Navarro | lun 30 | Abierto | T10, T11, T12 | — |

### P3 · Repuestos críticos

| ID | Trabajo | Responsable | Plazo | Estado | Depende de | Necesita |
|---|---|---|---|---|---|---|
| T14 | Conteo físico de repuestos críticos | Diego Rojas | lun 23 | Resuelto | — | — |
| T15 | Conciliar el conteo con el sistema | Lucía Mora | mar 24 | Abierto · **atrasado** | T14 | — |
| T16 | Definir mínimos por repuesto | Lucía Mora | jue 26 | Abierto · en riesgo | T15 | — |
| T17 | Cotizar el reorden con dos proveedores | Karla Jiménez | vie 27 | Abierto · en riesgo | T16 | — |
| T18 | Aprobar la compra de reorden | Marcela Solís | lun 30 | Abierto · en riesgo | T17 | — |

### P4 · Pedidos de la semana

| ID | Trabajo | Responsable | Plazo | Estado | Depende de | Necesita |
|---|---|---|---|---|---|---|
| T19 | Entregar pedido 1041 · vitrina · Soda El Roble | Diego Rojas | lun 23 | Resuelto | — | — |
| T20 | Entregar pedido 1042 · repuestos · Hotel Mirador | Diego Rojas | mar 24 | Resuelto | — | — |
| T21 | Entregar pedido 1043 · 2 congeladores · Minisúper Don Beto | Diego Rojas | mar 24 | Abierto · **atrasado** | T22 | — |
| T22 | Reprogramar la entrega 1043 con el cliente | Sofía Navarro | mié 25, 10:00 | Abierto | — | — |
| T23 | Entregar pedido 1044 · cámara modular · Carnicería San Rafael | Diego Rojas | mié 25, 14:00 | En curso | — | — |
| T24 | Entregar pedido 1045 · vitrina · Trigal Heredia | Diego Rojas | jue 26 | Abierto | — | — |
| T25 | Entregar pedido 1046 · termostatos y empaques · Restaurante Mar Azul | Diego Rojas | jue 26 | Abierto | — | 4 termostatos, 10 m de empaque |
| T26 | Entregar pedido 1047 · 3 vitrinas · Supermercado La Colina | Diego Rojas | vie 27 | Abierto | T27 | — |
| T27 | Confirmar el pago anticipado del pedido 1047 | Ricardo Brenes | jue 26 | Abierto | — | — |
| T28 | Enviar cotización de cámara fría a Hotel Mirador | Paola Herrera | mié 25, 12:00 | Abierto | — | — |
| T29 | Revisar la ruta de entregas del jueves | Andrés Vargas | mié 25, 16:00 | Abierto | — | — |
| T30 | Facturar los pedidos entregados de la semana | Ricardo Brenes | vie 27 | Abierto | — | — |

Nota de T21: el cliente estaba cerrado el martes; los congeladores volvieron a bodega.

---

## 4. Frases de control (captura, etapa 2)

Cada frase se escribe en la caja de captura con la persona indicada. La etapa 2 se cierra con **12 de 15** correctas. Una frase es correcta si coincide todo lo marcado en "Resultado esperado".

| # | Quién | Frase | Resultado esperado |
|---|---|---|---|
| C01 | José Alfaro | "No puedo terminar la instalación en La Colina, falta el compresor de 2 HP" | **Trabajo nuevo** en P1: conseguir el compresor. Responsable Lucía Mora, plazo hoy 12:00, urgente. T04 pasa a Bloqueado. El compresor queda "reportado como faltante" |
| C02 | Daniela Quesada | "Listo el mantenimiento de Escazú, Tibás queda para mañana" | **Actualización** de T12: En curso, con nota. No crea trabajo |
| C03 | Diego Rojas | "Mae, el cliente de Don Beto no estaba, me devolví con los congeladores" | **Actualización** de T21 con nota. No crea trabajo: T22 ya existe. Avisa a Sofía Navarro |
| C04 | Paola Herrera | "Hay que mandarle la cotización de la cámara fría al Hotel Mirador hoy" | **Duplicado** de T28. No crea trabajo y lo muestra |
| C05 | Sofía Navarro | "La Colina pregunta si se puede adelantar la entrega de las vitrinas al jueves" | **Trabajo nuevo** en P4: responder al cliente sobre adelantar el pedido 1047. Responsable Andrés Vargas, plazo hoy. Relacionado con T26 y T27 |
| C06 | Karla Jiménez | "El proveedor subió el precio de los empaques un 12 %, ¿compramos igual?" | **Decisión** con costo en P3. Nexo hace una pregunta: cuántos metros se van a comprar |
| C07 | Esteban Castro | "Gracias a todos, buen trabajo ayer" | **No es trabajo.** No crea nada |
| C08 | Mario Chaves | "Ocupo una escalera de 6 metros para el jueves en Curridabat" | **Trabajo nuevo** en P2: conseguir la escalera. Responsable Lucía Mora, plazo jueves 26 a las 7:00. Relacionado con T11 |
| C09 | Ricardo Brenes | "Todavía no entra el pago de La Colina por las vitrinas" | **Actualización** de T27 con nota. No crea trabajo. Avisa a Andrés Vargas, responsable de P4, de que T26 depende de ese pago |
| C10 | Andrés Vargas | "Alguien tiene que revisar el camión, hace un ruido raro" | **Trabajo nuevo** en Operación diaria. Nexo propone a Lucía Mora como responsable y pide confirmación. Plazo hoy |
| C11 | Lucía Mora | "No hay compresores de 2 HP. Propongo comprar 3 de urgencia al proveedor local" | **Decisión** para Marcela Solís (supera ₡100.000) con las tres opciones del guion. Existencia del compresor corregida a 0 |
| C12 | Daniela Quesada | "En Cartago el cliente quiere que también le revisemos el aire acondicionado" | **Trabajo nuevo** en P2: cotizar la revisión del aire acondicionado. Responsable Paola Herrera, plazo viernes 27 |
| C13 | Marcela Solís | "¿Cómo vamos con los pedidos de la semana?" | **Pregunta**, no trabajo. Respuesta esperada abajo |
| C14 | José Alfaro | "Ya llegó el compresor, sigo con la instalación" | **Actualización:** el trabajo creado en C01 queda Resuelto y T04 vuelve a En curso. Avisa a Mario Chaves (T05). Requiere C01 antes |
| C15 | Diego Rojas | "Se cayó una vitrina del pedido 1045 en bodega, quedó con el vidrio quebrado" | **Trabajo nuevo** urgente en P4: resolver la vitrina dañada. Responsable Lucía Mora, plazo hoy. T24 pasa a Bloqueado. Marcado "con costo probable" |

**Respuesta esperada de C13** (con el estado inicial): de 7 pedidos, 2 entregados (1041 y 1042), 1 en ruta hoy (1044), 1 atrasado (1043: el cliente estaba cerrado y Sofía Navarro lo reprograma hoy) y 3 pendientes (1045 y 1046 para el jueves; 1047 para el viernes, a la espera de confirmar el pago). Cada pedido enlaza a su trabajo.

### Qué cubren las frases

| Tipo | Frases |
|---|---|
| Trabajo nuevo | C01, C05, C08, C10, C12, C15 |
| Actualización de un trabajo existente | C02, C03, C09, C14 |
| Duplicado | C04 |
| Decisión con costo | C06, C11 |
| No es trabajo | C07 |
| Pregunta | C13 |

---

## 5. Escenarios de control (coordinación, etapa 3)

Cada escenario parte del estado inicial, salvo que diga otra cosa, y se ejecuta con el botón del reloj. La etapa 3 se cierra con los **5 de 5** correctos.

### E1 · Seguimiento que se cierra solo (R1)
| Reloj | Hecho | Nexo debe |
|---|---|---|
| mié 12:00 | Vence T28 sin resolver | Pedir el estado a Paola Herrera |
| mié 12:10 | Paola responde "ya la envié" | Marcar T28 Resuelto y registrar la acción. Ningún jefe interviene |

### E2 · Recordatorio y escalamiento (R2 y R3)
Empieza con la frase C01 a las 7:05.

| Reloj | Hecho | Nexo debe |
|---|---|---|
| mié 7:05 | Se crea el trabajo urgente para Lucía Mora | Avisarle |
| mié 7:35 | Sin respuesta | Enviarle un recordatorio |
| mié 8:05 | Sin respuesta | Escalar a Andrés Vargas con: quién lo pidió (José Alfaro), qué bloquea (T04 y su cadena) y desde cuándo |

### E3 · Propagación entre proyectos (R4 y R5)
Empieza con la frase C01 a las 7:05.

| Qué | Resultado esperado |
|---|---|
| Bloqueado | T04 |
| En riesgo por cadena | T05, T06, T07 |
| En riesgo por el mismo repuesto | T10, T11 |
| En riesgo por cadena desde T10 y T11 | T13 |
| Avisos (uno por persona) | Mario Chaves (T05 y T11, de dos proyectos, en un solo aviso), Esteban Castro (T06), Ricardo Brenes (T07), Daniela Quesada (T10) y Sofía Navarro (T13) |
| Causa que Nexo debe citar | El conteo del lunes no está conciliado: T15, atrasado |

### E4 · Decisión con costo (R6, R7 y R8)
Empieza después de E3, con la frase C11 a las 8:10.

| Reloj | Hecho | Nexo debe |
|---|---|---|
| mié 8:10 | Lucía Mora propone la compra | Crear la decisión para Marcela Solís con las opciones A, B y C y sus consecuencias |
| mié 8:12 | Marcela aprueba la opción A | Crear el trabajo "Comprar 3 compresores de 2 HP al proveedor local" para Karla Jiménez, plazo hoy 15:00 |
| mié 8:12 | — | Quitar "en riesgo" de T05, T06, T07, T10, T11 y T13. T04 sigue Bloqueado, con fecha de solución hoy 15:00 |
| mié 8:12 | — | Avisar a los seis afectados y a Lucía Mora. Registrar la decisión y quién la tomó |

**Variante:** si Marcela aprueba la opción B, Nexo mueve T04, T10 y T11 al martes 1 de diciembre, T05 al miércoles 2, y T06, T07 y T13 al jueves 3 (La Colina se entrega el jueves 3 de diciembre), y crea un trabajo para Sofía Navarro: avisar a los dos clientes del atraso.

### E5 · Cierre de ciclo sin jefes
| Reloj | Hecho | Nexo debe |
|---|---|---|
| mié 9:30 | Sofía Navarro escribe "Don Beto recibe mañana jueves en la mañana" | Marcar T22 Resuelto |
| mié 9:30 | — | Mover el plazo de T21 al jueves 26 y quitarle la marca de atrasado |
| mié 9:30 | — | Avisar a Diego Rojas y añadir una nota a T29 (ruta del jueves). Ningún jefe interviene |

---

## 6. Qué puede cambiar el equipo sin romper nada

- Nombres de personas, clientes y de la empresa.
- La industria: si el equipo conoce mejor otra, se cambian los proyectos y repuestos manteniendo la misma estructura (un recurso escaso compartido por dos proyectos y un dato que solo sabe una persona).
- Los precios y el umbral de ₡100.000.

Lo que no conviene cambiar: el número de trabajos, la cadena de dependencias de P1 y que Mario Chaves tenga trabajos afectados en dos proyectos. De eso dependen el guion y los escenarios E3 y E4.
