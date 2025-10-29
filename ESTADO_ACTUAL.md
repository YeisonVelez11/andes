# Estado y Contexto Actual de la Aplicación - Andes Screenshot System

**Fecha de actualización:** 2025-10-27  
**Versión:** 2.0  
**Estado:** Producción estable con sistema de reintentos robusto ✅

---

## 📋 Resumen Ejecutivo

Sistema automatizado de captura de screenshots del sitio web Los Andes (www.losandes.com.ar) con inserción de imágenes publicitarias, procesamiento con Sharp, y almacenamiento en Google Drive. Incluye sistema robusto de reintentos con múltiples estrategias de navegación y user agents alternativos.

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico
- **Runtime:** Node.js
- **Framework Web:** Express.js
- **Web Scraping:** Puppeteer 19.7.2
- **Procesamiento de Imágenes:** Sharp 0.31.3
- **Almacenamiento:** Google Drive API v3
- **Frontend:** Materialize CSS + Vanilla JavaScript
- **Zona Horaria:** America/Argentina/Buenos_Aires (UTC-3)

### Estructura de Archivos

```
andes/
├── server.js                      # Servidor Express principal (1388 líneas)
├── scraper-losandes.js            # Motor de scraping (1586 líneas)
├── puppeteer-config.js            # Configuración centralizada de Puppeteer
├── navigation-strategies.js       # Sistema de reintentos y estrategias
├── date-utils.js                  # Utilidades de fecha (hora Argentina)
├── generate-screenshots-today.js  # Script para generar screenshots del día
├── Dockerfile                     # Configuración Docker
├── package.json                   # Dependencias del proyecto
├── .env                          # Variables de entorno (NO en Git)
├── public/
│   ├── index.html                # Interfaz web principal
│   ├── js/
│   │   └── app.js                # Lógica del frontend
│   ├── css/
│   │   └── styles.css            # Estilos personalizados
│   └── images/
│       ├── x_itt.png             # Icono de cierre para ITT overlay
│       ├── navegador_full.png    # Barra de navegador desktop
│       └── navegador_mobile.png  # Barra de navegador mobile
├── screenshots/                   # Carpeta temporal (vacía en producción)
├── uploads/                       # Carpeta temporal (vacía en producción)
└── docs/
    ├── PROJECT_CONTEXT.md         # Contexto histórico del proyecto
    ├── RETRY_SYSTEM.md            # Documentación del sistema de reintentos
    ├── API_DOCUMENTATION.md       # Documentación completa de la API
    ├── DEPLOYMENT.md              # Guía de despliegue
    └── ESTADO_ACTUAL.md           # Este archivo
```

---

## 🔧 Módulos Principales

### 1. server.js (Servidor Express)

**Responsabilidades:**
- Endpoints de API REST
- Gestión de uploads de imágenes
- Generación de screenshots con reintentos
- Captura de HTML histórico
- Integración con Google Drive API
- Gestión de archivos JSON de campañas

**Endpoints principales:**
- `GET /` - Interfaz web principal
- `GET /health` - Health check (incluye fecha Argentina)
- `POST /upload` - Subir imágenes de campaña
- `POST /generate-screenshots` - Generar screenshots
- `GET /uploads` - Listar imágenes en Google Drive
- `GET /folders` - Listar carpetas de Google Drive
- `GET /json-files` - Listar archivos JSON de campañas
- `GET /image/:fileId` - Proxy para servir imágenes desde Drive

**Funciones clave:**
- `authorize()` - Autenticación con Google Drive (JWT)
- `uploadFileToDrive()` - Subir archivos a Google Drive
- `scrapeLosAndesWithRetry()` - Wrapper con reintentos para screenshots
- `captureAndSaveHTML()` - Capturar HTML del sitio en vivo
- `generateDateArray()` - Generar array de fechas
- `isFutureDate()` - Validar si una fecha es futura (hora Argentina)

### 2. scraper-losandes.js (Motor de Scraping)

