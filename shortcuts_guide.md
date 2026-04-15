# Guía de Atajos y Funcionalidades del Editor de Cairn

Esta guía detalla las interacciones clave, atajos de teclado y funcionalidades del editor de flujos de trabajo de Cairn, muchas de ellas inspiradas en la fluidez de **xyOps**.

---

## 1. Acciones Generales

| Tecla / Acción              | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Ctrl/Cmd + Z`              | Deshacer la última acción.                                                  |
| `Ctrl/Cmd + Y` / `Ctrl/Cmd + Shift + Z` | Rehacer la última acción.                                                   |
| `Suprimir` / `Backspace`    | Eliminar los nodos o conexiones seleccionados.                               |
| `Escape`                    | Deseleccionar todos los nodos y conexiones.                                  |
| `Clic (ratón)`              | Seleccionar un solo nodo o conexión.                                        |
| `Shift + Clic (ratón)`      | Añadir o quitar un nodo de la selección actual.                             |
| `Doble Clic (ratón)`        | Abrir el panel de configuración del nodo (si el nodo es configurable).       |
| `Clic Derecho (ratón)`      | Abrir el menú contextual del nodo o del lienzo, dependiendo de dónde se haga clic. |

---

## 2. Gestión de Nodos

| Tecla / Acción              | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Ctrl/Cmd + C`              | **Copiar** los nodos seleccionados al portapapeles.                         |
| `Ctrl/Cmd + X`              | **Cortar** los nodos seleccionados al portapapeles (copia y luego elimina). |
| `Ctrl/Cmd + V`              | **Pegar** los nodos del portapapeles en el lienzo, ligeramente desplazados de su posición original. Los nodos pegados quedan seleccionados. |
| `Ctrl/Cmd + E`              | **Activar/Desactivar** (Toggle Enable/Disable) los nodos seleccionados. Los nodos desactivados se atenúan y son ignorados por el motor de ejecución. |
| `Teclas de Flecha (↑↓←→)`  | **Mover** (Nudge) los nodos seleccionados 1 píxel en la dirección indicada. |
| `Shift + Teclas de Flecha`  | **Mover** (Nudge) los nodos seleccionados 10 píxeles en la dirección indicada. |
| `Menú Contextual (Clic Derecho en Nodo)` | Ofrece opciones como `Duplicar`, `Eliminar`, `Activar/Desactivar` para el nodo. |

---

## 3. Conexiones ("Soldadura")

El sistema de "soldadura" facilita la creación de conexiones fluidas entre nodos.

| Acción                      | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Arrastrar desde un Puerto de Salida (derecha del nodo)` | Inicia el modo de "soldadura". Una línea sigue al cursor.               |
| `Soltar en un Puerto de Entrada (izquierda del nodo)` | Completa la conexión con el nodo de destino.                            |
| `Soltar en el Lienzo Vacío` | Pausa la operación de soldadura y abre la barra de búsqueda contextual. Puedes crear un nuevo nodo en esa posición, y la conexión se completará automáticamente al nuevo nodo. |
| `Escape (durante soldadura)`| Cancela la operación de soldadura actual.                                   |
| `Efecto de Chispas`         | Se muestran chispas visuales al completar una conexión, replicando el efecto de `xyOps`. |

---

## 4. Navegación y Vista del Editor

| Acción                      | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Rueda del Ratón`           | Controla el nivel de zoom (acercar/alejar).                                 |
| `Arrastrar el Lienzo Vacío (Clic Izquierdo)` | Permite panear la vista del editor.                                         |
| **Botones en la Barra de Herramientas** |
| `+`                         | Acercar (Zoom In).                                                          |
| `-`                         | Alejar (Zoom Out).                                                          |
| `Home` (o icono similar)    | Restablecer el nivel de zoom y la posición a la vista inicial.              |
| `Ajustar Vista` (Fit View)  | Ajusta automáticamente el zoom para mostrar todos los nodos en pantalla.     |
| **Barra de Búsqueda**       |
| `Clic en icono de Lupa` (o en área de búsqueda) | Abre una barra de búsqueda para encontrar nodos existentes o añadir nuevos tipos de nodos al lienzo. |

---

## 5. Pruebas y Depuración

| Acción                      | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Botón "Ejecutar" (Barra de Herramientas)` | Abre el `Diálogo de Ejecución Avanzada`. Permite proporcionar datos JSON de entrada personalizados para probar el flujo de trabajo. |
| `Panel de Terminal`         | Muestra los registros de ejecución en vivo y el estado de cada nodo durante la ejecución del flujo de trabajo. Útil para depurar. |

---

## 6. Documentación

| Elemento                    | Descripción                                                                 |
| :-------------------------- | :-------------------------------------------------------------------------- |
| `Nodo de Nota`              | Permite añadir notas personalizables directamente en el lienzo del editor. Útil para documentar la lógica, dejar recordatorios o explicaciones para otros usuarios. |
