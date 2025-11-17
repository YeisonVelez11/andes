#!/bin/bash

# Script para instalar dependencias de Chrome/Chromium en servidores sin GUI
# Detecta automáticamente el sistema operativo

echo "🔧 Instalando dependencias de Chrome para Puppeteer..."
echo ""

# Detectar sistema operativo
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "❌ No se pudo detectar el sistema operativo"
    exit 1
fi

echo "📦 Sistema detectado: $OS $VERSION"
echo ""

# Instalar según el sistema operativo
case $OS in
    ubuntu|debian)
        echo "🔧 Instalando dependencias para Ubuntu/Debian..."
        sudo apt-get update
        
        sudo apt-get install -y \
            ca-certificates \
            fonts-liberation \
            libasound2 \
            libatk-bridge2.0-0 \
            libatk1.0-0 \
            libatspi2.0-0 \
            libc6 \
            libcairo2 \
            libcups2 \
            libdbus-1-3 \
            libdrm2 \
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
            libxkbcommon0 \
            libxrandr2 \
            libxrender1 \
            libxshmfence1 \
            libxss1 \
            libxtst6 \
            lsb-release \
            wget \
            xdg-utils
        ;;
        
    centos|rhel|rocky|almalinux)
        echo "🔧 Instalando dependencias para CentOS/RHEL/Rocky..."
        sudo yum install -y \
            alsa-lib \
            atk \
            at-spi2-atk \
            cairo \
            cups-libs \
            dbus-glib \
            expat \
            fontconfig \
            GConf2 \
            glib2 \
            gtk3 \
            libdrm \
            libgbm \
            libX11 \
            libXcomposite \
            libXcursor \
            libXdamage \
            libXext \
            libXfixes \
            libXi \
            libxkbcommon \
            libXrandr \
            libXrender \
            libXScrnSaver \
            libxshmfence \
            libXtst \
            mesa-libgbm \
            nspr \
            nss \
            pango \
            wget
        ;;
        
    fedora)
        echo "🔧 Instalando dependencias para Fedora..."
        sudo dnf install -y \
            alsa-lib \
            atk \
            at-spi2-atk \
            cairo \
            cups-libs \
            dbus-glib \
            expat \
            fontconfig \
            glib2 \
            gtk3 \
            libdrm \
            libgbm \
            libX11 \
            libXcomposite \
            libXcursor \
            libXdamage \
            libXext \
            libXfixes \
            libXi \
            libxkbcommon \
            libXrandr \
            libXrender \
            libXScrnSaver \
            libxshmfence \
            libXtst \
            mesa-libgbm \
            nspr \
            nss \
            pango \
            wget
        ;;
        
    *)
        echo "❌ Sistema operativo no soportado: $OS"
        echo "Por favor, instala las dependencias manualmente"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencias instaladas exitosamente"
    echo ""
    echo "🔄 Reiniciando servidor PM2..."
    pm2 restart andes-server
    echo ""
    echo "📊 Ver logs:"
    echo "   pm2 logs andes-server --lines 50"
    echo ""
    echo "🧪 Probar captura de HTML:"
    echo "   cd /opt/andes && node generate-screenshots-today.js"
else
    echo ""
    echo "❌ Error instalando dependencias"
    exit 1
fi