**Responsabilidades:**
- Captura de screenshots con Puppeteer
- Inserción dinámica de imágenes publicitarias en el DOM
- Procesamiento de imágenes con Sharp
- Carga de HTML histórico desde Google Drive
- Subida de screenshots a Google Drive

**Función principal:**
```javascript
async function scrapeLosAndes(
  deviceType = 'desktop',      // 'desktop' | 'mobile'
  capturasFolderId,             // ID carpeta Google Drive
  visualizationType = null,     // 'A' | 'B' | 'C' | 'D' (desktop) o 'A' | 'B' | 'C' (mobile)
  jsonData = null,              // URLs de imágenes a insertar
  targetDate = null,            // Fecha objetivo o null (para HTML histórico)
  attempt = 1,                  // Número de intento actual
  maxRetries = 5                // Máximo de reintentos
)
```

**Tipos de visualización:**

**Desktop:**
- **Tipo A:** Imagen lateral (300x600) + Imagen ancho (970x250)
- **Tipo B:** Imagen lateral (300x600) en posición alternativa
- **Tipo C:** Imagen top (728x90) centrada horizontalmente
- **Tipo D:** ITT overlay con fondo gris (800x600) + botón cerrar

**Mobile:**
- **Tipo A:** Imagen lateral adaptada + Imagen ancho adaptada
- **Tipo B:** Imagen lateral en posición alternativa
- **Tipo C:** ITT overlay (igual que Desktop D)

**Procesamiento de imágenes:**
1. Captura screenshot con Puppeteer
2. Carga imagen de barra de navegador (navegador_full.png o navegador_mobile.png)
3. Combina ambas imágenes con Sharp (barra arriba, screenshot abajo)
4. Sube imagen final a Google Drive

### 3. puppeteer-config.js (Configuración Centralizada)

**Configuraciones de viewport:**
```javascript
VIEWPORT_CONFIGS = {
  desktop: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false
  },
  mobile: {
    width: 400,
    height: 820,
    deviceScaleFactor: 2,
    isMobile: true
  }
}
```

**User agents:**
- Desktop: Chrome 120 macOS
- Mobile: Safari 16 iOS

**Funciones exportadas:**
- `launchBrowser(deviceType, options)` - Lanza navegador Puppeteer
- `configurePage(page, deviceType)` - Configura página con user agent

### 4. navigation-strategies.js (Sistema de Reintentos)

**5 Estrategias de navegación:**
1. `domcontentloaded` (90s) - Intento 1
2. `domcontentloaded` (120s) - Intento 2
3. `load` (120s) - Intento 3
4. `networkidle0` (120s) - Intento 4
5. `domcontentloaded` (150s) - Intento 5

**5 User agents alternativos:**
1. Default (configurado en puppeteer-config)
2. Chrome 120 Windows
3. Safari 17 macOS
4. Chrome 120 Linux
5. Firefox 121 Windows

**Función compartida:**
```javascript
async function navigateWithStrategies(page, url, attempt, maxRetries)
```

**Flujo de reintentos:**
```
Intento 1 → Falla → Espera 15s
Intento 2 → Falla → Espera 30s (cambia user agent)
Intento 3 → Falla → Espera 45s (cambia user agent)
Intento 4 → Falla → Espera 60s (cambia user agent)
Intento 5 → Falla → Error crítico
```

### 5. date-utils.js (Utilidades de Fecha)

**Funciones:**
- `getArgentinaDateString(date)` - Retorna fecha en formato YYYY-MM-DD
- `getArgentinaDateTime(date)` - Retorna objeto con componentes de fecha/hora
- `getArgentinaTimestamp(date)` - Retorna timestamp YYYY-MM-DD-HH-MM-SS

**Zona horaria:** America/Argentina/Buenos_Aires (UTC-3)

---

## 🔄 Flujos de Trabajo

### Flujo 1: Subida de Campaña

