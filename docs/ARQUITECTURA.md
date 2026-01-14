# Arquitectura Técnica de NanoFlow

NanoFlow sigue una arquitectura moderna, escalable y desacoplada, dividida claramente entre un Frontend interactivo (SPA) y un Backend robusto (API REST).

## Diagrama de Alto Nivel

```mermaid
graph TD
    User[Usuario] -->|HTTPS| Frontend[Frontend (Next.js)]
    Frontend -->|API REST / Auth| Backend[Backend (Express Node.js)]
    
    subgraph "Frontend Layer"
        Canvas[Editor Canvas]
        State[Zustand/React State]
        UndoRedo[Command Stack]
        UI[Tailwind + Framer Motion]
    end
    
    subgraph "Backend Layer"
        API[API Gateway / Routes]
        Auth[Auth Service (JWT)]
        ExecEngine[Execution Engine]
        Scheduler[Cron Scheduler]
        Prisma[Prisma ORM]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL)]
    end
    
    subgraph "External Services"
        SMTP[Email Server]
        Webhooks[External Webhooks]
        3rdParty[Third Party APIs]
    end

    Backend --> Prisma --> DB
    ExecEngine --> SMTP
    ExecEngine --> 3rdParty
    Webhooks -->|Trigger| Backend
```

## 1. Frontend (Cliente)
Aplicación construida con **Next.js 15 (App Router)** usando TypeScript.

### Tecnologías Clave:
-   **React 19**: Biblioteca de UI base.
-   **Tailwind CSS**: Motor de estilos utilitarios.
-   **Framer Motion**: Librería para animaciones complejas (drag & drop, transiciones, layout).
-   **Lucide React**: Iconografía consistente.

### patrones de Diseño:
-   **Component-Based**: Arquitectura atómica (Botones, Inputs) escalando a organismos (Nodos, Canvas).
-   **Command Pattern**: Utilizado para el sistema de Deshacer/Rehacer, encapsulando cada acción del usuario (mover, crear, conectar) en objetos reversibles.
-   **Optimistic UI**: La interfaz reacciona inmediatamente a las acciones del usuario mientras procesa la lógica.

## 2. Backend (Servidor)
API RESTful construida con **Node.js y Express**, diseñada para ser escalable y modular.

### Tecnologías Clave:
-   **TypeScript**: Tipado estático en todo el servidor.
-   **Prisma ORM**: Capa de abstracción de base de datos tipo-segura.
-   **Zod**: Validación de esquemas de entrada en tiempo de ejecución.
-   **Node-Cron**: Gestión de tareas programadas en memoria (escalable a Redis/Queue en el futuro).
-   **Jest**: Framework de testing.

### Módulos Principales:
1.  **Auth Module**: Maneja registro, login y middleware de JWT. Soporta multi-tenancy (Usuarios pertenecen a Organizaciones/Tenants).
2.  **Workflow Module**: CRUD de flujos. Gestiona la estructura JSON de nodos y conexiones.
3.  **Execution Engine**:
    *   El "cerebro" que interpreta el grafo del flujo.
    *   Utiliza un algoritmo de recorrido (BFS/DFS modificado) para ejecutar nodos en orden de dependencia.
    *   Gestiona el paso de datos (inputs/outputs) entre nodos.
4.  **Scheduler Service**: Servicio en segundo plano que vigila las expresiones CRON de los flujos activos y dispara ejecuciones.
5.  **Analytics Module**: Agregación de datos de `Execution` y `NodeLog` para reportes.

## 3. Base de Datos (Modelo de Datos)
PostgreSQL es el motor persistente. El esquema principal incluye:

-   **Tenant/User**: Estructura jerárquica para SaaS B2B.
-   **Workflow**: Almacena la definición del flujo (JSON blobs para `nodes` y `connections`).
-   **Execution**: Instancia de una corrida de flujo (Status: PENDING, RUNNING, SUCCESS, FAILED).
-   **NodeLog**: Registro granular de cada paso dentro de una ejecución (Input, Output, Duración, Error).
-   **ScheduledJob**: Tabla auxiliar para la persistencia de cron jobs.

## 4. Consideraciones de Seguridad
-   **JWT (Stateless Auth)**: Tokens firmados para autenticación.
-   **Helmet**: Headers de seguridad HTTP.
-   **Rate Limiting**: Protección contra DDOS y abuso de API.
-   **Input Validation**: Todo input pasa por validación estricta con Zod antes de procesarse.
-   **No Code Injection**: Aunque hay un nodo "Transform" con JS, la implementación actual usa `new Function` (sandbox limitado). En producción se recomienda `vm2`.
