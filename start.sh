#!/bin/bash

###############################################################################
# Script de inicio para la aplicación Andes
# Inicia el servidor y los cronjobs usando PM2
###############################################################################

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   🚀 Iniciando Aplicación Andes${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Verificar que estamos en el directorio correcto
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Error: No se encontró server.js${NC}"
    echo -e "${RED}   Asegúrate de ejecutar este script desde el directorio del proyecto${NC}"
    exit 1
fi

# Verificar que existe ecosystem.config.js
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}❌ Error: No se encontró ecosystem.config.js${NC}"
    exit 1
fi

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ Error: PM2 no está instalado${NC}"
    echo -e "${YELLOW}   Instálalo con: npm install -g pm2${NC}"
    exit 1
fi

# Crear directorio de logs si no existe
if [ ! -d "logs" ]; then
    echo -e "${YELLOW}📁 Creando directorio de logs...${NC}"
    mkdir -p logs
fi

# Detener procesos existentes (si los hay)
echo -e "${YELLOW}🛑 Deteniendo procesos existentes...${NC}"
pm2 delete all 2>/dev/null || true

# Iniciar aplicación con PM2
echo -e "${GREEN}🚀 Iniciando aplicación con PM2...${NC}"
pm2 start ecosystem.config.js

# Guardar configuración de PM2
echo -e "${GREEN}💾 Guardando configuración de PM2...${NC}"
pm2 save

# Mostrar estado
echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Aplicación iniciada correctamente${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Mostrar información de los procesos
pm2 list

echo -e "\n${BLUE}📊 Información de procesos:${NC}"
echo -e "${GREEN}   • andes-server:${NC} Servidor web (puerto 3000)"
echo -e "${GREEN}   • screenshots-6am:${NC} Cronjob diario a las 6:00 AM"
echo -e "${GREEN}   • screenshots-2pm:${NC} Cronjob diario a las 2:00 PM"

echo -e "\n${BLUE}📝 Comandos útiles:${NC}"
echo -e "${YELLOW}   pm2 logs${NC}              - Ver logs de todos los procesos"
echo -e "${YELLOW}   pm2 logs andes-server${NC} - Ver logs del servidor"
echo -e "${YELLOW}   pm2 status${NC}            - Ver estado de procesos"
echo -e "${YELLOW}   pm2 restart all${NC}       - Reiniciar todos los procesos"
echo -e "${YELLOW}   pm2 stop all${NC}          - Detener todos los procesos"
echo -e "${YELLOW}   pm2 monit${NC}             - Monitor en tiempo real"

echo -e "\n${GREEN}✨ ¡Listo! La aplicación está corriendo.${NC}\n"
