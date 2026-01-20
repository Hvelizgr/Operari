#!/bin/bash

echo "🚀 Inicializando NanoFlow..."

# 1. Levantar infraestructura mínima
echo "📦 Iniciando Docker containers (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

# 2. Esperar a que DB esté lista
echo "⏳ Esperando a PostgreSQL..."
sleep 5

# 3. Sincronizar schema
echo "🔄 Sincronizando schema de Prisma..."
npx prisma db push

# 4. Instalar dependencias
echo "📥 Instalando dependencias..."
npm install

echo "✅ NanoFlow listo para desarrollo!"
echo "📌 Ejecuta 'npm run dev' para iniciar el servidor de desarrollo"
