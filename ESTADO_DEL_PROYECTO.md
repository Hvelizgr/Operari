# Estado Actual del Proyecto NanoFlow

Este documento unifica la información de toda la documentación existente para proporcionar una visión clara y consolidada del estado del proyecto NanoFlow, qué se ha completado, cuáles son los bloqueos actuales y cuál es el camino a seguir.

---

## 1. Resumen Ejecutivo

NanoFlow es una plataforma de automatización de flujos de trabajo con una base de editor visual robusta y una gran cantidad de características avanzadas ya implementadas. El proyecto ha pasado por varias fases de mejora intensiva:

*   **Port de xyOps:** Se ha completado al 100% la migración de todas las funcionalidades del editor de `xyOps`, incluyendo el sistema de "soldadura" de conexiones, las herramientas de edición y los efectos visuales.
*   **Mejoras inspiradas en n8n:** Se han implementado numerosas mejoras de UX/UI para igualar las mejores prácticas de `n8n`, como estados visuales de nodos, barras de herramientas flotantes y un sistema de conexiones avanzado.
*   **Inteligencia de Flujo (CodeFlow):** Se han añadido características de análisis estático como un "Workflow Doctor" que detecta problemas de seguridad (secretos) y de estructura en tiempo real.

**Estado actual:** La base del editor es funcional y rica en características. Sin embargo, existen **dos bloqueos críticos** que impiden que la aplicación se sienta completa: el ciclo de carga de flujos desde el backend no está implementado y falta un endpoint clave para la depuración visual.

---

## 2. Funcionalidades Implementadas (Consolidado)

La siguiente es una lista de las principales funcionalidades que ya han sido **implementadas y verificadas**:

### Editor y UX
*   **Sistema de Herramientas (xyOps):** Modos de Dibujar (D) y Mover (M).
*   **Sistema de Soldadura (xyOps):** Conexiones fluidas click-to-connect y con arrastre.
*   **Copia Profunda y Duplicación:** Copiar/Pegar (`Ctrl+C/V`) y Duplicar (`Ctrl+D`) nodos y selecciones con remapeo de conexiones.
*   **Deshacer/Rehacer Robusto (`useAdvancedUndoRedo`):** Sistema basado en el patrón Command con historial de hasta 50 estados.
*   **Borradores Locales y Auto-guardado (`useAutosave`):** Guardado automático a `localStorage` y al backend con detección de conflictos y modo offline.
*   **Nudge con Teclado:** Movimiento preciso de nodos con las flechas del teclado (1px normal, 10px con Shift).
*   **Barra de Herramientas Flotante:** Acciones rápidas (Ejecutar, Desactivar, Borrar, etc.) al pasar el ratón sobre un nodo.
*   **Compensación de Zoom:** La UI del nodo (iconos, botones) se escala para mantener la legibilidad con el zoom.

### Nodos y Conexiones
*   **Nodos Especiales:**
    *   **Sticky Notes:** Con soporte completo de Markdown, 7 colores y modo "ancho".
    *   **Frame Nodes:** Para agrupar nodos, con capacidad de colapsar, 7 colores y conteo de nodos internos.
*   **Sistema de Puertos Avanzado:** Puertos dinámicos (Main, Data, Error, Config) con colores y posicionamiento según el tipo de nodo.
*   **Condiciones en Conexiones:** Posibilidad de definir si una conexión se activa en "Éxito", "Error", "Siempre", "Verdadero" o "Falso", con colores y estilos distintivos.
*   **Triggers Interactivos:** Diseño visual mejorado para nodos de disparo con botón de ejecución rápida.
*   **Tamaño Dinámico de Nodos:** Los nodos se auto-ajustan según la cantidad de puertos o contenido.

### Inteligencia y Observabilidad
*   **Workflow Doctor (`useWorkflowDoctor`):** Panel que analiza el flujo en tiempo real y detecta:
    *   Secretos/claves API hardcodeadas.
    *   Nodos desconectados o huérfanos.
    *   Ciclos infinitos potenciales.
    *   IDs duplicados.
*   **Heatmap de Ejecución (`useExecutionHeatmap`):** Visualización de la frecuencia de ejecución y fallos de los nodos directamente en el editor.
*   **Efectos Visuales:**
    *   **Confetti Avanzado:** Partículas que se originan desde el puerto de conexión.
    *   **Borde Animado:** Borde rotatorio en nodos en ejecución.

### Funcionalidades Base
*   Paleta de Comandos (`Ctrl+K`), Terminal de Logs, Snapshots/Versiones, Auto-Layout, Panel de Propiedades, Galería de Plantillas, Zoom, MiniMapa, etc.

---

## 3. Bloqueos Críticos y Próximos Pasos Inmediatos

A pesar de la gran cantidad de funcionalidades, la aplicación se siente "incompleta" por dos razones principales que deben ser la **máxima prioridad**:

1.  **El Ciclo de Persistencia está Roto:**
    *   **El Problema:** El editor **guarda** los cambios correctamente (`useAutosave` funciona), pero **no carga** el flujo de trabajo desde la base de datos al iniciar. Siempre muestra un lienzo vacío o el borrador de `localStorage`.
    *   **Solución Inmediata:** Implementar la lógica de carga inicial en el editor para hacer una petición `GET /api/workflows/:id` y poblar el lienzo con los datos del backend.

2.  **La Depuración Visual no Funciona:**
    *   **El Problema:** El frontend está preparado para un modo de depuración visual (el "micro-ratón" que recorre el flujo), pero el endpoint de backend `POST /api/executions/.../debug` **no existe**.
    *   **Solución Inmediata:** Crear el endpoint de `debug` en `backend/src/routes/execution.routes.ts` para permitir la ejecución paso a paso y la visualización en el frontend.

---

## 4. Roadmap de Futuras Funcionalidades

Una vez solucionados los bloqueos, el roadmap de nuevas funcionalidades es el siguiente, ordenado por prioridad:

### Fase 1: Cimientos de Producción
*   **Gestor de Secretos y Variables:** Un sistema centralizado y seguro para gestionar credenciales (Vaults).
*   **Admin y Seguridad (RBAC):** Gestión de usuarios, roles, permisos y claves de API con expiración.
*   **Nodos de Control de Flujo:** Implementar nodos esenciales como **Wait/Delay**, **Loop/Repeat** y **Branch/Switch**.

### Fase 2: Observabilidad y Gestión
*   **Dashboard Central:** Panel con métricas clave, trabajos activos y estado del sistema.
*   **Monitores y Alertas:** UI para configurar monitores de infraestructura y umbrales de alerta.
*   **Versionado de Flujos:** Historial de revisiones con capacidad de "revertir" a una versión anterior.

### Fase 3: Funcionalidades Avanzadas
*   **Visual Debugger Completo:** Soporte para breakpoints, inspección de datos paso a paso.
*   **Colaboración en Tiempo Real:** Edición multijugador estilo Figma.
*   **Marketplace de Plantillas y Nodos:** Plataforma para compartir y reutilizar flujos y plugins.
*   **Asistente AI:** Ayuda para construir y optimizar flujos.

---

## 5. Guías de Referencia

*   **Atajos de Teclado:** Para una lista completa de las interacciones del editor, consulta el archivo `shortcuts_guide.md`.
*   **Desarrollo y Contribución:** Para pautas sobre cómo usar las herramientas de IA (`Agent Skills`) para optimizar y desplegar código, consulta `docs/SKILLS-GUIDE.md`.
