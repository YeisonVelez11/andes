# Guía de Deployment con Docker

## ⚠️ Problema Común: "Target closed" Error

Si ves este error:
```
❌ Error al lanzar Puppeteer: Protocol error (Target.setAutoAttach): Target closed
```

**Causa:** Chrome necesita más memoria compartida (shm) en Docker.

## ✅ Solución 1: Usar docker-compose (Recomendado)

```bash
docker-compose up -d
```

El `docker-compose.yml` ya incluye `shm_size: '2gb'`.

## ✅ Solución 2: Docker run con --shm-size

```bash
docker run -d \
  --name andes-image-uploader \
  --shm-size=2gb \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
  -e GOOGLE_CLIENT_EMAIL="tu-email" \
  -e GOOGLE_PRIVATE_KEY="tu-clave" \
  andes-image-uploader
```

## 🔧 Variables de Entorno Requeridas

```bash
# Puppeteer (OBLIGATORIO)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Node
NODE_ENV=production
PORT=3000

# Google Drive API
GOOGLE_CLIENT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE\n-----END PRIVATE KEY-----\n"
```

## 🚀 Deployment en Plataformas

### **Render.com**

En el Dashboard de Render:

1. **Docker Command:**
   ```
   docker run --shm-size=2gb -p 3000:3000 andes-image-uploader
   ```

2. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` = `true`
   - `PUPPETEER_EXECUTABLE_PATH` = `/usr/bin/google-chrome-stable`
   - `GOOGLE_CLIENT_EMAIL` = `[tu-email]`
   - `GOOGLE_PRIVATE_KEY` = `[tu-clave-con-\n]`

### **Railway.app**

Railway detecta el Dockerfile automáticamente.

**Variables de entorno:**
```
NODE_ENV=production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
GOOGLE_CLIENT_EMAIL=[tu-email]
GOOGLE_PRIVATE_KEY=[tu-clave]
```

**IMPORTANTE:** Railway ya asigna suficiente shm por defecto.

### **Fly.io**

Crear `fly.toml`:

```toml
app = "andes-image-uploader"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
  PUPPETEER_EXECUTABLE_PATH = "/usr/bin/google-chrome-stable"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[mounts]
  source = "andes_data"
  destination = "/data"
  
# IMPORTANTE: Aumentar memoria compartida
[experimental]
  shm_size = "2gb"
```

Configurar secrets:
```bash
fly secrets set GOOGLE_CLIENT_EMAIL="tu-email"
fly secrets set GOOGLE_PRIVATE_KEY="tu-clave-con-\n"
```

Deploy:
```bash
fly deploy
```

## 📊 Recursos Recomendados

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 1GB | 2GB |
| CPU | 1 core | 2 cores |
| SHM | 512MB | 2GB |
| Disco | 512MB | 1GB |

## 🧪 Verificar Deployment

### 1. Health Check
```bash
curl https://tu-app.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T16:00:00.000Z",
  "uptime": 123.456,
  "drive": "connected"
}
```

### 2. Ver logs
```bash
# Docker Compose
docker-compose logs -f

# Docker
docker logs -f andes-image-uploader
```

### 3. Test de screenshot
```bash
curl -X POST https://tu-app.com/generate-screenshot \
  -H "Content-Type: application/json" \
  -d '{"targetDates": ["2025-10-24"]}'
```

## ❌ Troubleshooting

### Error: "Target closed"
**Solución:** Aumentar shm_size a 2GB

### Error: "Failed to launch browser"
**Solución:** Verificar que las variables de Puppeteer estén configuradas

### Error: "Out of memory"
**Solución:** Aumentar RAM del contenedor a 2GB

### Error: "ETIMEDOUT" durante build
**Solución:** Crear archivo `.npmrc`:
```
registry=https://registry.npmjs.org/
```

## 🔒 Seguridad

- ✅ El contenedor corre como usuario no-root (`pptruser`)
- ✅ Solo se instalan dependencias de producción
- ✅ Las credenciales se pasan como variables de entorno
- ✅ Nunca commitear `.env` al repositorio

## 📞 Comandos Útiles

```bash
# Build
docker build -t andes-image-uploader .

# Run con shm aumentado
docker run --shm-size=2gb -p 3000:3000 andes-image-uploader

# Ver logs
docker logs -f andes-image-uploader

# Entrar al contenedor
docker exec -it andes-image-uploader /bin/bash

# Verificar Chrome
docker exec andes-image-uploader /usr/bin/google-chrome-stable --version

# Limpiar
docker-compose down
docker system prune -a
```
