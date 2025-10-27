# Sistema de Reintentos y Estrategias de Navegación

## 📋 Resumen

Sistema robusto de captura de screenshots y HTML con múltiples reintentos, estrategias de navegación adaptativas y cambios de user agent para maximizar la tasa de éxito en entornos de servidor (Render.com).

---

## 🏗️ Arquitectura

### Módulos Principales

```
andes/
├── navigation-strategies.js    # Módulo compartido de estrategias
├── scraper-losandes.js         # Captura de screenshots
├── server.js                   # Servidor Express + captura HTML
├── puppeteer-config.js         # Configuración de Puppeteer
└── date-utils.js               # Utilidades de fecha
```

---

## 🔄 Sistema de Reintentos

### Parámetros Globales

- **Máximo de reintentos**: 5 intentos
- **Esperas incrementales**: 15s, 30s, 45s, 60s entre intentos
- **Timeout total por captura**: ~12 minutos máximo

### Flujo de Reintentos

```
Intento 1 → Falla → Espera 15s
Intento 2 → Falla → Espera 30s
Intento 3 → Falla → Espera 45s
Intento 4 → Falla → Espera 60s
Intento 5 → Falla → Error crítico
```

---

## 🎯 Estrategias de Navegación

### Definidas en `navigation-strategies.js`

```javascript
NAVIGATION_STRATEGIES = [
  { waitUntil: "domcontentloaded", timeout: 90000 },   // Intento 1
  { waitUntil: "domcontentloaded", timeout: 120000 },  // Intento 2
  { waitUntil: "load", timeout: 120000 },              // Intento 3
  { waitUntil: "networkidle0", timeout: 120000 },      // Intento 4
  { waitUntil: "domcontentloaded", timeout: 150000 }   // Intento 5
]
```

### Descripción de Estrategias

| Estrategia | Descripción | Cuándo usar |
|------------|-------------|-------------|
| `domcontentloaded` | DOM cargado, sin esperar recursos | Rápido, ideal para HTML |
| `load` | Todos los recursos cargados | Más lento pero completo |
| `networkidle0` | Sin conexiones de red activas | Muy estricto, para contenido dinámico |

---

## 👤 User Agents Alternativos

### Definidos en `navigation-strategies.js`

```javascript
ALTERNATIVE_USER_AGENTS = [
  null,                           // Default (configurado en puppeteer-config)
  'Chrome 120 Windows',           // Intento 2
  'Safari 17 macOS',              // Intento 3
  'Chrome 120 Linux',             // Intento 4
  'Firefox 121 Windows'           // Intento 5
]
```

### Rotación de User Agents

- **Intento 1**: User agent por defecto
- **Intentos 2-5**: Cambia a user agents alternativos para evitar bloqueos

---

## 📸 Captura de Screenshots

### Función: `scrapeLosAndesWithRetry()`

**Ubicación**: `server.js` (líneas 820-840)

```javascript
async function scrapeLosAndesWithRetry(
  deviceType,           // 'desktop' | 'mobile'
  targetFolderId,       // ID carpeta Google Drive
  visualizationType,    // 'A' | 'B' | 'C' | 'D'
  jsonData,            // URLs de imágenes
  targetDate,          // Fecha objetivo o null
  maxRetries = 5       // Número de reintentos
)
```

### Flujo de Captura

```
1. scrapeLosAndesWithRetry() (server.js)
   ↓
2. Loop de reintentos (1-5)
   ↓
3. scrapeLosAndes(attempt, maxRetries) (scraper-losandes.js)
   ↓
4. navigateWithStrategies(page, url, attempt, maxRetries)
   ↓
5. Estrategia según intento + cambio user agent
   ↓
6. Screenshot capturado → Google Drive
```

### Uso en `server.js`

```javascript
// Desktop
const result = await scrapeLosAndesWithRetry(
  "desktop",
  targetFolderId,
  visualizationType,
  jsonDataForScraper,
  targetDate,
  5 // 5 intentos
);

// Mobile
const result = await scrapeLosAndesWithRetry(
  "mobile",
  targetFolderId,
  visualizationType,
  jsonDataForScraper,
  targetDate,
  5 // 5 intentos
);
```

---

## 📄 Captura de HTML

### Función: `captureAndSaveHTML()`

**Ubicación**: `server.js` (líneas 853-1010)

### Flujo de Captura

```
1. captureAndSaveHTML()
   ↓
2. Loop por dispositivo (desktop, mobile)
   ↓
3. Lanzar navegador Puppeteer
   ↓
4. Loop de reintentos (1-5)
   ↓
5. navigateWithStrategies(page, url, attempt, maxRetries)
   ↓
6. Obtener HTML completo
   ↓
7. Guardar/actualizar en Google Drive
```

