# Contexto del Proyecto Andes - Resumen de Sesión

## 📌 Información General del Proyecto

**Nombre:** Sistema de Screenshots Automatizados de Los Andes  
**Tecnologías:** Node.js, Express, Puppeteer, Google Drive API, Materialize CSS  
**Zona Horaria:** America/Argentina/Buenos_Aires (UTC-3)  
**Puerto:** 3000  
**Almacenamiento:** Google Drive

## 🏗️ Arquitectura del Proyecto

### Archivos Principales

1. **`server.js`** - Servidor Express principal
   - Endpoints de API
   - Gestión de uploads
   - Generación de screenshots
   - Captura de HTML histórico

2. **`scraper-losandes.js`** - Motor de scraping
   - Captura de screenshots con Puppeteer
   - Inserción de imágenes en el DOM
   - Procesamiento de imágenes con Sharp
   - Subida a Google Drive

3. **`puppeteer-config.js`** - Configuración centralizada de Puppeteer
   - Configuraciones de viewport (desktop/mobile)
   - Opciones de lanzamiento del navegador
   - Configuración de página

4. **`date-utils.js`** - Utilidades de fecha
   - `getArgentinaDateString()` - Fecha en formato YYYY-MM-DD
   - `getArgentinaDateTime()` - Fecha y hora completa
   - `getArgentinaTimestamp()` - Timestamp formateado

5. **`public/js/app.js`** - Frontend
   - Gestión de formularios
   - Subida de imágenes
   - Visualización de galería
   - Selector de carpetas de Google Drive

## 🔧 Problemas Resueltos en Esta Sesión

### 1. **Captura de HTML para fechas futuras** ✅
**Problema:** El sistema capturaba HTML incluso cuando se procesaban fechas futuras.

**Solución:**
- Creada función `isFutureDate()` que usa hora de Argentina
- Validación en loops de desktop y mobile
- Verificación de screenshots exitosos antes de capturar HTML
- Solo captura HTML si hay screenshots de la fecha actual

**Archivos modificados:**
- `server.js` (líneas 121-124, 1195-1233)

### 2. **Inconsistencia de zona horaria** ✅
**Problema:** `isFutureDate()` usaba hora local del servidor (UTC) mientras que `getArgentinaDateString()` usaba hora de Argentina.

**Solución:**
- Modificada `isFutureDate()` para usar `getArgentinaDateString()`
- Consistencia en toda la aplicación con hora de Argentina

**Código:**
```javascript
function isFutureDate(dateString) {
  const todayArgentina = getArgentinaDateString();
  return dateString > todayArgentina;
}
```

### 3. **Funciones faltantes** ✅
**Problema:** Errores `ReferenceError` por funciones no definidas.

**Soluciones:**
- `uploadBufferToDrive` → Cambiado a `uploadFileToDrive`
- `generateDateRange` → Cambiado a `generateDateArray`
- Agregadas funciones helper: `findJsonFileByName`, `getJsonFileContent`, `createOrUpdateJsonFile`

### 4. **Botón "Subir Campaña" quedaba blanco** ✅
**Problema:** Múltiples clicks rápidos causaban que el botón perdiera su estado.

**Solución:**
- Agregada bandera `isSubmitting` para prevenir múltiples submits
- Validaciones antes de marcar como submitting
- Reset de bandera en bloque `finally`

**Código:**
```javascript
let isSubmitting = false;

async function handleFormSubmit(e) {
  if (isSubmitting) return;
  isSubmitting = true;
  try {
    // ... lógica
  } finally {
    isSubmitting = false;
  }
}
```

### 5. **Inputs file no se limpiaban** ✅
**Problema:** Al hacer click en "Limpiar Todo" o después de subir campaña, los inputs file no se limpiaban visualmente.

**Solución:**
- Limpieza del `input.value`
- Limpieza del `.file-path` de Materialize
- Llamada a `clearAllPreviews()` después de submit exitoso

**Código:**
```javascript
function clearAllPreviews() {
  fileInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    input.value = '';
    const pathSpan = input.closest('.file-field').querySelector('.file-path');
    pathSpan.value = '';
  });
}
```

### 6. **Código duplicado** ✅
**Problema:** Configuración de Puppeteer y funciones de fecha duplicadas en múltiples archivos.

**Solución:**
- Creado `puppeteer-config.js` con configuraciones centralizadas
- Creado `date-utils.js` con funciones de fecha reutilizables
- Importados en `server.js`, `scraper-losandes.js`, `generate-screenshots-today.js`

## 📊 Flujo de Trabajo del Sistema

### 1. **Subida de Campaña (Frontend → Backend)**
```
Usuario selecciona imágenes
  ↓
Selecciona rango de fechas
  ↓
Selecciona carpeta de destino
  ↓
Click en "Subir Campaña"
  ↓
POST /upload
  ↓
Archivos subidos a Google Drive
  ↓
JSONs creados/actualizados con metadata
  ↓
Respuesta exitosa
  ↓
Formulario limpiado automáticamente
```

