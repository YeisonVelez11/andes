# 📚 Documentación de API - Proyecto Andes

## 📋 Tabla de Contenidos
- [Módulos Compartidos](#módulos-compartidos)
- [Server.js - API REST](#serverjs---api-rest)
- [Scraper-losandes.js](#scraper-losandesjs)
- [Puppeteer-config.js](#puppeteer-configjs)
- [Date-utils.js](#date-utilsjs)

---

## 🔧 Módulos Compartidos

### date-utils.js

#### `getArgentinaDateString(date)`
Obtiene la fecha actual en hora argentina en formato YYYY-MM-DD

**Parámetros:**
- `date` (Date, opcional): Fecha a convertir. Por defecto: fecha actual

**Retorna:**
- `string`: Fecha en formato YYYY-MM-DD

**Ejemplo:**
```javascript
const { getArgentinaDateString } = require('./date-utils');
const today = getArgentinaDateString();
// → "2025-10-24"
```

---

#### `getArgentinaDateTime(date)`
Obtiene la fecha y hora actual en hora argentina

**Parámetros:**
- `date` (Date, opcional): Fecha a convertir. Por defecto: fecha actual

**Retorna:**
- `Object`: Objeto con componentes de fecha y hora
  - `year` (string): Año (YYYY)
  - `month` (string): Mes (MM)
  - `day` (string): Día (DD)
  - `hours` (string): Horas (HH)
  - `minutes` (string): Minutos (MM)
  - `seconds` (string): Segundos (SS)
  - `date` (Date): Objeto Date en hora argentina

**Ejemplo:**
```javascript
const dt = getArgentinaDateTime();
// → { year: '2025', month: '10', day: '24', hours: '21', minutes: '18', seconds: '30', date: Date }
```

---

#### `getArgentinaTimestamp(date)`
Obtiene timestamp completo en hora argentina

**Parámetros:**
- `date` (Date, opcional): Fecha a convertir. Por defecto: fecha actual

**Retorna:**
- `string`: Timestamp en formato YYYY-MM-DD-HH-MM-SS

**Ejemplo:**
```javascript
const timestamp = getArgentinaTimestamp();
// → "2025-10-24-21-18-30"
```

---

### puppeteer-config.js

#### `launchBrowser(deviceType, options)`
Lanza un navegador Puppeteer con configuración optimizada para Linux sin GUI

**Parámetros:**
- `deviceType` (string, opcional): Tipo de dispositivo: 'desktop' o 'mobile'. Por defecto: 'desktop'
- `options` (Object, opcional): Opciones adicionales para puppeteer.launch()

**Retorna:**
- `Promise<Browser>`: Instancia del navegador Puppeteer

**Lanza:**
- `Error`: Si falla el lanzamiento del navegador

**Ejemplo:**
```javascript
const { launchBrowser } = require('./puppeteer-config');
const browser = await launchBrowser('mobile');
const page = await browser.newPage();
```

---

#### `configurePage(page, deviceType)`
Configura una página de Puppeteer con user agent y headers apropiados

**Parámetros:**
- `page` (Page): Página de Puppeteer a configurar
- `deviceType` (string, opcional): Tipo de dispositivo: 'desktop' o 'mobile'. Por defecto: 'desktop'

**Retorna:**
- `Promise<void>`

**Ejemplo:**
```javascript
const page = await browser.newPage();
await configurePage(page, 'mobile');
```

---

#### Constantes Exportadas

**`VIEWPORT_CONFIGS`**
```javascript
{
  desktop: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: true
  },
  mobile: {
    width: 400,
    height: 820,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
}
```

**`USER_AGENTS`**
```javascript
{
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 ...'
}
```

---

## 🌐 Server.js - API REST

### Funciones Helper

#### `authorize()`
Autoriza y conecta con Google Drive API usando credenciales JWT

**Retorna:**
- `Promise<google.auth.JWT>`: Cliente JWT autenticado

**Lanza:**
- `Error`: Si las credenciales son inválidas o la autorización falla

---

#### `uploadFileToDrive(folderId, fileName, buffer, mimeType)`
Sube un archivo a Google Drive

**Parámetros:**
- `folderId` (string): ID de la carpeta de destino en Google Drive
- `fileName` (string): Nombre del archivo a crear
- `buffer` (Buffer): Buffer con el contenido del archivo
- `mimeType` (string): Tipo MIME del archivo (ej: 'image/png', 'application/json')

**Retorna:**
- `Promise<Object>`: Objeto con datos del archivo subido
  - `id` (string): ID del archivo en Google Drive
  - `name` (string): Nombre del archivo
  - `webViewLink` (string): URL para visualizar el archivo
  - `webContentLink` (string): URL para descargar el archivo

**Lanza:**
- `Error`: Si Google Drive no está inicializado o falla la subida

---

#### `generateDateArray(startDate, endDate)`
Genera un array de fechas entre dos fechas (inclusive)

**Parámetros:**
- `startDate` (string): Fecha inicial en formato YYYY-MM-DD
- `endDate` (string): Fecha final en formato YYYY-MM-DD

**Retorna:**
- `string[]`: Array de fechas en formato YYYY-MM-DD

**Ejemplo:**
```javascript
generateDateArray('2025-10-20', '2025-10-22')
// → ['2025-10-20', '2025-10-21', '2025-10-22']
```

---

#### `captureAndSaveHTML()`
Captura el HTML de Los Andes (desktop y mobile) y lo guarda en Google Drive

**Descripción:**
- Usa la fecha actual de Argentina para nombrar los archivos
- Si el archivo ya existe, lo actualiza; si no, lo crea
- Captura tanto versión desktop como mobile

**Retorna:**
- `Promise<void>`

**Lanza:**
- `Error`: Si falla el lanzamiento del navegador o la captura del HTML

---

### Endpoints REST

#### `GET /health`
Health check endpoint para monitoreo

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T21:18:30.000Z",
  "uptime": 12345.67,
  "drive": "connected"
}
```

---

#### `GET /`
Sirve la página principal (index.html)

---

#### `POST /upload`
Sube imágenes y crea archivos JSON en Google Drive

**Body (multipart/form-data):**
- `imagenLateral` (file, opcional): Imagen lateral
- `imagenAncho` (file, opcional): Imagen ancho
- `imagenTop` (file, opcional): Imagen top
- `itt` (file, opcional): Imagen ITT
- `zocalo` (file, opcional): Zócalo (solo mobile)
- `deviceType` (string): 'desktop' o 'mobile'
- `visualizationType` (string, opcional): 'A', 'B', 'C', 'D' (desktop) o 'A', 'B', 'C' (mobile)
- `selectedFolderId` (string, opcional): ID de carpeta personalizada
- `selectedFolderName` (string, opcional): Nombre de carpeta personalizada
- `dateRange1` (JSON string): `{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }`
- `dateRange2` (JSON string, opcional): Segundo rango de fechas
- `firstLastOnly` (string): 'true' o 'false'

**Respuesta:**
```json
{
  "success": true,
  "message": "Imágenes subidas a Google Drive correctamente",
  "deviceType": "desktop",
  "files": {
    "imagenLateral": {
      "originalname": "imagen.jpg",
      "size": 123456,
      "mimetype": "image/jpeg",
      "driveId": "abc123",
      "driveLink": "https://drive.google.com/...",
      "driveContentLink": "https://drive.google.com/..."
    }
  },
  "jsonFiles": [
    {
      "date": "2025-10-24",
      "fileId": "xyz789",
      "action": "created"
    }
  ],
  "uploadedAt": "2025-10-24T21:18:30.000Z"
}
```

---

#### `GET /uploads`
Lista archivos de imágenes en Google Drive

**Respuesta:**
```json
{
  "success": true,
  "files": [
    {
      "id": "abc123",
      "name": "imagen.jpg",
      "size": "123456",
      "createdTime": "2025-10-24T21:18:30.000Z",
      "webViewLink": "https://drive.google.com/...",
      "webContentLink": "https://drive.google.com/...",
      "thumbnailLink": "https://drive.google.com/...",
      "mimeType": "image/jpeg"
    }
  ]
}
```

---

#### `GET /folders?parentId=<folderId>`
Lista carpetas en Google Drive

**Query Params:**
- `parentId` (string, opcional): ID de la carpeta padre. Por defecto: carpeta raíz

**Respuesta:**
```json
{
  "success": true,
  "folders": [
    {
      "id": "folder123",
      "name": "Campaña 2025",
      "mimeType": "application/vnd.google-apps.folder",
      "modifiedTime": "2025-10-24T21:18:30.000Z"
    }
  ],
  "parentId": "root123"
}
```

---

#### `GET /folder-info/:folderId`
Obtiene información de una carpeta específica

**Params:**
- `folderId` (string): ID de la carpeta

**Respuesta:**
```json
{
  "success": true,
  "folder": {
    "id": "folder123",
    "name": "Campaña 2025",
    "parents": ["parent123"]
  }
}
```

---

#### `GET /json-files`
Lista archivos JSON en Google Drive

**Respuesta:**
```json
{
  "success": true,
  "files": [
    {
      "id": "json123",
      "name": "2025-10-24.json",
      "size": "1234",
      "createdTime": "2025-10-24T21:18:30.000Z",
      "modifiedTime": "2025-10-24T21:18:30.000Z",
      "webViewLink": "https://drive.google.com/...",
      "webContentLink": "https://drive.google.com/..."
    }
  ]
}
```

---

#### `GET /json-file/:fileId`
Obtiene contenido de un archivo JSON específico

**Params:**
- `fileId` (string): ID del archivo JSON

**Respuesta:**
```json
{
  "success": true,
  "content": [
    {
      "imagenLateral": "/image/abc123",
      "imagenAncho": "/image/def456",
      "imagenTop": null,
      "itt": null,
      "zocalo": null,
      "deviceType": "desktop",
      "uploadedAt": "2025-10-24T21:18:30.000Z",
      "tipo_visualizacion": "A",
      "carpeta_id": "folder123",
      "carpeta_nombre": "Campaña 2025",
      "campana": "Campaña 2025-desktop-A"
    }
  ]
}
```

---

#### `GET /image/:fileId`
Sirve una imagen desde Google Drive (proxy)

**Params:**
- `fileId` (string): ID del archivo en Google Drive

**Respuesta:**
- Imagen en formato binario con headers apropiados
- Si hay error, retorna imagen transparente 1x1

---

#### `GET /generate-screenshot`
Genera screenshots para la fecha actual (simplificado)

**Descripción:**
Llama internamente al endpoint POST con la fecha actual de Argentina

**Respuesta:**
Igual que `POST /generate-screenshot`

---

#### `POST /generate-screenshot`
Genera screenshots de Los Andes para fechas específicas

**Body (JSON):**
```json
{
  "targetDates": ["2025-10-24", "2025-10-25"]
}
```

**Nota:** Si `targetDates` está vacío o no se proporciona, usa la fecha actual de Argentina

**Respuesta:**
```json
{
  "success": true,
  "message": "4 screenshots generados exitosamente (2 desktop, 2 mobile) para 2 fecha(s)",
  "data": {
    "desktop": [
      {
        "success": true,
        "deviceType": "desktop",
        "fileName": "2025-10-24-21-18-30-A-desktop.png",
        "driveId": "abc123",
        "driveLink": "https://drive.google.com/...",
        "visualizationType": "A",
        "recordIndex": 0,
        "date": "2025-10-24"
      }
    ],
    "mobile": [
      {
        "success": true,
        "deviceType": "mobile",
        "fileName": "2025-10-24-21-18-30-B-mobile.png",
        "driveId": "def456",
        "driveLink": "https://drive.google.com/...",
        "recordIndex": 0,
        "date": "2025-10-24"
      }
    ]
  }
}
```

---

## 📸 Scraper-losandes.js

### `scrapeLosAndes(deviceType, capturasFolderId, visualizationType, jsonData, targetDate)`

Función principal para capturar screenshots de Los Andes

**Parámetros:**
- `deviceType` (string, opcional): Tipo de dispositivo: 'desktop' o 'mobile'. Por defecto: 'desktop'
- `capturasFolderId` (string): ID de la carpeta de Google Drive donde guardar el screenshot
- `visualizationType` (string|null, opcional): Tipo de visualización
  - Desktop: 'A', 'B', 'C', 'D'
  - Mobile: 'A', 'B', 'C'
- `jsonData` (Object|null, opcional): Datos JSON con URLs de imágenes a insertar
  - `imagenLateral` (string): URL de imagen lateral
  - `imagenAncho` (string): URL de imagen ancho
  - `imagenTop` (string): URL de imagen top
  - `itt` (string): URL de imagen ITT
  - `zocalo` (string): URL de zócalo (solo mobile)
- `targetDate` (string|null, opcional): Fecha objetivo en formato YYYY-MM-DD (para cargar HTML histórico)

**Retorna:**
- `Promise<Object>`: Objeto con resultado del screenshot
  - `success` (boolean): Indica si la operación fue exitosa
  - `deviceType` (string): Tipo de dispositivo usado
  - `fileName` (string): Nombre del archivo generado
  - `driveId` (string): ID del archivo en Google Drive
  - `driveLink` (string): Link de visualización en Google Drive

**Lanza:**
- `Error`: Si falla el lanzamiento del navegador o la captura del screenshot

**Ejemplos:**

```javascript
// Screenshot actual sin imágenes
await scrapeLosAndes('desktop', 'folderId123', 'A', null, null);

// Screenshot histórico con imágenes
await scrapeLosAndes('mobile', 'folderId123', 'B', {
  imagenLateral: 'https://example.com/img1.jpg',
  imagenAncho: 'https://example.com/img2.jpg'
}, '2025-10-20');
```

**Tipos de Visualización:**

**Desktop:**
- **A**: Lateral + Ancho
- **B**: Solo Lateral
- **C**: Solo Top
- **D**: Solo ITT

**Mobile:**
- **A**: Lateral + Ancho + Zócalo
- **B**: Solo Lateral + Zócalo
- **C**: Solo Ancho + Zócalo

---

## 🌍 Zona Horaria

**Importante:** Todo el proyecto usa la zona horaria de Argentina (America/Argentina/Buenos_Aires, UTC-3).

**Archivos que usan hora argentina:**
- ✅ `server.js` - Todas las fechas
- ✅ `scraper-losandes.js` - Timestamps de screenshots
- ✅ `generate-screenshots-today.js` - Fecha del día
- ✅ `public/js/app.js` - Fecha inicial del frontend

**Formato de nombres de archivo:**
- Screenshots: `YYYY-MM-DD-HH-MM-SS-[tipo]-[device].png`
- HTML: `YYYY-MM-DD_[device].html`
- JSON: `YYYY-MM-DD.json`

---

## 📁 Estructura de Google Drive

```
📁 Carpeta Raíz (1norxhMEG62maIArwy-zjolxzPGsQoBzq)
├── 📁 imagenes (1bbkECY_axw5IttYjgVpRLmi6-EF80fZz)
│   └── Imágenes subidas por el usuario
├── 📁 jsones (1d40AKgKucYUY-CnSqcLd1v8uyXhElk33)
│   └── Archivos JSON con metadata de campañas
├── 📁 capturas (1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR)
│   └── Screenshots generados (por defecto)
├── 📁 webs_pasado (1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49)
│   └── HTMLs históricos capturados
└── 📁 [Carpetas personalizadas]
    └── Screenshots de campañas específicas
```

---

## 🔐 Variables de Entorno

```env
# Google Drive API
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Servidor
PORT=3000
HOST=localhost
BASE_URL=http://localhost:3000

# Puppeteer (Producción)
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

---

## 🚀 Uso Rápido

### Generar Screenshots del Día Actual

```bash
node generate-screenshots-today.js
```

### Iniciar Servidor

```bash
npm start
# o
npm run dev  # Con nodemon
```

### Generar Screenshot Programáticamente

```javascript
const { scrapeLosAndes } = require('./scraper-losandes');

// Screenshot simple
const result = await scrapeLosAndes(
  'desktop',
  'capturasFolderId',
  'A',
  null,
  null
);

console.log(result.driveLink);
```

---

## 📝 Notas Importantes

1. **Almacenamiento:** Los archivos NO se guardan localmente. Todo va directamente a Google Drive.

2. **Memoria:** Multer usa `memoryStorage`, los archivos se mantienen en RAM temporalmente.

3. **Zona Horaria:** Siempre se usa hora argentina (UTC-3), independientemente de dónde esté deployado el servidor.

4. **Puppeteer:** Configurado para funcionar en Linux sin GUI (headless).

5. **Fechas Históricas:** Si `targetDate < fechaActual`, se carga HTML histórico desde Google Drive.

6. **Validación:** No se pueden generar screenshots para fechas futuras.

---

## 🐛 Debugging

**Ver logs detallados:**
- Los logs incluyen emojis para fácil identificación
- Cada paso del proceso está logueado
- Los errores incluyen stack traces completos

**Verificar conexión a Google Drive:**
```bash
curl http://localhost:3000/health
```

**Probar captura de HTML:**
```bash
curl -X GET http://localhost:3000/generate-screenshot
```

---

Última actualización: 2025-10-24
