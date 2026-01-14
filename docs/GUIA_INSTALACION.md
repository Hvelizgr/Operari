# Guía de Instalación y Configuración

Sigue estos pasos para levantar el entorno de desarrollo completo de **NanoFlow** (Frontend + Backend).

## Prerrequisitos
-   **Node.js**: v18 o superior.
-   **npm**: v9 o superior.
-   **Docker** (opcional, pero recomendado para la base de datos PostgreSQL).
-   **PostgreSQL**: Si no usas Docker, necesitas una instancia local corriendo.

---

## 1. Configuración del Backend (API)

El backend se encuentra en la carpeta `/api`.

1.  **Navegar al directorio**:
    ```bash
    cd api
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Copia el archivo de ejemplo y configúralo.
    ```bash
    cp .env.example .env
    ```
    *Asegúrate de que `DATABASE_URL` apunte a tu instancia de PostgreSQL.*

4.  **Inicializar la Base de Datos**:
    Ejecuta las migraciones de Prisma para crear las tablas.
    ```bash
    npm run db:migrate
    ```

5.  **Iniciar el servidor**:
    ```bash
    npm run dev
    ```
    El servidor correrá en `http://localhost:4000`.

---

## 2. Configuración del Frontend

El frontend se encuentra en la raíz del proyecto.

1.  **Volver a la raíz** (si estabas en `/api`):
    ```bash
    cd ..
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Iniciar el servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:3000`.

---

## 3. Herramientas de Desarrollo

### Testing
*   **Unit Tests**: `npm test`
*   **E2E Tests**: `npm run test:e2e` (Requiere el servidor corriendo)
*   **Ver Cobertura**: `npm run test:coverage`

### Documentación de Componentes (Storybook)
Para ver la galería de componentes UI y probarlos aisladamente:
```bash
npm run storybook
```
Abre `http://localhost:6006` en tu navegador.

### Linting y Formato
*   Revisar código: `npm run lint`
*   Corregir estilo: `npm run format`

---

## Solución de Problemas Comunes

**Error: "Database connection failed"**
*   Verifica que Docker/Postgres esté corriendo.
*   Revisa que la `DATABASE_URL` en `api/.env` sea correcta (usuario, contraseña, puerto).

**Error: "Missing types for mdx"**
*   Asegúrate de haber ejecutado `npm install` en la raíz. El archivo `tsconfig.json` ya fue parcheado para manejar este problema de Storybook.

**Error: Puertos ocupados**
*   Frontend usa 3000 por defecto. Backend usa 4000. Si están ocupados, cámbialos en `package.json` (frontend) o `.env` (backend).