### 2. **Generación de Screenshots**
```
POST /generate-screenshots
  ↓
Validar fechas (saltar futuras)
  ↓
Para cada fecha válida:
  ├─ Buscar JSON en Google Drive
  ├─ Para cada registro:
  │   ├─ Si fecha < hoy → Usar HTML histórico
  │   ├─ Si fecha = hoy → Usar página en vivo
  │   ├─ Lanzar Puppeteer
  │   ├─ Insertar imágenes en DOM
  │   ├─ Tomar screenshot
  │   ├─ Procesar con Sharp (agregar barra Chrome/navegador)
  │   └─ Subir a Google Drive
  ↓
Verificar si hay screenshots de fecha actual
  ↓
Si hay → Capturar HTML en vivo
  ↓
Guardar HTML en Google Drive
```

### 3. **Captura de HTML Histórico**
```
Verificar screenshots generados
  ↓
¿Hay screenshots de fecha actual?
  ├─ SÍ → Capturar HTML
  │   ├─ Desktop: https://losandes.com.ar (viewport 1920x1080)
  │   ├─ Mobile: https://losandes.com.ar (viewport 400x820)
  │   ├─ Guardar como YYYY-MM-DD_desktop.html
  │   └─ Guardar como YYYY-MM-DD_mobile.html
  └─ NO → Saltar captura
```

## 🎯 Tipos de Visualización

### Desktop
- **Tipo A:** Imagen lateral (300x600)
- **Tipo B:** Imagen ancho (970x250)
- **Tipo C:** Imagen top (728x90)
- **Tipo D:** ITT overlay con fondo gris

### Mobile
- **Tipo A:** Imagen lateral (adaptada)
- **Tipo B:** Imagen ancho (adaptada)
- **Tipo C:** ITT overlay (igual que Desktop D)

## 🔑 Variables de Entorno Importantes

```env
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
DRIVE_FOLDER_ID=1bbkECY_axw5IttYjgVpRLmi6-EF80fZz
PORT=3000
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 📁 Estructura de Google Drive

```
Root (1bbkECY_axw5IttYjgVpRLmi6-EF80fZz)
├── imagenes/ - Imágenes subidas por el usuario
├── jsones/ - Archivos JSON con metadata de campañas
├── html_historico/ - HTMLs capturados por fecha
└── [carpetas de cliente]/ - Screenshots generados
```

## 🚀 Comandos Útiles

### Desarrollo
```bash
node server.js                    # Iniciar servidor
npm start                         # Alias para iniciar
```

### Producción (con PM2)
```bash
pm2 start ecosystem.config.js     # Iniciar
pm2 logs andes                    # Ver logs
pm2 restart andes                 # Reiniciar
pm2 stop andes                    # Detener
pm2 status                        # Ver estado
```

### Despliegue
```bash
# Comprimir proyecto
tar -czf andes.tar.gz --exclude='node_modules' --exclude='.git' .

# Subir al servidor
scp andes.tar.gz root@IP_SERVIDOR:/tmp/

# En servidor
tar -xzf /tmp/andes.tar.gz
npm install --production
pm2 restart andes
```

## 🐛 Debugging

### Ver logs de fecha argentina
```bash
# En cualquier endpoint
curl http://localhost:3000/health
# Respuesta incluye: "argentinaDate": "2025-10-25"
```

### Ver logs de screenshots
Los logs muestran:
```
🔍 DESKTOP - dateToProcess: 2025-10-24, currentDate: 2025-10-25, targetDate: 2025-10-24
🔍 MOBILE - dateToProcess: 2025-10-24, currentDate: 2025-10-25, targetDate: 2025-10-24
```

- `targetDate: null` → Usa página en vivo
- `targetDate: YYYY-MM-DD` → Usa HTML histórico

### Verificar captura de HTML
```
🔍 Verificando captura de HTML...
📅 Fecha actual (Argentina): 2025-10-25
📊 Total screenshots desktop: 1
📊 Total screenshots mobile: 1
✅ ¿Hay screenshots de fecha actual?: true
```

## 📚 Documentación Adicional

- **`API_DOCUMENTATION.md`** - Documentación completa de endpoints y arquitectura
- **`DEPLOYMENT.md`** - Guía de despliegue en servidor Linux con Nginx
- **`README.md`** - Información general del proyecto (si existe)

## 💡 Mejores Prácticas Implementadas

1. ✅ **Zona horaria consistente** - Todo usa hora de Argentina
2. ✅ **Validación de fechas futuras** - Previene errores
3. ✅ **Código modular** - Configuraciones centralizadas
4. ✅ **Prevención de múltiples submits** - Bandera `isSubmitting`
5. ✅ **Logs detallados** - Fácil debugging
6. ✅ **Manejo de errores** - Try-catch en operaciones críticas
7. ✅ **Limpieza automática** - Formularios se limpian después de submit
8. ✅ **Documentación completa** - API y despliegue documentados

## 🔮 Para Futuras Sesiones

### Cómo recuperar este contexto:
Simplemente menciona:
- "Proyecto Andes" o "Sistema de screenshots de Los Andes"
- "Revisa el contexto del proyecto" o "Lee PROJECT_CONTEXT.md"
- Cualquier problema específico mencionado aquí

### Archivos clave para revisar:
1. `PROJECT_CONTEXT.md` (este archivo)
2. `API_DOCUMENTATION.md`
3. `DEPLOYMENT.md`
4. `server.js`
5. `scraper-losandes.js`

---

**Última actualización:** 2025-10-24  
**Versión del proyecto:** 1.0  
**Estado:** Producción estable ✅
