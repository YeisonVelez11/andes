#!/bin/bash

# Script para matar procesos que usan el puerto 3000

echo "🔍 Buscando procesos en puerto 3000..."
echo ""

# Buscar procesos usando el puerto 3000
PIDS=$(lsof -ti:3000)

if [ -z "$PIDS" ]; then
    echo "✅ No hay procesos usando el puerto 3000"
    exit 0
fi

echo "⚠️ Procesos encontrados:"
lsof -i:3000
echo ""

echo "🔪 Matando procesos..."
echo "$PIDS" | xargs kill -9

sleep 1

# Verificar que se mataron
REMAINING=$(lsof -ti:3000)
if [ -z "$REMAINING" ]; then
    echo "✅ Puerto 3000 liberado"
else
    echo "❌ Algunos procesos siguen corriendo:"
    lsof -i:3000
fi