```
1. Usuario selecciona imágenes en el formulario web
   ├─ imagenLateral (300x600, 300x250, 160x600)
   ├─ imagenAncho (Desktop: 728x90, 990x90, 970x250 | Mobile: 320x50, 320x100, 300x100)
   ├─ imagenTop (728x90, 990x90)
   ├─ itt (Desktop: 800x600 | Mobile: 320x480)
   └─ zocalo (Mobile only: 320x100, 320x50)

2. Selecciona tipo de dispositivo (desktop/mobile)

3. Selecciona tipo de visualización
   ├─ Desktop: A, B, C, D
   └─ Mobile: A, B, C

4. Selecciona carpeta de destino en Google Drive

5. Define rangos de fechas
   ├─ Rango 1: fecha inicio - fecha fin
   ├─ Rango 2: fecha inicio - fecha fin (opcional)
   └─ Opción: Solo primer y último día

6. Click en "Subir Campaña"
   ↓
7. POST /upload
   ├─ Validación de archivos (multer)
   ├─ Subida a Google Drive (carpeta: imagenes/)
   └─ Generación de URLs: /image/{driveId}

8. Creación/actualización de archivos JSON
   ├─ Para cada fecha en los rangos
   ├─ Archivo: YYYY-MM-DD.json
   ├─ Ubicación: Google Drive (carpeta: jsones/)
   └─ Contenido: Array de objetos con metadata de campaña

9. Respuesta exitosa
   └─ Formulario se limpia automáticamente
```

### Flujo 2: Generación de Screenshots

```
1. POST /generate-screenshots
   ↓
2. Obtener fecha actual de Argentina
   ↓
3. Validar fechas (saltar futuras)
   ↓
4. Para cada fecha válida:
   ├─ Buscar archivo JSON en Google Drive (jsones/YYYY-MM-DD.json)
   ├─ Parsear contenido JSON
   └─ Para cada registro en el JSON:
       ├─ Determinar targetDate
       │  ├─ Si fecha < hoy → targetDate = fecha (usar HTML histórico)
       │  └─ Si fecha = hoy → targetDate = null (usar página en vivo)
       ├─ Llamar scrapeLosAndesWithRetry()
       │  ├─ Loop de reintentos (1-5)
       │  ├─ Lanzar Puppeteer
       │  ├─ Navegar con navigateWithStrategies()
       │  ├─ Cargar HTML histórico o página en vivo
       │  ├─ Remover publicidad del DOM
       │  ├─ Insertar imágenes según tipo de visualización
       │  ├─ Tomar screenshot
       │  ├─ Procesar con Sharp (agregar barra navegador)
       │  └─ Subir a Google Drive
       └─ Registrar resultado (éxito/fallo)
   ↓
5. Generar resumen de screenshots
   ├─ Desktop: X exitosos, Y fallidos
   ├─ Mobile: X exitosos, Y fallidos
   └─ Total: X exitosos de Y intentos
   ↓
6. Verificar si hay screenshots de fecha actual
   ↓
7. Si hay screenshots de hoy → captureAndSaveHTML()
   ├─ Desktop HTML
   │  ├─ Lanzar Puppeteer
   │  ├─ Navegar con reintentos
   │  ├─ Obtener HTML completo
   │  └─ Guardar/actualizar en Google Drive
   └─ Mobile HTML
      ├─ Lanzar Puppeteer
      ├─ Navegar con reintentos
      ├─ Obtener HTML completo
      └─ Guardar/actualizar en Google Drive
   ↓
8. Generar resumen de HTML
   ↓
9. Respuesta JSON con resultados completos
```

### Flujo 3: Captura de HTML Histórico

```
1. Verificar screenshots generados
   ↓
2. ¿Hay screenshots de fecha actual?
   ├─ NO → Saltar captura de HTML
   └─ SÍ → Continuar
       ↓
3. Para cada dispositivo (desktop, mobile):
   ├─ Lanzar navegador Puppeteer
   ├─ Configurar página
   ├─ Loop de reintentos (1-5)
   │  ├─ navigateWithStrategies()
   │  └─ Si falla → espera incremental
   ├─ Obtener HTML completo (page.content())
   ├─ Convertir a buffer
   ├─ Buscar archivo existente en Google Drive
   │  ├─ Existe → Actualizar
   │  └─ No existe → Crear nuevo
   └─ Guardar en carpeta: webs_pasado/
       ├─ Nombre: YYYY-MM-DD_desktop.html
       └─ Nombre: YYYY-MM-DD_mobile.html
```

