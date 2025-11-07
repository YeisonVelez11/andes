#!/bin/bash

###############################################################################
# Script para detener la aplicación Andes
###############################################################################

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   🛑 Deteniendo Aplicación Andes${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Verificar que PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ Error: PM2 no está instalado${NC}"
    exit 1
fi

# Detener todos los procesos
echo -e "${RED}🛑 Deteniendo todos los procesos...${NC}"
pm2 stop all

# Mostrar estado
echo -e "\n${BLUE}📊 Estado de procesos:${NC}"
pm2 list

echo -e "\n${GREEN}✅ Aplicación detenida${NC}"
echo -e "${BLUE}💡 Para reiniciar: ./start.sh${NC}\n"
