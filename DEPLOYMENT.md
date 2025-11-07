# Guía de Despliegue en Servidor Linux con Nginx

## 📋 Requisitos Previos

- Servidor Linux (Ubuntu 20.04+ o similar)
- Acceso root o sudo
- Dominio o subdominio apuntando al servidor (opcional pero recomendado)

## 🗂️ Estructura de Directorios Recomendada

```
/var/www/
└── andes/
    ├── server.js
    ├── scraper-losandes.js
    ├── puppeteer-config.js
    ├── date-utils.js
    ├── package.json
    ├── .env
    ├── public/
    │   ├── index.html
    │   ├── js/
    │   │   └── app.js
    │   ├── css/
    │   └── images/
    ├── node_modules/
    └── logs/
```

## 🚀 Pasos de Instalación

### 1. Instalar Dependencias del Sistema

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (v18 o superior)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Nginx
sudo apt install -y nginx

# Instalar PM2 (gestor de procesos para Node.js)
sudo npm install -g pm2

# Instalar dependencias de Puppeteer
sudo apt install -y \
    chromium-browser \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils
```

### 2. Crear Usuario para la Aplicación

```bash
# Crear usuario sin privilegios de root
sudo useradd -r -s /bin/bash -d /var/www/andes andes

# Crear directorio de la aplicación
sudo mkdir -p /var/www/andes
sudo chown -R andes:andes /var/www/andes
```

### 3. Subir Archivos al Servidor

```bash
# Desde tu máquina local, comprimir el proyecto
cd /Users/yevelez/fury_4/andes
tar -czf andes.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    .

# Subir al servidor (reemplaza IP_SERVIDOR con tu IP)
scp andes.tar.gz root@IP_SERVIDOR:/tmp/

# En el servidor, descomprimir
sudo su - andes
cd /var/www/andes
tar -xzf /tmp/andes.tar.gz
```

### 4. Instalar Dependencias de Node.js

```bash
cd /var/www/andes
npm install --production

# Configurar Puppeteer para usar Chromium del sistema
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 5. Configurar Variables de Entorno

```bash
# Crear archivo .env
nano /var/www/andes/.env
```

Contenido del `.env`:

```env
# Google Drive API
GOOGLE_CLIENT_EMAIL=tu-email@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
DRIVE_FOLDER_ID=1bbkECY_axw5IttYjgVpRLmi6-EF80fZz

# Servidor
PORT=3000
NODE_ENV=production

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 6. Configurar Nginx

```bash
# Crear archivo de configuración
sudo nano /etc/nginx/sites-available/andes
```

**Configuración básica (sin SSL):**

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # O tu IP

    # Logs
    access_log /var/log/nginx/andes_access.log;
    error_log /var/log/nginx/andes_error.log;

    # Proxy a Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para operaciones largas (screenshots)
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Servir archivos estáticos directamente
    location /images/ {
        alias /var/www/andes/public/images/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /css/ {
        alias /var/www/andes/public/css/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location /js/ {
        alias /var/www/andes/public/js/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Límites de tamaño de archivo
    client_max_body_size 50M;
}
```

