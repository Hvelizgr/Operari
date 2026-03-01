# 🌍 Estrategia de Multi-region Failover para NanoFlow

Para garantizar la alta disponibilidad global y el cumplimiento de requisitos enterprise, NanoFlow soporta despliegues multi-región.

## 🚀 Arquitectura Global

NanoFlow utiliza un esquema **Active-Active** o **Active-Passive** dependiendo de la configuración de la base de datos.

### 1. Balanceo de Carga Global (GSLB)
Se utiliza un balanceador de carga global (como AWS Global Accelerator, Google Cloud Load Balancing o Cloudflare) para redirigir el tráfico a la región más cercana al usuario o a la región saludable en caso de fallo.

### 2. Base de Datos (PostgreSQL)
Se recomienda el uso de **Aurora Global Database** (AWS) o **Spanner** (GCP) para replicación de baja latencia entre regiones.
- **Primaria**: Escritura y Lectura.
- **Secundaria**: Réplica de lectura con capacidad de promoción rápida a Primaria.

### 3. Redis (Cache & Queues)
Utilizamos **Redis Global Datastore** para sincronizar el estado de las colas de Bull y el cache de límites entre regiones.

## 🛠️ Pasos para Failover Automático

1.  **Monitoreo**: El GSLB realiza Health Checks constantes a los endpoints `/health` de cada región.
2.  **Detección de Fallo**: Si una región deja de responder (ej. latencia > 5s o 5xx errors), el GSLB la marca como *Unhealthy*.
3.  **Redirección**: El tráfico se redirige instantáneamente a la siguiente región disponible.
4.  **Promoción de DB**: Si la región primaria falla, el script de automatización (`scripts/promote-db.sh`) promueve la réplica de la región secundaria a primaria.

## 📦 Configuración de Kubernetes

Consulte `global-load-balancer.yaml` en este directorio para ver un ejemplo de configuración de Ingress multi-cluster.
