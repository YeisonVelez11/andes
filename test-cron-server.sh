#!/bin/bash

###############################################################################
# Script de prueba para simular el entorno del servidor (sin NVM)
# Esto te permite probar cómo funcionarán los cronjobs en producción
###############################################################################

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   🧪 Prueba de Cronjob (Modo Servidor)${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Obtener directorio actual
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}📁 Directorio: ${CURRENT_DIR}${NC}"

# Buscar Node sin usar NVM (simulando servidor)
echo -e "${YELLOW}🔍 Buscando Node.js (sin NVM)...${NC}"

if command -v node &> /dev/null; then
    NODE_PATH=$(command -v node)
    echo -e "${GREEN}✅ Node encontrado: ${NODE_PATH}${NC}"
    
    NODE_VERSION=$($NODE_PATH --version)
    echo -e "${YELLOW}📦 Versión: ${NODE_VERSION}${NC}\n"
    
    # Ejecutar el script como lo haría el cronjob en el servidor
    echo -e "${BLUE}🚀 Ejecutando script...${NC}\n"
    cd "$CURRENT_DIR" && $NODE_PATH generate-screenshots-today.js
    
else
    echo -e "${RED}❌ Error: Node.js no encontrado${NC}"
    echo -e "${YELLOW}   En el servidor, asegúrate de que Node esté instalado globalmente${NC}"
    exit 1
fi