**Configuración con SSL (recomendado):**

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    # Certificados SSL (usar Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logs
    access_log /var/log/nginx/andes_access.log;
    error_log /var/log/nginx/andes_error.log;

    # Proxy a Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para operaciones largas
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Servir archivos estáticos
    location /images/ {
        alias /var/www/andes/public/images/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /css/ {
        alias /var/www/andes/public/css/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location /js/ {
        alias /var/www/andes/public/js/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Límites
    client_max_body_size 50M;
}
```

**Activar configuración:**

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/andes /etc/nginx/sites-enabled/

# Eliminar configuración por defecto (opcional)
sudo rm /etc/nginx/sites-enabled/default

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 7. Configurar SSL con Let's Encrypt (Recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Renovación automática (ya configurada por defecto)
sudo certbot renew --dry-run
```

### 8. Configurar PM2 para Gestión de Procesos y Cronjobs

El archivo `ecosystem.config.js` ya está incluido en el proyecto y configura:
- **Servidor web** (siempre activo)
- **Cronjob 6:00 AM** (genera screenshots diarios)
- **Cronjob 2:00 PM** (genera screenshots diarios)

**Iniciar aplicación con PM2:**

```bash
# Cambiar a usuario andes
sudo su - andes
cd /var/www/andes

# Crear directorio de logs
mkdir -p /var/www/andes/logs

# Iniciar todas las aplicaciones (servidor + cronjobs)
pm2 start ecosystem.config.js

# Ver logs
pm2 logs

# Ver estado de todos los procesos
pm2 status

# Guardar configuración para reinicio automático
pm2 save

# Configurar inicio automático al arrancar el servidor
pm2 startup
# Ejecutar el comando que PM2 te muestre (algo como):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u andes --hp /var/www/andes
```

**Verificar cronjobs:**

```bash
# Ver próxima ejecución de los cronjobs
pm2 list

# Ver logs específicos de cada proceso
pm2 logs andes-server        # Servidor web
pm2 logs screenshots-6am      # Cronjob 6 AM
pm2 logs screenshots-2pm      # Cronjob 2 PM

# Ejecutar manualmente el script de screenshots (para probar)
node generate-screenshots-today.js
```

**Configuración de cronjobs en `ecosystem.config.js`:**

Los cronjobs están configurados con sintaxis cron:
- `0 6 * * *` = Todos los días a las 6:00 AM
- `0 14 * * *` = Todos los días a las 2:00 PM (14:00)

**Nota importante:** Los cronjobs de PM2 usan la zona horaria del servidor. Asegúrate de que el servidor esté configurado en la zona horaria de Argentina:

```bash
# Verificar zona horaria actual
timedatectl

# Cambiar a zona horaria de Argentina (si es necesario)
sudo timedatectl set-timezone America/Argentina/Buenos_Aires

# Verificar cambio
date
```

### 9. Configurar Firewall

```bash
# Permitir tráfico HTTP y HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## 🔧 Comandos Útiles de PM2

```bash
# Ver logs en tiempo real
pm2 logs andes

# Reiniciar aplicación
pm2 restart andes

# Detener aplicación
pm2 stop andes

# Eliminar aplicación
pm2 delete andes

# Ver uso de recursos
pm2 monit

# Ver información detallada
pm2 show andes
```

## 📊 Monitoreo y Logs

### Ver logs de Nginx

```bash
# Logs de acceso
sudo tail -f /var/log/nginx/andes_access.log

# Logs de error
sudo tail -f /var/log/nginx/andes_error.log
```

### Ver logs de la aplicación

```bash
# Con PM2
pm2 logs andes

# Logs personalizados
tail -f /var/www/andes/logs/pm2-out.log
tail -f /var/www/andes/logs/pm2-error.log
```

## 🔄 Actualizar la Aplicación

```bash
# 1. Desde tu máquina local, crear nuevo paquete
cd /Users/yevelez/fury_4/andes
tar -czf andes-update.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    .

# 2. Subir al servidor
scp andes-update.tar.gz root@IP_SERVIDOR:/tmp/

# 3. En el servidor
sudo su - andes
cd /var/www/andes

# Hacer backup
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz .

# Extraer nueva versión
tar -xzf /tmp/andes-update.tar.gz

# Instalar nuevas dependencias (si las hay)
npm install --production

# Reiniciar aplicación
pm2 restart andes
```

## 🔒 Seguridad Adicional

### 1. Configurar límites de rate limiting en Nginx

```nginx
# En /etc/nginx/nginx.conf (dentro del bloque http)
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# En tu configuración de servidor
location /upload {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
    # ... resto de configuración
}
```

### 2. Proteger archivos sensibles

```bash
# Asegurar permisos del .env
chmod 600 /var/www/andes/.env
chown andes:andes /var/www/andes/.env
```

### 3. Configurar fail2ban (opcional)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 🐳 Alternativa: Despliegue con Docker

Si prefieres usar Docker, puedes crear un `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Instalar dependencias de Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos
COPY package*.json ./
RUN npm install --production

COPY . .

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "server.js"]
```

Y `docker-compose.yml`:

```yaml
version: '3.8'

services:
  andes:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## 📝 Checklist de Despliegue

- [ ] Servidor Linux configurado
- [ ] Node.js instalado (v18+)
- [ ] Nginx instalado y configurado
- [ ] PM2 instalado
- [ ] Dependencias de Puppeteer instaladas
- [ ] Archivos subidos a `/var/www/andes`
- [ ] Archivo `.env` configurado
- [ ] `npm install` ejecutado
- [ ] Configuración de Nginx creada y activada
- [ ] SSL configurado (Let's Encrypt)
- [ ] Aplicación iniciada con PM2
- [ ] PM2 configurado para inicio automático
- [ ] Firewall configurado
- [ ] Logs funcionando correctamente
- [ ] Pruebas de funcionalidad realizadas

## 🆘 Troubleshooting

### Puppeteer no encuentra Chromium

```bash
# Verificar ruta de Chromium
which chromium-browser

# Actualizar .env con la ruta correcta
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Error de permisos

```bash
# Asegurar permisos correctos
sudo chown -R andes:andes /var/www/andes
sudo chmod -R 755 /var/www/andes
```

### Nginx no puede conectar con Node.js

```bash
# Verificar que la aplicación esté corriendo
pm2 status

# Verificar puerto
netstat -tulpn | grep 3000

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/andes_error.log
```

### Aplicación se cae constantemente

```bash
# Ver logs de PM2
pm2 logs andes --lines 100

# Aumentar memoria si es necesario
pm2 restart andes --max-memory-restart 2G
```

## 📞 Soporte

Para más información sobre configuración específica, consulta:
- [Documentación de Nginx](https://nginx.org/en/docs/)
- [Documentación de PM2](https://pm2.keymetrics.io/docs/)
- [Documentación de Puppeteer](https://pptr.dev/)