---

## 🗄️ Estructura de Google Drive

### IDs de Carpetas

```javascript
const imagenes = "1bbkECY_axw5IttYjgVpRLmi6-EF80fZz";      // Imágenes de campañas
const jsones = "1d40AKgKucYUY-CnSqcLd1v8uyXhElk33";         // Archivos JSON
const capturas = "1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR";       // Screenshots (carpeta raíz)
const htmlFolderId = "1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49";   // HTMLs históricos
const parentId = "1norxhMEG62maIArwy-zjolxzPGsQoBzq";       // Carpeta raíz navegación
```

### Jerarquía

```
Google Drive Root
├── imagenes/ (1bbkECY_axw5IttYjgVpRLmi6-EF80fZz)
│   ├── imagen1.jpg
│   ├── imagen2.png
│   └── ...
│
├── jsones/ (1d40AKgKucYUY-CnSqcLd1v8uyXhElk33)
│   ├── 2025-10-20.json
│   ├── 2025-10-21.json
│   └── ...
│
├── webs_pasado/ (1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49)
│   ├── 2025-10-20_desktop.html
│   ├── 2025-10-20_mobile.html
│   └── ...
│
└── capturas/ (1norxhMEG62maIArwy-zjolxzPGsQoBzq)
    ├── Cliente1/
    │   ├── screenshot_desktop_2025-10-20.png
    │   └── screenshot_mobile_2025-10-20.png
    ├── Cliente2/
    └── ...
```

### Formato de Archivos JSON

```json
[
  {
    "imagenLateral": "/image/1abc123def456",
    "imagenAncho": "/image/2xyz789ghi012",
    "imagenTop": null,
    "itt": null,
    "zocalo": null,
    "deviceType": "desktop",
    "tipo_visualizacion": "A",
    "carpeta_id": "1XYZ...",
    "carpeta_nombre": "Cliente1",
    "campana": "Cliente1-desktop-A",
    "uploadedAt": "2025-10-20T00:00:00.000Z"
  },
  {
    "imagenLateral": "/image/3def456ghi789",
    "imagenAncho": null,
    "imagenTop": null,
    "itt": "/image/4jkl012mno345",
    "zocalo": null,
    "deviceType": "mobile",
    "tipo_visualizacion": "C",
    "carpeta_id": "1XYZ...",
    "carpeta_nombre": "Cliente1",
    "campana": "Cliente1-mobile-C",
    "uploadedAt": "2025-10-20T00:00:00.000Z"
  }
]
```

---

## 🔑 Variables de Entorno

### Archivo .env

```bash
# Google Drive API
GOOGLE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Servidor
PORT=3000
NODE_ENV=production

# Puppeteer (Producción)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### Configuración en Render.com / Docker

```bash
# Mismo .env pero con:
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

---

## 🐛 Sistema de Reintentos y Manejo de Errores

### Parámetros Globales

- **Máximo de reintentos:** 5 intentos
- **Esperas incrementales:** 15s, 30s, 45s, 60s
- **Timeout total por captura:** ~12 minutos máximo

### Estrategias por Intento

| Intento | Estrategia | Timeout | User Agent | Espera después |
|---------|------------|---------|------------|----------------|
| 1 | domcontentloaded | 90s | Default | 15s |
| 2 | domcontentloaded | 120s | Chrome Windows | 30s |
| 3 | load | 120s | Safari macOS | 45s |
| 4 | networkidle0 | 120s | Chrome Linux | 60s |
| 5 | domcontentloaded | 150s | Firefox Windows | - |

### Manejo de Errores Críticos

**Si todos los screenshots fallan:**
```
❌ CRÍTICO: Todos los screenshots fallaron
Posibles causas:
- Los Andes está bloqueando la IP del servidor
- Problemas de conectividad del servidor
- Error en la configuración de Puppeteer
→ Lanza Error y detiene el proceso
```

