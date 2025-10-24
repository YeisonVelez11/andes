# Deployment en Instancia Gratuita (Render/Railway/Fly.io)

## 🆓 Configuración para Tier Gratuito

Las instancias gratuitas típicamente tienen:
- **RAM:** 512MB
- **CPU:** 0.5 vCPU compartido
- **Disco:** 512MB-1GB
- **Tiempo de inactividad:** Se apagan después de 15-30 min sin uso

## ✅ Optimizaciones Implementadas

### **1. Puppeteer optimizado para bajo consumo:**
```javascript
args: [
  '--disable-dev-shm-usage',        // No usar /dev/shm (crítico)
  '--renderer-process-limit=1',     // Solo 1 proceso renderer
  '--max-old-space-size=512',       // Limitar heap a 512MB
  '--disable-gpu',                  // Sin GPU
  '--no-sandbox',                   // Necesario en Docker
]
```

### **2. Docker optimizado:**
```dockerfile
# Solo dependencias de producción
RUN npm ci --only=production

# Usuario no-root (más seguro y eficiente)
USER pptruser
```

### **3. Recursos limitados:**
```yaml
shm_size: '512mb'      # Memoria compartida mínima
memory: 512M           # RAM máxima
cpus: '0.5'           # CPU compartido
```

## 🚀 Deployment por Plataforma

### **Render.com (Recomendado para Free Tier)**

#### **Configuración:**

1. **Tipo:** Docker
2. **Branch:** main
3. **Docker Command:**
   ```bash
   docker run --shm-size=512mb -p 3000:3000 andes-image-uploader
   ```

#### **Variables de entorno:**
```bash
NODE_ENV=production
PORT=3000
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
GOOGLE_CLIENT_EMAIL=[tu-email]
GOOGLE_PRIVATE_KEY=[tu-clave-con-\n]
```

#### **Plan:** Free (512MB RAM)

#### **⚠️ Limitaciones:**
- Se apaga después de 15 min de inactividad
- Tarda ~30 segundos en arrancar (cold start)
- 1 screenshot a la vez (no paralelo)

---

### **Railway.app**

#### **Configuración:**
Railway detecta el Dockerfile automáticamente.

#### **Variables de entorno:**
```bash
NODE_ENV=production
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
GOOGLE_CLIENT_EMAIL=[tu-email]
GOOGLE_PRIVATE_KEY=[tu-clave]
```

#### **Plan:** Free ($5 crédito/mes)

#### **⚠️ Limitaciones:**
- $5 de crédito mensual
- Se apaga cuando se acaba el crédito
- ~512MB RAM en free tier

---

### **Fly.io**

#### **1. Instalar CLI:**
```bash
curl -L https://fly.io/install.sh | sh
```

#### **2. Login:**
```bash
fly auth login
```

#### **3. Crear app:**
```bash
fly launch --no-deploy
```

#### **4. Editar `fly.toml`:**
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

# Configuración para free tier
[experimental]
  shm_size = "512mb"

# Recursos mínimos
[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

#### **5. Configurar secrets:**
```bash
fly secrets set GOOGLE_CLIENT_EMAIL="tu-email"
fly secrets set GOOGLE_PRIVATE_KEY="tu-clave-con-\n"
```

#### **6. Deploy:**
```bash
fly deploy
```

#### **Plan:** Free (3 apps, 512MB RAM cada una)

---

## ⚠️ Consideraciones Importantes

### **1. Cold Starts**
Las instancias gratuitas se apagan después de inactividad:
- **Render:** 15 minutos
- **Railway:** Cuando se acaba el crédito
- **Fly.io:** Escala a 0 después de inactividad

**Solución:** Usar un servicio de ping (UptimeRobot) para mantener activo.

### **2. Timeouts**
Los screenshots pueden tardar 30-60 segundos:
```javascript
protocolTimeout: 180000 // 3 minutos
```

### **3. Memoria limitada**
Solo procesar 1 screenshot a la vez:
```javascript
// No hacer múltiples screenshots en paralelo
for (const date of dates) {
  await generateScreenshot(date); // Secuencial, no paralelo
}
```

### **4. Límite de requests**
Free tier tiene límites:
- **Render:** Sin límite explícito pero puede throttle
- **Railway:** Según crédito ($5/mes)
- **Fly.io:** 160GB bandwidth/mes

## 🧪 Testing

### **1. Verificar que funciona:**
```bash
curl https://tu-app.com/health
```

### **2. Test de screenshot (puede tardar):**
```bash
curl -X POST https://tu-app.com/generate-screenshot \
  -H "Content-Type: application/json" \
  -d '{"targetDates": ["2025-10-24"]}'
```

**Espera:** 30-90 segundos en free tier (es normal).

### **3. Ver logs:**
```bash
# Render
Ver en Dashboard > Logs

# Railway
railway logs

# Fly.io
fly logs
```

## 💡 Tips para Free Tier

### **1. Reducir uso de memoria:**
- ✅ Procesar 1 screenshot a la vez
- ✅ Cerrar browser después de cada screenshot
- ✅ No mantener conexiones abiertas innecesarias

### **2. Optimizar tiempo de respuesta:**
- ✅ Usar `headless: 'new'` (más rápido)
- ✅ Cachear páginas HTML cuando sea posible
- ✅ Reducir timeouts si es posible

### **3. Evitar que se apague:**
- ✅ Usar UptimeRobot para ping cada 5 minutos
- ✅ Configurar webhook en Render para mantener activo

### **4. Monitorear recursos:**
```bash
# Ver uso de memoria en logs
console.log('Memory:', process.memoryUsage());
```

## 📊 Comparación de Plataformas Free Tier

| Plataforma | RAM | CPU | Disco | Bandwidth | Mejor para |
|------------|-----|-----|-------|-----------|------------|
| **Render** | 512MB | Shared | 512MB | Ilimitado | Pruebas/Demo |
| **Railway** | 512MB | Shared | 1GB | Según crédito | Desarrollo |
| **Fly.io** | 512MB | 1 vCPU | 3GB | 160GB/mes | Producción ligera |

## ✅ Recomendación

Para **instancia gratuita**, usa **Render.com**:
- ✅ Más fácil de configurar
- ✅ Bandwidth ilimitado
- ✅ Buen soporte para Docker
- ✅ No requiere tarjeta de crédito

**Comando de deploy:**
```bash
docker run --shm-size=512mb -p 3000:3000 andes-image-uploader
```

Con las optimizaciones implementadas, debería funcionar sin problemas en 512MB RAM. 🚀
