#!/bin/bash

###############################################################################
# Script para monitorear la ejecución del cronjob en tiempo real
###############################################################################

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   👀 Monitoreando Cronjob${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

echo -e "${YELLOW}⏰ Hora actual: $(date '+%H:%M:%S')${NC}"
echo -e "${YELLOW}📅 Fecha: $(date '+%Y-%m-%d')${NC}\n"

echo -e "${GREEN}📝 Monitoreando logs/cron-3pm.log...${NC}"
echo -e "${YELLOW}   Presiona Ctrl+C para salir${NC}\n"

# Mostrar últimas líneas existentes
if [ -f "logs/cron-3pm.log" ]; then
    echo -e "${BLUE}═══ Últimas 5 líneas del log ═══${NC}"
    tail -5 logs/cron-3pm.log
    echo -e "${BLUE}═══════════════════════════════════${NC}\n"
fi

echo -e "${GREEN}Esperando nueva ejecución...${NC}\n"

# Seguir el log en tiempo real
tail -f logs/cron-3pm.log