### Características

- **Captura desktop y mobile**: Dos versiones del HTML
- **Actualización inteligente**: Si existe, actualiza; si no, crea
- **Carpeta Google Drive**: `1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49`
- **Formato de archivo**: `YYYY-MM-DD_desktop.html` / `YYYY-MM-DD_mobile.html`

---

## 🔧 Función Compartida: `navigateWithStrategies()`

### Ubicación

- **Módulo**: `navigation-strategies.js` (líneas 35-53)
- **Usado por**: `scraper-losandes.js` y `server.js`

### Implementación

```javascript
async function navigateWithStrategies(page, url, attempt, maxRetries) {
  const strategy = NAVIGATION_STRATEGIES[attempt - 1];
  console.log(`📡 Intento ${attempt}/${maxRetries} - Estrategia: ${strategy.name}`);
  
  // Cambiar user agent en intentos posteriores
  if (attempt > 1 && ALTERNATIVE_USER_AGENTS[attempt - 1]) {
    console.log(`🔄 Cambiando user agent...`);
    await page.setUserAgent(ALTERNATIVE_USER_AGENTS[attempt - 1]);
  }
  
  await page.goto(url, {
    waitUntil: strategy.waitUntil,
    timeout: strategy.timeout,
  });
}
```

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | Puppeteer.Page | Página de Puppeteer |
| `url` | string | URL a navegar |
| `attempt` | number | Número de intento actual (1-5) |
| `maxRetries` | number | Número máximo de reintentos |

---

## 📊 Resúmenes y Reportes

### Resumen de Screenshots

**Ubicación**: `server.js` (líneas 1337-1350)

```javascript
📊 ===== RESUMEN DE SCREENSHOTS =====
Desktop: 2 exitosos, 0 fallidos
Mobile: 3 exitosos, 1 fallidos
Total: 5 exitosos de 6 intentos
```

### Resumen de HTML

**Ubicación**: `server.js` (líneas 990-1008)

```javascript
📊 ===== RESUMEN DE CAPTURA DE HTML =====
Desktop: ✅ Exitoso
Mobile: ✅ Exitoso

🎉 Ambos HTMLs capturados exitosamente
```

---

## ❌ Manejo de Errores Críticos

### Screenshots

Si **todos** los screenshots fallan:

```javascript
❌ CRÍTICO: Todos los screenshots fallaron
❌ Posibles causas:
   - Los Andes está bloqueando la IP del servidor
   - Problemas de conectividad del servidor
   - Error en la configuración de Puppeteer

→ Lanza Error y detiene el proceso
```

### HTML

Si **ambos** HTMLs (desktop y mobile) fallan:

```javascript
❌ CRÍTICO: No se pudo capturar ningún HTML
❌ Posibles causas:
   - Los Andes está bloqueando la IP del servidor
   - Problemas de conectividad del servidor
   - Firewall bloqueando conexiones salientes

→ Lanza Error y detiene el proceso
```

---

## 🔍 Logs de Ejemplo

### Screenshot Exitoso en Primer Intento

```
🔄 Intento 1/5 para screenshot desktop
🚀 Iniciando scraper de Los Andes...
📱 Tipo de dispositivo: desktop
🌐 Navegando a Los Andes (página en vivo)...
📡 Intento 1/5 - Estrategia: domcontentloaded (90s)
✅ Página cargada exitosamente
📸 Tomando screenshot...
✅ Screenshot desktop exitoso en intento 1
```

### Screenshot con Reintentos

```
🔄 Intento 1/5 para screenshot mobile
📡 Intento 1/5 - Estrategia: domcontentloaded (90s)
⚠️ Intento 1/5 falló: Navigation timeout of 90000 ms exceeded
⏳ Esperando 15 segundos antes de reintentar...

🔄 Intento 2/5 para screenshot mobile
📡 Intento 2/5 - Estrategia: domcontentloaded (120s)
🔄 Cambiando user agent...
✅ Página cargada exitosamente
✅ Screenshot mobile exitoso en intento 2
```

### HTML con Estrategias

```
📱 ===== Capturando HTML DESKTOP =====
📄 Archivo: 2025-10-25_desktop.html
🔧 Lanzando navegador Puppeteer...
✅ Navegador lanzado exitosamente
🌐 Navegando a https://www.losandes.com.ar/...
📡 Intento 1/5 - Estrategia: domcontentloaded (90s)
✅ Página cargada exitosamente
📝 Obteniendo contenido HTML...
✅ HTML obtenido (457411 caracteres)
📝 Archivo existente encontrado, actualizando...
✅ HTML desktop actualizado: 2025-10-25_desktop.html
```

