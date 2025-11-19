#!/bin/bash

# Script para reiniciar PM2 de forma segura

echo "🔄 Reiniciando PM2 de forma segura..."
echo ""

# 1. Detener y eliminar todas las instancias
echo "1️⃣ Deteniendo PM2..."
pm2 delete all 2>/dev/null || true
pm2 kill

echo "   Esperando 5 segundos para que todo cierre..."
sleep 5

# 2. Matar cualquier proceso en puerto 3000
echo "2️⃣ Liberando puerto 3000..."
PIDS=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "   Matando procesos: $PIDS"
    echo "$PIDS" | xargs kill -9
    sleep 1
fi

# 3. Verificar que el puerto está libre
echo "3️⃣ Verificando puerto 3000..."
REMAINING=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$REMAINING" ]; then
    echo "   ❌ Error: Puerto 3000 sigue ocupado"
    lsof -i:3000
    exit 1
fi
echo "   ✅ Puerto 3000 libre"

# 4. Iniciar PM2
echo "4️⃣ Iniciando PM2..."
pm2 start ecosystem.config.js

sleep 3

# 5. Verificar estado
echo "5️⃣ Estado de PM2:"
pm2 list

echo ""
echo "6️⃣ Logs recientes:"
pm2 logs andes-server --lines 10 --nostream

echo ""
echo "✅ Reinicio completado"
echo ""
echo "💡 Para ver logs en tiempo real:"
echo "   pm2 logs andes-server"
