# Guía de Comandos Docker para NanoFlow

Este documento resume los comandos principales para gestionar la infraestructura del proyecto usando Docker Compose.

## 🚀 Comandos Principales

### Iniciar el Entorno

Levanta todos los servicios (Frontend, Backend, Postgres, Redis, Jaeger) en segundo plano.

```bash
docker-compose up -d
```

### Iniciar y Reconstruir

Si has instalado nuevas dependencias o modificado Dockerfiles, usa este comando para forzar una reconstrucción de las imágenes.

```bash
docker-compose up -d --build
```

### Detener el Entorno

Detiene y elimina los contenedores y redes creados por `up`.

```bash
docker-compose down
```

### Ver Logs

Muestra los logs de todos los servicios en tiempo real.

```bash
docker-compose logs -f
```

_Para ver un servicio específico:_ `docker-compose logs -f backend`

### Ver Estado de Contenedores

Muestra qué contenedores están corriendo y sus puertos.

```bash
docker-compose ps
```

---

## 🧹 Limpieza y Mantenimiento

### Limpieza Profunda

Si necesitas reiniciar la base de datos desde cero (borrar todos los datos), añade el flag `-v` (volumes).

```bash
# ¡CUIDADO! Esto borra todos los datos de la BD y Redis
docker-compose down -v
```

### Eliminar Contenedores Huérfanos

Si cambiaste nombres de servicios en el `docker-compose.yml`, pueden quedar contenedores viejos.

```bash
docker-compose down --remove-orphans
```

### Limpieza del Sistema (Liberar Espacio)

Elimina todos los contenedores detenidos, redes no usadas e imágenes "colgantes" (builds antiguos).

```bash
docker system prune
```

Para una limpieza total (incluyendo imágenes no usadas): `docker system prune -a`

---

## 🛠 Desarrollo Híbrido (Recomendado)

Para desarrollar más rápido, puedes levantar solo la infraestructura en Docker y correr el código de la aplicación localmente con Node.js.

1. **Levantar solo infraestructura (BD, Redis, Tracing):**

   ```bash
   docker-compose up -d postgres redis jaeger
   ```

2. **Correr la aplicación (Frontend + Backend):**
   ```bash
   npm run dev
   ```

> **Nota:** En este modo, Postgres estará accesible en el puerto `5433` de tu máquina local y Redis en el `6379`.
