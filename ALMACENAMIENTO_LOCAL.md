# 📁 Sistema de Almacenamiento Local

## 🎯 Descripción

El sistema ahora soporta **dos modos de almacenamiento**:

1. **Google Drive** (por defecto) - Almacenamiento en la nube
2. **Almacenamiento Local** - Archivos guardados localmente en el servidor

Ambos modos ofrecen **exactamente la misma funcionalidad** y la interfaz web funciona idénticamente en ambos casos.

## ⚙️ Configuración

### Activar Almacenamiento Local

En tu archivo `.env`, agrega o modifica:

```env
CARPETAS_LOCALES=true
```

### Desactivar Almacenamiento Local (usar Google Drive)

```env
CARPETAS_LOCALES=false
```

O simplemente elimina la variable del `.env`.

## 📂 Estructura de Carpetas Locales

Cuando `CARPETAS_LOCALES=true`, se crean automáticamente las siguientes carpetas:

```
andes/
├── navegacion/                    # Carpeta raíz de navegación (equivalente a Drive)
│   ├── [subcarpetas dinámicas]   # Carpetas creadas por el usuario
│   └── ...
│
└── config_local/                  # Carpetas de configuración
    ├── imagenes_cargadas/         # Imágenes subidas desde el formulario
    ├── jsones/                    # Archivos JSON de campañas
    ├── html/                      # Páginas HTML generadas
    ├── capturas/                  # Screenshots generados
    └── metadata.json              # Metadatos de archivos y carpetas
```

## 🔄 Mapeo de IDs de Google Drive

El sistema mantiene compatibilidad con los IDs de Google Drive:

| ID de Google Drive | Carpeta Local |
|-------------------|---------------|
| `1bbkECY_axw5IttYjgVpRLmi6-EF80fZz` | `config_local/imagenes_cargadas/` |
| `1d40AKgKucYUY-CnSqcLd1v8uyXhElk33` | `config_local/jsones/` |
| `1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49` | `config_local/html/` |
| `1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR` | `config_local/capturas/` |
| `1norxhMEG62maIArwy-zjolxzPGsQoBzq` | `navegacion/` (raíz) |

## 🚀 Uso

### Inicio del Servidor

El servidor detecta automáticamente el modo de almacenamiento al iniciar:

```bash
npm start
```

**Con almacenamiento local:**
```
📁 Modo de almacenamiento: LOCAL
✅ Almacenamiento local inicializado
📁 Carpeta base: /ruta/al/proyecto/navegacion
⚙️  Configuración: /ruta/al/proyecto/config_local
```

**Con Google Drive:**
```
☁️  Modo de almacenamiento: GOOGLE DRIVE
✅ Google Drive API initialized
```

### Funcionalidades Disponibles

Todas las funcionalidades funcionan igual en ambos modos:

- ✅ **Subir imágenes** - Se guardan en `imagenes_cargadas/` o Drive
- ✅ **Crear campañas** - JSONs en `jsones/` o Drive
- ✅ **Navegar carpetas** - Estructura idéntica en ambos modos
- ✅ **Crear subcarpetas** - En `navegacion/` o Drive
- ✅ **Generar screenshots** - En `capturas/` o Drive
- ✅ **Guardar HTML** - En `html/` o Drive
- ✅ **Listar archivos** - Misma API en ambos modos

## 🔧 API Técnica

### Módulos Creados

#### `local-storage.js`
Implementa todas las operaciones de almacenamiento local:
- `uploadFileToLocal()` - Sube archivos
- `listFilesInLocal()` - Lista archivos
- `listFoldersInLocal()` - Lista carpetas
- `createFolderInLocal()` - Crea carpetas
- `readFileFromLocal()` - Lee archivos
- `deleteFileFromLocal()` - Elimina archivos

#### `storage-adapter.js`
Adaptador que unifica ambos modos de almacenamiento:
- `uploadFile()` - Sube archivo (Drive o Local)
- `listFiles()` - Lista archivos (Drive o Local)
- `listFolders()` - Lista carpetas (Drive o Local)
- `createFolder()` - Crea carpeta (Drive o Local)
- `readFile()` - Lee archivo (Drive o Local)
- `deleteFile()` - Elimina archivo (Drive o Local)

### Uso en Código

