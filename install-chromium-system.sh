#!/bin/bash

# Script alternativo: Instalar Chromium desde repositorios del sistema
# Útil si npx puppeteer browsers install falla

echo "🔧 Instalando Chromium desde repositorios del sistema..."

# Detectar sistema operativo
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    echo "📦 Sistema: Debian/Ubuntu"
    sudo apt-get update
    sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg
    
    # Instalar dependencias adicionales
    sudo apt-get install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils
        
    CHROME_PATH=$(which chromium-browser)
    
elif [ -f /etc/redhat-release ]; then
    # CentOS/RHEL/Fedora
    echo "📦 Sistema: RedHat/CentOS/Fedora"
    sudo yum install -y chromium
    CHROME_PATH=$(which chromium)
    
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

echo ""
echo "✅ Chromium instalado en: $CHROME_PATH"
echo ""
echo "🔧 Configurando Puppeteer para usar Chromium del sistema..."

# Crear archivo de configuración para Puppeteer
cat > /opt/andes/.puppeteerrc.cjs << EOF
const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  executablePath: '$CHROME_PATH',
};
EOF

echo "✅ Configuración creada en /opt/andes/.puppeteerrc.cjs"
echo ""
echo "🎉 Instalación completada!"
echo "💡 Ahora reinicia el servidor con: pm2 restart andes-server"