---

## 🚀 Ventajas del Sistema

### Resiliencia

- ✅ **5 intentos** con diferentes estrategias
- ✅ **Esperas incrementales** para problemas temporales
- ✅ **Cambio de user agent** para evitar bloqueos
- ✅ **Timeouts adaptativos** (90s → 150s)

### Mantenibilidad

- ✅ **Código DRY**: Función compartida `navigateWithStrategies()`
- ✅ **Módulo centralizado**: `navigation-strategies.js`
- ✅ **Fácil de modificar**: Cambios en un solo lugar

### Observabilidad

- ✅ **Logs detallados**: Cada paso registrado
- ✅ **Resúmenes claros**: Éxitos y fallos contabilizados
- ✅ **Errores informativos**: Causas posibles sugeridas

---

## 🔧 Configuración en Render.com

### Variables de Entorno Requeridas

```bash
GOOGLE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PORT=3000
```

### Puppeteer en Render.com

**Configuración en `puppeteer-config.js`:**

```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process'
]
```

---

## 📈 Métricas de Éxito

### Tiempo de Ejecución

| Escenario | Tiempo Estimado |
|-----------|-----------------|
| Screenshot exitoso (1er intento) | ~30 segundos |
| Screenshot con 2 reintentos | ~3 minutos |
| Screenshot con 5 reintentos | ~12 minutos |
| HTML exitoso (1er intento) | ~15 segundos |
| HTML con 2 reintentos | ~2 minutos |

### Tasa de Éxito Esperada

- **Local**: 95-100% en primer intento
- **Render.com**: 70-80% en primer intento, 95%+ con reintentos

---

## 🐛 Troubleshooting

### Problema: Todos los intentos fallan

**Posibles causas:**
1. Los Andes está bloqueando la IP del servidor
2. Firewall de Render.com bloqueando salida
3. Timeout muy corto para conexión lenta

**Solución:**
- Verificar conectividad: `curl https://www.losandes.com.ar/`
- Aumentar timeouts en `NAVIGATION_STRATEGIES`
- Considerar usar proxy

### Problema: Solo falla en Render.com

**Posibles causas:**
1. Recursos limitados del servidor
2. Red más lenta que local
3. Bloqueo por IP de datacenter

**Solución:**
- Verificar logs de Render.com
- Aumentar recursos del plan
- Implementar proxy o VPN

---

## 📝 Notas Importantes

### Captura de HTML

- Solo se captura si hay screenshots de fecha actual exitosos
- Se guarda en carpeta específica de Google Drive
- Formato: `YYYY-MM-DD_desktop.html` y `YYYY-MM-DD_mobile.html`
- Si existe, actualiza; si no, crea nuevo

### Screenshots

- Soporta tipos de visualización: A, B, C, D (desktop) y A, B, C (mobile)
- Puede usar HTML histórico o página en vivo
- Se combinan con navegador_full.png para contexto visual
- Se suben a carpetas específicas en Google Drive

---

## 🔄 Flujo Completo del Sistema

```
1. Endpoint POST /generate-screenshot
   ↓
2. Leer registros de Google Sheets
   ↓
3. DESKTOP: Para cada registro
   ├─ scrapeLosAndesWithRetry() (5 intentos)
   │  ├─ navigateWithStrategies()
   │  ├─ Capturar screenshot
   │  └─ Subir a Google Drive
   └─ Registrar resultado
   ↓
4. MOBILE: Para cada registro
   ├─ scrapeLosAndesWithRetry() (5 intentos)
   │  ├─ navigateWithStrategies()
   │  ├─ Capturar screenshot
   │  └─ Subir a Google Drive
   └─ Registrar resultado
   ↓
5. Resumen de Screenshots
   ↓
6. ¿Hay screenshots de fecha actual?
   ├─ SÍ → captureAndSaveHTML()
   │  ├─ Desktop HTML (5 intentos con navigateWithStrategies)
   │  └─ Mobile HTML (5 intentos con navigateWithStrategies)
   └─ NO → Saltar captura HTML
   ↓
7. Resumen de HTML
   ↓
8. Respuesta JSON con resultados
```

---

## 📚 Referencias

- **Puppeteer Docs**: https://pptr.dev/
- **Google Drive API**: https://developers.google.com/drive/api/v3/reference
- **Render.com**: https://render.com/docs

---

**Última actualización**: 2025-10-25
**Versión**: 2.0
**Autor**: Sistema de captura Los Andes