**Si ambos HTMLs fallan:**
```
❌ CRÍTICO: No se pudo capturar ningún HTML
Posibles causas:
- Los Andes está bloqueando la IP del servidor
- Problemas de conectividad del servidor
- Firewall bloqueando conexiones salientes
→ Lanza Error y detiene el proceso
```

---

## 📊 Métricas y Performance

### Tiempos Estimados

| Operación | Tiempo (1er intento) | Tiempo (con reintentos) |
|-----------|---------------------|------------------------|
| Screenshot exitoso | ~30 segundos | ~3-12 minutos |
| HTML exitoso | ~15 segundos | ~2-10 minutos |
| Upload de imagen | ~2-5 segundos | - |
| Procesamiento Sharp | ~1-2 segundos | - |

### Tasa de Éxito Esperada

- **Desarrollo local:** 95-100% en primer intento
- **Producción (Render.com):** 70-80% en primer intento, 95%+ con reintentos

---

## 🚀 Comandos y Scripts

### Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor en desarrollo
node server.js
# o
npm start

# Generar screenshots del día actual
node generate-screenshots-today.js
# o
npm run screenshots
```

### Producción con PM2

```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Ver logs
pm2 logs andes

# Reiniciar
pm2 restart andes

# Detener
pm2 stop andes

# Ver estado
pm2 status
```

### Docker

```bash
# Construir imagen
docker build -t andes-screenshots .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env andes-screenshots

# Ver logs
docker logs -f <container_id>
```

### Despliegue Manual

```bash
# Comprimir proyecto
tar -czf andes.tar.gz --exclude='node_modules' --exclude='.git' --exclude='screenshots' --exclude='uploads' .

# Subir al servidor
scp andes.tar.gz root@IP_SERVIDOR:/tmp/

# En servidor
cd /var/www/andes
tar -xzf /tmp/andes.tar.gz
npm install --production
pm2 restart andes
```

---

## 🔍 Debugging y Troubleshooting

### Ver Fecha Argentina Actual

```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T16:18:03.000Z",
  "argentinaDate": "2025-10-27",
  "uptime": 12345.67,
  "drive": "connected"
}
```

### Logs de Screenshots

Los logs muestran información detallada:

```
🔍 DESKTOP - dateToProcess: 2025-10-24, currentDate: 2025-10-27, targetDate: 2025-10-24
📂 Cargando HTML guardado para la fecha: 2025-10-24
✅ HTML histórico cargado exitosamente

