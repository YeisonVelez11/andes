#!/bin/bash

# Script para diagnosticar problemas con imágenes rotas

echo "🔍 Diagnóstico de Imágenes"
echo "=========================="
echo ""

# 1. Verificar que la carpeta existe
echo "📁 Verificando carpeta imagenes_cargadas..."
if [ -d "config_local/imagenes_cargadas" ]; then
    echo "✅ Carpeta existe"
    
    # Contar archivos
    FILE_COUNT=$(find config_local/imagenes_cargadas -type f | wc -l)
    echo "📊 Archivos encontrados: $FILE_COUNT"
    
    # Mostrar últimos 5 archivos
    echo ""
    echo "📋 Últimos 5 archivos:"
    ls -lh config_local/imagenes_cargadas/ | tail -5
else
    echo "❌ Carpeta NO existe"
    exit 1
fi

echo ""
echo "---"
echo ""

# 2. Verificar permisos
echo "🔐 Verificando permisos..."
ls -ld config_local/imagenes_cargadas/
PERMS=$(stat -c "%a" config_local/imagenes_cargadas/ 2>/dev/null || stat -f "%A" config_local/imagenes_cargadas/)
echo "Permisos: $PERMS"

if [ "$PERMS" -ge "755" ]; then
    echo "✅ Permisos correctos"
else
    echo "⚠️ Permisos insuficientes, corrigiendo..."
    chmod 755 config_local/imagenes_cargadas/
    chmod 644 config_local/imagenes_cargadas/*
    echo "✅ Permisos corregidos"
fi

echo ""
echo "---"
echo ""

# 3. Verificar JSONs con rutas de imágenes
echo "📄 Verificando JSONs con imágenes..."
if [ -d "config_local/jsones" ]; then
    LATEST_JSON=$(ls -t config_local/jsones/*.json 2>/dev/null | head -1)
    
    if [ -n "$LATEST_JSON" ]; then
        echo "📋 JSON más reciente: $(basename $LATEST_JSON)"
        echo ""
        echo "🖼️ Rutas de imágenes en el JSON:"
        cat "$LATEST_JSON" | grep -o '"/image/[^"]*"' | head -5
        echo ""
        
        # Extraer un fileId de ejemplo
        SAMPLE_FILE_ID=$(cat "$LATEST_JSON" | grep -o '/image/[a-f0-9]*' | head -1 | cut -d'/' -f3)
        
        if [ -n "$SAMPLE_FILE_ID" ]; then
            echo "🔍 FileId de ejemplo: $SAMPLE_FILE_ID"
            echo ""
            echo "🧪 Probando si el archivo existe..."
            
            # Buscar el archivo por MD5
            FOUND_FILE=$(find config_local/imagenes_cargadas -type f -exec md5sum {} \; 2>/dev/null | grep "$SAMPLE_FILE_ID" | cut -d' ' -f3)
            
            if [ -n "$FOUND_FILE" ]; then
                echo "✅ Archivo encontrado: $FOUND_FILE"
                ls -lh "$FOUND_FILE"
            else
                echo "❌ Archivo NO encontrado con ese fileId"
                echo ""
                echo "💡 Esto puede significar:"
                echo "   - El fileId en el JSON no coincide con el MD5 del archivo"
                echo "   - El archivo fue eliminado"
                echo "   - Hay un problema en la generación del fileId"
            fi
        fi
    else
        echo "⚠️ No hay archivos JSON"
    fi
else
    echo "❌ Carpeta jsones NO existe"
fi

echo ""
echo "---"
echo ""

# 4. Probar endpoint del servidor
echo "🌐 Probando endpoint /image/..."
if command -v curl &> /dev/null; then
    # Obtener un fileId del JSON
    if [ -n "$SAMPLE_FILE_ID" ]; then
        echo "🧪 Probando: http://localhost:3000/image/$SAMPLE_FILE_ID"
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/image/$SAMPLE_FILE_ID")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ Endpoint responde correctamente (200 OK)"
        else
            echo "❌ Endpoint falló (HTTP $HTTP_CODE)"
        fi
    else
        echo "⚠️ No hay fileId para probar"
    fi
else
    echo "⚠️ curl no está instalado, saltando prueba"
fi

echo ""
echo "---"
echo ""

# 5. Ver logs del servidor
echo "📊 Últimos logs relacionados con imágenes:"
if command -v pm2 &> /dev/null; then
    pm2 logs andes-server --lines 50 --nostream | grep -i "imagen\|image" | tail -10
else
    echo "⚠️ PM2 no está instalado"
fi

echo ""
echo "=========================="
echo "🎯 Diagnóstico completado"
echo ""
echo "💡 Para ver logs en tiempo real:"
echo "   pm2 logs andes-server | grep image"