```javascript
const storageAdapter = require('./storage-adapter');

// Subir archivo (funciona en ambos modos)
const result = await storageAdapter.uploadFile(
  folderId,
  fileName,
  buffer,
  mimeType,
  driveClient  // null si es modo local
);

// Listar carpetas (funciona en ambos modos)
const folders = await storageAdapter.listFolders(
  parentId,
  driveClient  // null si es modo local
);

// Verificar modo actual
if (storageAdapter.isLocalMode()) {
  console.log('Usando almacenamiento local');
} else {
  console.log('Usando Google Drive');
}
```

## 🔐 Metadatos

El archivo `config_local/metadata.json` almacena información sobre archivos y carpetas:

```json
{
  "files": {
    "abc123": {
      "id": "abc123",
      "name": "imagen.jpg",
      "mimeType": "image/jpeg",
      "folderId": "1bbkECY_axw5IttYjgVpRLmi6-EF80fZz",
      "path": "/ruta/completa/imagen.jpg",
      "createdTime": "2025-11-06T19:00:00.000Z",
      "size": 12345
    }
  },
  "folders": {
    "def456": {
      "id": "def456",
      "name": "Mi Carpeta",
      "path": "/ruta/completa/Mi Carpeta",
      "parentId": "1norxhMEG62maIArwy-zjolxzPGsQoBzq",
      "createdTime": "2025-11-06T19:00:00.000Z"
    }
  }
}
```

## 🔄 Migración entre Modos

### De Google Drive a Local

1. Configurar `CARPETAS_LOCALES=true` en `.env`
2. Reiniciar el servidor
3. Las carpetas se crearán automáticamente
4. Subir nuevamente las imágenes y archivos necesarios

### De Local a Google Drive

1. Configurar `CARPETAS_LOCALES=false` en `.env`
2. Asegurarse de tener las credenciales de Google Drive
3. Reiniciar el servidor
4. Los archivos locales permanecen intactos pero no se usan

## 🎨 Interfaz Web

La interfaz web funciona **exactamente igual** en ambos modos:

- ✅ Misma navegación de carpetas
- ✅ Mismos formularios de carga
- ✅ Misma visualización de imágenes
- ✅ Misma gestión de campañas
- ✅ Sin cambios visuales

El usuario no nota diferencia alguna entre usar Google Drive o almacenamiento local.

## 🐛 Troubleshooting

### Error: "Almacenamiento no está configurado"

**Causa:** Ni Google Drive ni almacenamiento local están configurados.

**Solución:**
- Si quieres usar local: `CARPETAS_LOCALES=true` en `.env`
- Si quieres usar Drive: Configurar credenciales de Google Drive

### Las carpetas no se crean

**Causa:** Permisos insuficientes en el directorio.

**Solución:**
```bash
chmod 755 /ruta/al/proyecto
```

### Los archivos no se encuentran

**Causa:** El archivo `metadata.json` está corrupto o no existe.

**Solución:**
```bash
rm config_local/metadata.json
# Reiniciar el servidor para regenerarlo
```

## 📊 Ventajas de Cada Modo

### Google Drive
- ✅ Acceso desde cualquier lugar
- ✅ Backup automático en la nube
- ✅ Compartir fácilmente con otros
- ❌ Requiere credenciales y conexión a internet
- ❌ Límites de cuota de API

### Almacenamiento Local
- ✅ No requiere credenciales externas
- ✅ Más rápido (sin latencia de red)
- ✅ Sin límites de cuota
- ✅ Funciona sin internet
- ❌ Solo accesible desde el servidor
- ❌ Requiere backup manual

## 🔮 Futuro

Posibles mejoras:

- [ ] Sincronización automática entre Local y Drive
- [ ] Migración automática de datos
- [ ] Backup automático del almacenamiento local
- [ ] Compresión de archivos antiguos
- [ ] Estadísticas de uso de almacenamiento

## 📝 Notas Importantes

1. **Los IDs son diferentes:** Los archivos en modo local tienen IDs diferentes a los de Google Drive
2. **No hay sincronización:** Cambiar de modo no migra los datos automáticamente
3. **Backup manual:** En modo local, debes hacer backup de `navegacion/` y `config_local/`
4. **Permisos:** Asegúrate de que el servidor tenga permisos de escritura en el directorio
