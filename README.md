Este repo tiene como objetivo práctica implementaciones de IA y divertirme, así que no estoy siguiendo las mejores prácticas.

## Sistema de Carga de Imágenes Publicitarias

htmlFolderId

Sistema responsive para cargar y previsualizar imágenes publicitarias con validación de formatos y tamaños.

## Características

- Interfaz responsive con Materialize CSS
- Selector Desktop/Mobile
- Validación de formatos de imagen (JPG, PNG, GIF, WebP)
- Previsualización de imágenes cargadas
- Soporte para múltiples tipos de banners:
  - Imagen Lateral (300x250, 300x600, 160x600)
  - Imagen Ancho (Desktop: 728x90, 990x90, 970x250 | Mobile: 320x50, 320x100, 300x100)
  - Imagen Top (728x90, 990x90)
  - ITT (Desktop: 800x600 | Mobile: 320x480)
  - Zócalo (Mobile only: 320x100, 320x50)

## Instalación

```bash
npm install
```

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```bash
cp .env.example .env
```

### Configuración de Google Drive (Opcional)

Si deseas subir archivos a Google Drive en lugar de almacenarlos localmente:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Drive API**
4. Crea una **Service Account**:
   - Ve a "IAM & Admin" > "Service Accounts"
   - Crea una nueva cuenta de servicio
   - Descarga el archivo JSON con las credenciales
5. Copia los valores del JSON al archivo `.env`:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
6. (Opcional) Comparte una carpeta de Google Drive con el email de la service account y agrega el ID de la carpeta en `GOOGLE_DRIVE_FOLDER_ID`

**Nota:** Si no configuras Google Drive, el sistema funcionará normalmente usando almacenamiento local.

## Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor se ejecutará en `http://localhost:3000`

## Estructura del Proyecto

```
image-uploader/
├── server.js           # Servidor Express con endpoints de carga
├── public/
│   ├── index.html     # Interfaz principal
│   ├── css/
│   │   └── styles.css # Estilos personalizados
│   └── js/
│       └── app.js     # Lógica del cliente
├── uploads/           # Carpeta para imágenes subidas (creada automáticamente)
├── sample-images/     # Imágenes de ejemplo
└── package.json
```

## API Endpoints

### POST /upload
Sube múltiples imágenes al servidor.

**Body (multipart/form-data):**
- `imagenLateral`: File
- `imagenAncho`: File
- `imagenTop`: File
- `itt`: File
- `zocalo`: File (opcional, solo mobile)
- `deviceType`: String ('desktop' | 'mobile')

**Response:**
```json
{
  "success": true,
  "files": {
    "imagenLateral": "filename.jpg",
    "imagenAncho": "filename.jpg",
    ...
  }
}
```


```
Ids de carpetas:
const imagenes = "1bbkECY_axw5IttYjgVpRLmi6-EF80fZz";  // Imágenes de campañas
const jsones = "1d40AKgKucYUY-CnSqcLd1v8uyXhElk33";     // Archivos JSON
const capturas = "1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR";
const htmlFolderId = '1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49'; // Páginas web HTML
const parentId = '1norxhMEG62maIArwy-zjolxzPGsQoBzq'; // Carpeta raíz navegación
let currentFolderId = '1norxhMEG62maIArwy-zjolxzPGsQoBzq'; // Carpeta raíz
```

