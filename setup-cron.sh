#!/bin/bash

###############################################################################
# Script para configurar cronjobs del sistema (alternativa a PM2 cron)
# Este script agrega los cronjobs al crontab del usuario
###############################################################################

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   ⏰ Configurando Cronjobs${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# Obtener directorio actual
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}📁 Directorio del proyecto: ${CURRENT_DIR}${NC}\n"

# Detectar ruta de Node.js
USE_NVM=false
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    # Si usa NVM, cargar y usar Node 20
    echo -e "${YELLOW}🔍 Detectado NVM, usando Node 20...${NC}"
    source "$HOME/.nvm/nvm.sh"
    nvm use 20 > /dev/null 2>&1
    NODE_PATH=$(which node)
    USE_NVM=true
else
    # Buscar Node en ubicaciones comunes
    echo -e "${YELLOW}🔍 Buscando Node.js en el sistema...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_PATH=$(command -v node)
    elif [ -f "/usr/bin/node" ]; then
        NODE_PATH="/usr/bin/node"
    elif [ -f "/usr/local/bin/node" ]; then
        NODE_PATH="/usr/local/bin/node"
    elif [ -f "/opt/homebrew/bin/node" ]; then
        NODE_PATH="/opt/homebrew/bin/node"
    else
        echo -e "${RED}❌ Error: No se pudo encontrar Node.js${NC}"
        echo -e "${YELLOW}   Instala Node.js o configura NVM${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}📍 Ruta de Node.js: ${NODE_PATH}${NC}"

# Verificar versión de Node
NODE_VERSION=$($NODE_PATH --version)
echo -e "${YELLOW}📦 Versión de Node: ${NODE_VERSION}${NC}\n"

# Crear archivo temporal con los cronjobs
CRON_FILE=$(mktemp)

# Obtener crontab actual (si existe)
crontab -l 2>/dev/null > "$CRON_FILE" || true

# Verificar si ya existen los cronjobs
if grep -q "generate-screenshots-today.js" "$CRON_FILE"; then
    echo -e "${YELLOW}⚠️  Los cronjobs ya están configurados${NC}"
    echo -e "${YELLOW}   Eliminando cronjobs existentes...${NC}\n"
    # Eliminar líneas existentes
    sed -i.bak '/generate-screenshots-today.js/d' "$CRON_FILE"
    sed -i.bak '/# Andes - Generación automática de screenshots/d' "$CRON_FILE"
    sed -i.bak '/curl -s "http:\/\/127.0.0.1:3001\/take-screenshot"/d' "$CRON_FILE"
fi

# Agregar nuevos cronjobs
echo "# Andes - Generación automática de screenshots" >> "$CRON_FILE"

if [ "$USE_NVM" = true ]; then
    # Con NVM, necesitamos cargar nvm antes de ejecutar node
    echo -e "${YELLOW}📝 Configurando cronjobs con NVM...${NC}"
    # 08:00 Argentina -> 19:00 Asia/Shanghai
    echo "0 19 * * * export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd $CURRENT_DIR && nvm use 20 && node generate-screenshots-today.js >> logs/cron-8am-ar.log 2>&1" >> "$CRON_FILE"
    # 15:20 Colombia -> 04:20 Asia/Shanghai
    echo "20 4 * * * export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd $CURRENT_DIR && nvm use 20 && node generate-screenshots-today.js >> logs/cron-3pm.log 2>&1" >> "$CRON_FILE"
    # 19:00 Colombia -> 08:00 Asia/Shanghai
    echo "0 8 * * * export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && cd /opt/andes/test/tinarg && nvm use 20 && node trigger-take-screenshot.js >> logs/cron-am.log 2>&1" >> "$CRON_FILE"
else
    # Sin NVM, usar ruta directa de Node
    echo -e "${YELLOW}📝 Configurando cronjobs con Node del sistema...${NC}"
    # 08:00 Argentina -> 19:00 Asia/Shanghai
    echo "0 19 * * * cd $CURRENT_DIR && $NODE_PATH generate-screenshots-today.js >> logs/cron-8am-ar.log 2>&1" >> "$CRON_FILE"
    # 15:20 Colombia -> 04:20 Asia/Shanghai
    echo "20 4 * * * cd $CURRENT_DIR && $NODE_PATH generate-screenshots-today.js >> logs/cron-3pm.log 2>&1" >> "$CRON_FILE"
    # 19:00 Colombia -> 08:00 Asia/Shanghai
    echo "0 8 * * * cd /opt/andes/test/tinarg && $NODE_PATH trigger-take-screenshot.js >> logs/cron-am.log 2>&1" >> "$CRON_FILE"
fi

echo "" >> "$CRON_FILE"

# Instalar nuevo crontab
crontab "$CRON_FILE"

# Limpiar
rm "$CRON_FILE"

echo -e "${GREEN}✅ Cronjobs configurados correctamente${NC}\n"

# Mostrar cronjobs actuales
echo -e "${BLUE}📋 Cronjobs actuales:${NC}"
crontab -l | grep -A 2 "Andes"

echo -e "\n${BLUE}⏰ Horarios programados:${NC}"
echo -e "${GREEN}   • 6:00 AM${NC}  - Genera screenshots diarios"
echo -e "${GREEN}   • 3:20 PM${NC}  - Genera screenshots diarios"

echo -e "\n${BLUE}📝 Logs de cronjobs:${NC}"
echo -e "${YELLOW}   tail -f logs/cron-6am.log${NC}"
echo -e "${YELLOW}   tail -f logs/cron-3pm.log${NC}"

echo -e "\n${BLUE}🗑️  Para eliminar los cronjobs:${NC}"
echo -e "${YELLOW}   crontab -e${NC}"
echo -e "${YELLOW}   # Eliminar las líneas de 'Andes'${NC}\n"