🔍 MOBILE - dateToProcess: 2025-10-27, currentDate: 2025-10-27, targetDate: null
🌐 Navegando a Los Andes (página en vivo)...
📡 Intento 1/5 - Estrategia: domcontentloaded (90s)
✅ Página cargada exitosamente
```

### Verificar Captura de HTML

```
🔍 Verificando captura de HTML...
📅 Fecha actual (Argentina): 2025-10-27
📊 Total screenshots desktop: 2
📊 Total screenshots mobile: 2
✅ ¿Hay screenshots de fecha actual?: true
📱 ===== Capturando HTML DESKTOP =====
```

### Problemas Comunes

**1. Timeout de navegación**
- Solución: Sistema de reintentos automático con 5 intentos
- Verificar: Conectividad del servidor

**2. Google Drive no conectado**
- Verificar: Variables de entorno GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY
- Verificar: Permisos de la service account

**3. Puppeteer no inicia**
- Verificar: PUPPETEER_EXECUTABLE_PATH apunta a Chrome/Chromium válido
- Verificar: Dependencias del sistema (libgbm, libasound2, etc.)

**4. Screenshots en blanco**
- Verificar: Timeout suficiente para carga de página
- Verificar: Selectores CSS válidos en scraper-losandes.js

---

## 📚 Documentación Adicional

### Archivos de Documentación

1. **ESTADO_ACTUAL.md** (este archivo)
   - Estado completo del sistema
   - Arquitectura y flujos
   - Configuración y deployment

2. **PROJECT_CONTEXT.md**
   - Contexto histórico del proyecto
   - Problemas resueltos en sesiones anteriores
   - Mejores prácticas implementadas

3. **RETRY_SYSTEM.md**
   - Documentación detallada del sistema de reintentos
   - Estrategias de navegación
   - User agents alternativos

4. **API_DOCUMENTATION.md**
   - Documentación completa de endpoints
   - Ejemplos de requests/responses
   - Códigos de error

5. **DEPLOYMENT.md**
   - Guía de despliegue en servidor Linux
   - Configuración de Nginx
   - PM2 y systemd

6. **README.md**
   - Información general del proyecto
   - Instalación rápida
   - IDs de carpetas de Google Drive

---

## 🔐 Seguridad

### Buenas Prácticas Implementadas

1. ✅ **Variables de entorno:** Credenciales en .env (no en Git)
2. ✅ **Service Account:** Autenticación JWT con Google Drive
3. ✅ **Validación de archivos:** Multer con filtros de tipo y tamaño
4. ✅ **CORS configurado:** Permite acceso desde dominios autorizados
5. ✅ **Almacenamiento en memoria:** Archivos no se guardan en disco local
6. ✅ **Sanitización de inputs:** Validación de fechas y parámetros

### Permisos de Google Drive

La service account necesita:
- Acceso de lectura/escritura a las carpetas configuradas
- Permisos compartidos por el propietario de las carpetas

---

## 🎯 Estado Actual del Código

### Archivo Activo: scraper-losandes.js

**Línea actual:** 121 (función `scrapeLosAndes`)

**Contexto del código:**
```javascript
// Línea 121: Ocultar webdriver
await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
    });
});
```

**Función activa:** `scrapeLosAndes()`
- Parámetros: deviceType, capturasFolderId, visualizationType, jsonData, targetDate, attempt, maxRetries
- Responsabilidad: Capturar screenshot con Puppeteer e insertar imágenes

### Archivos Abiertos

1. **scraper-losandes.js** (1586 líneas) - Activo
2. **server.js** (1388 líneas)
3. **Dockerfile** (31 líneas)
4. **package.json** (34 líneas)
5. **README.md** (122 líneas)
6. **RETRY_SYSTEM.md** (489 líneas)

---

## 📈 Próximos Pasos Sugeridos

### Mejoras Potenciales

1. **Monitoreo y Alertas**
   - Implementar logging estructurado (Winston)
   - Alertas por email/Slack en caso de fallos críticos
   - Dashboard de métricas (screenshots exitosos/fallidos)

2. **Optimización de Performance**
   - Cache de HTMLs históricos en memoria
   - Pool de navegadores Puppeteer
   - Procesamiento paralelo de screenshots

3. **Funcionalidades Adicionales**
   - Preview de screenshots antes de generar
   - Edición de campañas existentes
   - Historial de campañas por cliente
   - Exportación de reportes en PDF

4. **Testing**
   - Tests unitarios (Jest)
   - Tests de integración
   - Tests E2E con Playwright

5. **DevOps**
   - CI/CD con GitHub Actions
   - Despliegue automático a Render.com
   - Backups automáticos de Google Drive

---

## 🆘 Soporte y Contacto

### Para Recuperar Este Contexto

Simplemente menciona:
- "Proyecto Andes" o "Sistema de screenshots de Los Andes"
- "Lee ESTADO_ACTUAL.md" o "Revisa el estado actual"
- Cualquier problema específico mencionado aquí

### Archivos Clave para Revisar

1. `ESTADO_ACTUAL.md` (este archivo) - Estado completo
2. `PROJECT_CONTEXT.md` - Contexto histórico
3. `RETRY_SYSTEM.md` - Sistema de reintentos
4. `API_DOCUMENTATION.md` - Documentación de API
5. `server.js` - Servidor principal
6. `scraper-losandes.js` - Motor de scraping
7. `navigation-strategies.js` - Estrategias de navegación

---

**Última actualización:** 2025-10-27 11:18:03 (UTC-5)  
**Versión del sistema:** 2.0  
**Estado:** ✅ Producción estable con sistema de reintentos robusto
