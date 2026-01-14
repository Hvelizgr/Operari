# 🆔 Identidad del Proyecto: NanoFlow Business Suite

Este documento define la visión integral del proyecto. NanoFlow no es solo una herramienta educativa; es el ecosistema central para un negocio completo de automatización.

## 1. El Negocio (Los 4 Pilares)

El proyecto existe para habilitar y potenciar estas cuatro líneas de negocio simultáneas:

1.  **🛒 Venta de Automatizaciones (Marketplace/Product)**:
    - La plataforma debe permitir empaquetar flujos como "productos" que los clientes pueden comprar y usar.
    - Necesita gestión de licencias o acceso a plantillas premium.
2.  **⚡ Hacer Automatizaciones en Línea (SaaS)**:
    - Funcionalidad core: Ejecutar flujos reales, estables y potentes en la nube para clientes.
    - Requiere alta disponibilidad, manejo de errores robusto y escalabilidad.
3.  **🤝 Mentoría y Asesoría (Services)**:
    - Herramientas colaborativas dentro de la plataforma para auditar, corregir y mejorar flujos de clientes en tiempo real.
    - El "modo experto" para consultores.
4.  **🎓 Enseñanza (Academy)**:
    - La capa educativa que utiliza la arquitectura transparente (tipo n8n) para formar a nuevos automatizadores.

## 2. Estado Actual: ¿Qué tengo? (Análisis Técnico)

**NanoFlow** es una plataforma SaaS de orquestación de workflows (Full-Stack), actualmente funcional y contenerizada.

### 🏗️ Arquitectura
- **Tipo:** Monorepo con servicios separados (Cliente, Servidor, DB).
- **Infraestructura:** Todo orquestado con **Docker Compose**.
- **Base de Datos:** PostgreSQL 16 (persistencia con volúmenes Docker).

### 🛠️ Stack Tecnológico
#### Frontend (`/app`) - "La Vitrina y el Taller"
- **Framework:** Next.js 15 (App Router).
- **Estilo:** Tailwind CSS + Framer Motion.
- **Enfoque:** UX Premium tanto para el cliente final (simple) como para el estudiante/desarrollador (detallado).

#### Backend (`/api`) - "La Fábrica"
- **Framework:** Express.js + TypeScript.
- **ORM:** Prisma.
- **Ejecución:** Isomorfismo con n8n para compatibilidad y potencia real.
- **Seguridad:** Crítica para manejo de datos de clientes reales (JWT, bcrypt).

## 3. "Mi Forma de Pensar": Filosofía Híbrida

La filosofía es **"Producción Educativa"**: La herramienta debe ser lo suficientemente potente para cobrar por ella (Pilar 1 y 2), y lo suficientemente transparente para enseñar con ella (Pilar 3 y 4).

### 🧠 Principios Rectores
1.  **Potencia Comercial**: No es un juguete. Debe soportar cargas de trabajo reales de clientes que pagan.
2.  **Transparencia Estructural (n8n)**: Mantener la arquitectura alineada con n8n permite vender consultoría sobre n8n usando NanoFlow como herramienta pedagógica o de staging.
3.  **Dualidad de Interfaz**:
    - **Modo Cliente**: "Solo quiero que funcione" (Ejecución simple, Dashboards).
    - **Modo Maker/Alumno**: "Quiero ver cómo funciona" (Debug visual, introspección).

## 4. Estrategia de Desarrollo

El Agente priorizará funcionalidades que sirvan a múltiples pilares a la vez:
- **Prioridad Alta**: Estabilidad del motor de ejecución (Sirve a Ventas, SaaS y Enseñanza).
- **Prioridad Media**: UI de "Caja Negra" vs "Caja Blanca" (Para diferenciar al cliente del alumno).
