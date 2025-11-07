# 🚀 Guía Rápida de Deployment

## 📦 Archivos de Configuración Incluidos

- **`ecosystem.config.js`** - Configuración de PM2 (servidor + cronjobs)
- **`start.sh`** - Script para iniciar la aplicación
- **`stop.sh`** - Script para detener la aplicación
- **`DEPLOYMENT.md`** - Guía completa de deployment en servidor Linux

## ⚙️ Configuración Previa

Asegúrate de tener un archivo `.env` con las variables necesarias:

```bash
# Copiar el ejemplo (si no tienes .env)
cp .env.example .env

# Editar con tus credenciales
nano .env
```

**Variables importantes:**
- `PORT` - Puerto del servidor (default: 3000)
- `GOOGLE_CLIENT_EMAIL` - Email de la cuenta de servicio de Google
- `GOOGLE_PRIVATE_KEY` - Clave privada de Google Drive API

## ⚡ Inicio Rápido (Desarrollo Local)

### Opción 1: Con PM2 (Recomendado para producción)

```bash
# Instalar PM2 globalmente (solo una vez)
npm install -g pm2

# Iniciar aplicación y cronjobs
./start.sh

# O usando npm
npm run pm2:start

# Ver logs
pm2 logs

# Ver estado
pm2 status

# Detener
./stop.sh
```

### Opción 2: Sin PM2 (Desarrollo simple)

```bash
# Iniciar servidor solamente
npm start

# O en modo desarrollo con auto-reload
npm run dev

# Ejecutar screenshots manualmente
npm run screenshots
```

## 🔧 Configuración de Cronjobs

Los cronjobs se configuran usando el **crontab del sistema** (no PM2):

```bash
# Configurar cronjobs automáticamente
./setup-cron.sh
```

**El script detecta automáticamente:**
- ✅ **Con NVM**: Carga NVM y usa Node 20
- ✅ **Sin NVM** (servidor): Busca Node en ubicaciones comunes:
  - `/usr/bin/node`
  - `/usr/local/bin/node`
  - `/opt/homebrew/bin/node`
  - O usa `command -v node`

Esto configurará:
- **6:00 AM** - Genera screenshots automáticamente
- **3:20 PM** - Genera screenshots automáticamente

Los logs se guardan en:
- `logs/cron-6am.log`
- `logs/cron-3pm.log`

### 🧪 Probar en modo servidor (sin NVM)

```bash
# Simula cómo funcionará en el servidor
./test-cron-server.sh
```

## 📊 Monitoreo

```bash
# Ver logs en tiempo real
pm2 logs

# Ver logs del servidor
pm2 logs andes-server

# Ver logs de cronjobs
tail -f logs/cron-6am.log
tail -f logs/cron-3pm.log

# Monitor de recursos del servidor
pm2 monit

# Ver estado del servidor
pm2 status
```

## 🔄 Actualizar Aplicación

```bash
# Detener procesos
pm2 stop all

# Actualizar código (git pull, etc.)
git pull

# Instalar nuevas dependencias (si las hay)
npm install

# Reiniciar
pm2 restart all
```

## 🌐 Deployment en Servidor

Para deployment completo en servidor Linux con Nginx, SSL, etc., consulta **`DEPLOYMENT.md`**.

### Resumen de pasos:

1. **Instalar dependencias del sistema** (Node.js, PM2, Nginx, Puppeteer deps)
2. **Subir archivos** al servidor
3. **Configurar `.env`** con credenciales
4. **Iniciar con PM2**: `pm2 start ecosystem.config.js`
5. **Configurar PM2 startup**: `pm2 startup` y `pm2 save`
6. **Configurar Nginx** como reverse proxy
7. **Configurar SSL** con Let's Encrypt

## 🔒 Seguridad

- ✅ Nunca subir `.env` al repositorio
- ✅ Usar HTTPS en producción (Let's Encrypt)
- ✅ Configurar firewall (ufw)
- ✅ Mantener Node.js y dependencias actualizadas
- ✅ Usar usuario sin privilegios para correr la app

## 📝 Scripts NPM Disponibles

```bash
npm start              # Iniciar servidor (modo normal)
npm run dev            # Iniciar servidor (modo desarrollo con auto-reload)
npm run screenshots    # Ejecutar generación de screenshots manualmente
npm run pm2:start      # Iniciar con PM2
npm run pm2:stop       # Detener PM2
npm run pm2:restart    # Reiniciar PM2
npm run pm2:logs       # Ver logs de PM2
npm run pm2:status     # Ver estado de PM2
npm run pm2:delete     # Eliminar todos los procesos de PM2
```

## 🆘 Troubleshooting

### PM2 no encuentra el comando

```bash
# Instalar PM2 globalmente
npm install -g pm2

# O usar npx
npx pm2 start ecosystem.config.js
```

### Los cronjobs no se ejecutan

```bash
# Verificar que PM2 esté corriendo
pm2 status

# Verificar logs de los cronjobs
pm2 logs screenshots-6am
pm2 logs screenshots-2pm

# Ejecutar manualmente para probar
node generate-screenshots-today.js
```

### Error de zona horaria

```bash
# Verificar zona horaria del sistema
date

# En Linux, cambiar a Argentina
sudo timedatectl set-timezone America/Argentina/Buenos_Aires
```

### Aplicación no inicia

```bash
# Ver logs detallados
pm2 logs andes-server --lines 100

# Verificar que el puerto 3000 esté libre
lsof -i :3000

# Verificar variables de entorno
cat .env
```

## 📞 Soporte

- **Documentación completa**: Ver `DEPLOYMENT.md`
- **Logs**: `pm2 logs` o `./logs/`
- **Estado**: `pm2 status`

## ✨ Características

- ✅ **Servidor siempre activo** (PM2 auto-restart)
- ✅ **Cronjobs automáticos** (6 AM y 2 PM)
- ✅ **Logs organizados** por proceso
- ✅ **Fácil monitoreo** con PM2
- ✅ **Reinicio automático** al arrancar el servidor
- ✅ **Gestión de memoria** (reinicia si usa >1GB)
