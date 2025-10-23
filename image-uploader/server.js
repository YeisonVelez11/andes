require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { google } = require('googleapis');
const streamifier = require('streamifier');
const { scrapeLosAndes } = require('./scraper-losandes');

const app = express();
const PORT = process.env.PORT || 3000;

// Google Drive folder IDs
const imagenes = "1LuybE4izyMOVB8I450DBC4ibhHab1KFJ";
const jsones = "1O9Pq8XK-JI8eEvdrNYhaA-beSKAr1-sm";
const capturas = "1pU3cEM7o0uzIvwSapmsF4YYX5lOiSYEs";


async function authorize() {
    const jwtClient = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive']
    );

    await jwtClient.authorize();
    console.log('Successfully connected to Google Drive API.');
    return jwtClient;
}

// Initialize Google Drive client
let driveClient = null;

// Connect to Google Drive on startup
if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  authorize()
    .then(auth => {
      driveClient = google.drive({ version: 'v3', auth });
      console.log('✅ Google Drive API initialized');
    })
    .catch(err => {
      console.error('❌ Error connecting to Google Drive:', err.message);
    });
} else {
  console.warn('⚠️  Google Drive credentials not found.');
}

// Helper function to upload file to Google Drive
async function uploadBufferToDrive(folderId, fileName, buffer, mimeType) {
  if (!driveClient) {
    throw new Error('Google Drive client not initialized');
  }

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: mimeType,
    body: streamifier.createReadStream(buffer),
  };

  try {
    const response = await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    console.log(`✅ File uploaded to Google Drive: ${fileName} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('❌ Error uploading to Google Drive:', error.message);
    throw error;
  }
}

// Helper function to find JSON file by name in folder
async function findJsonFileByName(folderId, fileName) {
  if (!driveClient) return null;
  
  try {
    const response = await driveClient.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false and mimeType='application/json'`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    return response.data.files.length > 0 ? response.data.files[0] : null;
  } catch (error) {
    console.error('Error buscando archivo JSON:', error.message);
    return null;
  }
}

// Helper function to get JSON file content
async function getJsonFileContent(fileId) {
  if (!driveClient) return null;
  
  try {
    const response = await driveClient.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    return response.data;
  } catch (error) {
    console.error('Error obteniendo contenido JSON:', error.message);
    return null;
  }
}

// Helper function to create or update JSON file
async function createOrUpdateJsonFile(folderId, fileName, content) {
  if (!driveClient) {
    throw new Error('Google Drive client not initialized');
  }

  // Buscar si el archivo ya existe
  const existingFile = await findJsonFileByName(folderId, fileName);
  
  const jsonContent = JSON.stringify(content, null, 2);
  const buffer = Buffer.from(jsonContent, 'utf-8');
  
  const media = {
    mimeType: 'application/json',
    body: streamifier.createReadStream(buffer),
  };

  try {
    if (existingFile) {
      // Actualizar archivo existente
      const response = await driveClient.files.update({
        fileId: existingFile.id,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });
      console.log(`✅ JSON file updated: ${fileName}`);
      return response.data;
    } else {
      // Crear nuevo archivo
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json'
      };

      const response = await driveClient.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });
      console.log(`✅ JSON file created: ${fileName}`);
      return response.data;
    }
  } catch (error) {
    console.error('❌ Error creating/updating JSON file:', error.message);
    throw error;
  }
}

// Helper function to generate dates between two dates
function generateDateRange(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(new Date(currentDate).toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración de Multer para almacenamiento en memoria (sin guardar localmente)
const storage = multer.memoryStorage();

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, JPG, PNG, GIF, WebP)'));
  }
};

// Configurar multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo por archivo
  },
  fileFilter: fileFilter
});

// Definir los campos de archivo esperados
const uploadFields = upload.fields([
  { name: 'imagenLateral', maxCount: 1 },
  { name: 'imagenAncho', maxCount: 1 },
  { name: 'imagenTop', maxCount: 1 },
  { name: 'itt', maxCount: 1 },
  { name: 'zocalo', maxCount: 1 }
]);

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para subir imágenes
app.post('/upload', async (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: 'Error al subir archivo: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    // Verificar si se subieron archivos
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se subieron archivos'
      });
    }

    // Verificar que Google Drive esté configurado
    if (!driveClient) {
      return res.status(500).json({
        success: false,
        error: 'Google Drive no está configurado'
      });
    }

    // Obtener información de los archivos subidos y subirlos a Google Drive
    const uploadedFiles = {};
    const driveUploadPromises = [];

    for (const fieldName in req.files) {
      if (req.files[fieldName] && req.files[fieldName][0]) {
        const file = req.files[fieldName][0];
        uploadedFiles[fieldName] = {
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };

        // Subir el archivo a Google Drive
        const drivePromise = uploadBufferToDrive(
          imagenes,
          file.originalname,
          file.buffer,
          file.mimetype
        ).then(driveFile => {
          uploadedFiles[fieldName].driveId = driveFile.id;
          uploadedFiles[fieldName].driveLink = driveFile.webViewLink;
          uploadedFiles[fieldName].driveContentLink = driveFile.webContentLink;
        }).catch(err => {
          console.error(`Error al subir ${file.originalname} a Drive:`, err.message);
          uploadedFiles[fieldName].driveError = err.message;
        });
        driveUploadPromises.push(drivePromise);
      }
    }

    // Esperar a que todos los archivos se suban a Drive
    await Promise.all(driveUploadPromises);

    // Obtener el tipo de dispositivo del body
    const deviceType = req.body.deviceType || 'desktop';
    
    // Obtener el tipo de visualización (solo para desktop)
    const visualizationType = req.body.visualizationType || null;

    // Obtener rangos de fechas del body
    const dateRange1 = req.body.dateRange1 ? JSON.parse(req.body.dateRange1) : null;
    const dateRange2 = req.body.dateRange2 ? JSON.parse(req.body.dateRange2) : null;

    // Procesar rangos de fechas y crear/actualizar archivos JSON
    const jsonResults = [];
    
    if (dateRange1 && dateRange1.start && dateRange1.end) {
      const dates1 = generateDateRange(dateRange1.start, dateRange1.end);
      for (const date of dates1) {
        try {
          const jsonFileName = `${date}.json`;
          const existingFile = await findJsonFileByName(jsones, jsonFileName);
          
          let jsonData = [];
          
          // Si el archivo existe, obtener su contenido
          if (existingFile) {
            const existingContent = await getJsonFileContent(existingFile.id);
            jsonData = Array.isArray(existingContent) ? existingContent : [];
          }
          
          // Crear objeto con la información de las imágenes
          const imageData = {
            imagenLateral: uploadedFiles.imagenLateral ? `/image/${uploadedFiles.imagenLateral.driveId}` : null,
            imagenAncho: uploadedFiles.imagenAncho ? `/image/${uploadedFiles.imagenAncho.driveId}` : null,
            imagenTop: uploadedFiles.imagenTop ? `/image/${uploadedFiles.imagenTop.driveId}` : null,
            itt: uploadedFiles.itt ? `/image/${uploadedFiles.itt.driveId}` : null,
            zocalo: uploadedFiles.zocalo ? `/image/${uploadedFiles.zocalo.driveId}` : null,
            deviceType: deviceType,
            uploadedAt: new Date().toISOString()
          };
          
          // Agregar tipo_visualización solo si es desktop y está definido
          if (deviceType === 'desktop' && visualizationType) {
            imageData.tipo_visualizacion = visualizationType;
          }
          
          // Agregar al array
          jsonData.push(imageData);
          
          // Crear o actualizar el archivo JSON
          const result = await createOrUpdateJsonFile(jsones, jsonFileName, jsonData);
          jsonResults.push({ date, fileId: result.id, action: existingFile ? 'updated' : 'created' });
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
          jsonResults.push({ date, error: error.message });
        }
      }
    }

    if (dateRange2 && dateRange2.start && dateRange2.end) {
      const dates2 = generateDateRange(dateRange2.start, dateRange2.end);
      for (const date of dates2) {
        try {
          const jsonFileName = `${date}.json`;
          const existingFile = await findJsonFileByName(jsones, jsonFileName);
          
          let jsonData = [];
          
          // Si el archivo existe, obtener su contenido
          if (existingFile) {
            const existingContent = await getJsonFileContent(existingFile.id);
            jsonData = Array.isArray(existingContent) ? existingContent : [];
          }
          
          // Crear objeto con la información de las imágenes
          const imageData = {
            imagenLateral: uploadedFiles.imagenLateral ? `/image/${uploadedFiles.imagenLateral.driveId}` : null,
            imagenAncho: uploadedFiles.imagenAncho ? `/image/${uploadedFiles.imagenAncho.driveId}` : null,
            imagenTop: uploadedFiles.imagenTop ? `/image/${uploadedFiles.imagenTop.driveId}` : null,
            itt: uploadedFiles.itt ? `/image/${uploadedFiles.itt.driveId}` : null,
            zocalo: uploadedFiles.zocalo ? `/image/${uploadedFiles.zocalo.driveId}` : null,
            deviceType: deviceType,
            uploadedAt: new Date().toISOString()
          };
          
          // Agregar tipo_visualización solo si es desktop y está definido
          if (deviceType === 'desktop' && visualizationType) {
            imageData.tipo_visualizacion = visualizationType;
          }
          
          // Agregar al array
          jsonData.push(imageData);
          
          // Crear o actualizar el archivo JSON
          const result = await createOrUpdateJsonFile(jsones, jsonFileName, jsonData);
          jsonResults.push({ date, fileId: result.id, action: existingFile ? 'updated' : 'created' });
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
          jsonResults.push({ date, error: error.message });
        }
      }
    }

    res.json({
      success: true,
      message: 'Imágenes subidas a Google Drive correctamente',
      deviceType: deviceType,
      files: uploadedFiles,
      jsonFiles: jsonResults,
      uploadedAt: new Date().toISOString()
    });
  });
});

// Endpoint para listar archivos de Google Drive
app.get('/uploads', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  try {
    const response = await driveClient.files.list({
      q: `'${imagenes}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: 'files(id, name, size, createdTime, webViewLink, webContentLink, thumbnailLink, mimeType)',
      orderBy: 'createdTime desc',
      pageSize: 100
    });

    res.json({
      success: true,
      files: response.data.files
    });
  } catch (error) {
    console.error('Error al listar archivos de Drive:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener archivos de Google Drive'
    });
  }
});

// Endpoint para listar archivos JSON
app.get('/json-files', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  try {
    const response = await driveClient.files.list({
      q: `'${jsones}' in parents and trashed=false and mimeType='application/json'`,
      fields: 'files(id, name, size, createdTime, modifiedTime, webViewLink, webContentLink)',
      orderBy: 'name asc',
      pageSize: 100
    });

    res.json({
      success: true,
      files: response.data.files
    });
  } catch (error) {
    console.error('Error al listar archivos JSON:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener archivos JSON de Google Drive'
    });
  }
});

// Endpoint para obtener contenido de un archivo JSON específico
app.get('/json-file/:fileId', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  const fileId = req.params.fileId;

  try {
    const content = await getJsonFileContent(fileId);
    res.json({
      success: true,
      content: content
    });
  } catch (error) {
    console.error('Error al obtener archivo JSON:', error.message);
    res.status(404).json({
      success: false,
      error: 'Archivo JSON no encontrado'
    });
  }
});

// Endpoint para servir imágenes de Google Drive (proxy)
app.get('/image/:fileId', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  const fileId = req.params.fileId;

  try {
    const response = await driveClient.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Establecer headers apropiados
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas

    // Pipe el stream de Drive a la respuesta
    response.data.pipe(res);
  } catch (error) {
    console.error(`Error al obtener imagen de Drive (${fileId}):`, error.message);
    // Enviar una imagen transparente 1x1 en caso de error
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(transparentPixel);
  }
});

// Endpoint para generar screenshot de Los Andes
app.post('/generate-screenshot', async (req, res) => {
  try {
    console.log('🚀 Generando screenshots de Los Andes...');
    
    // Obtener tipo de dispositivo del body (por defecto: desktop)
    const deviceType = req.body.deviceType || 'desktop';
    console.log(`📱 Tipo de dispositivo solicitado: ${deviceType}`);
    
    // Si es desktop, obtener los JSONs del día actual y generar múltiples screenshots
    if (deviceType === 'desktop') {
      // Obtener fecha actual en formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const jsonFileName = `${today}.json`;
      
      console.log(`📅 Buscando JSONs para la fecha: ${today}`);
      
      // Buscar el archivo JSON del día actual
      const existingFile = await findJsonFileByName(jsones, jsonFileName);
      
      if (!existingFile) {
        console.log('⚠️ No se encontraron JSONs para el día actual, generando screenshot simple...');
        const result = await scrapeLosAndes(deviceType, capturas);
        return res.json({
          success: true,
          message: 'Screenshot generado exitosamente (sin JSONs del día)',
          data: [result]
        });
      }
      
      // Obtener contenido del JSON
      const jsonContent = await getJsonFileContent(existingFile.id);
      const jsonData = Array.isArray(jsonContent) ? jsonContent : [];
      
      // Filtrar solo los registros de desktop
      const desktopRecords = jsonData.filter(record => record.deviceType === 'desktop');
      
      if (desktopRecords.length === 0) {
        console.log('⚠️ No se encontraron registros desktop, generando screenshot simple...');
        const result = await scrapeLosAndes(deviceType, capturas);
        return res.json({
          success: true,
          message: 'Screenshot generado exitosamente (sin registros desktop)',
          data: [result]
        });
      }
      
      console.log(`📊 Se encontraron ${desktopRecords.length} registros desktop para procesar`);
      
      // Generar un screenshot por cada registro con tipo_visualizacion
      const results = [];
      for (let i = 0; i < desktopRecords.length; i++) {
        const record = desktopRecords[i];
        const visualizationType = record.tipo_visualizacion || 'A';
        
        console.log(`\n🎬 Generando screenshot ${i + 1}/${desktopRecords.length} - Tipo: ${visualizationType}`);
        
        try {
          // Preparar datos del JSON con URLs completas de Drive
          const jsonDataForScraper = {
            imagenLateral: record.imagenLateral ? `${req.protocol}://${req.get('host')}${record.imagenLateral}` : null,
            imagenAncho: record.imagenAncho ? `${req.protocol}://${req.get('host')}${record.imagenAncho}` : null,
            imagenTop: record.imagenTop ? `${req.protocol}://${req.get('host')}${record.imagenTop}` : null,
            itt: record.itt ? `${req.protocol}://${req.get('host')}${record.itt}` : null,
            zocalo: record.zocalo ? `${req.protocol}://${req.get('host')}${record.zocalo}` : null
          };
          
          console.log('📄 URLs de imágenes preparadas:', jsonDataForScraper);
          
          const result = await scrapeLosAndes(deviceType, capturas, visualizationType, jsonDataForScraper);
          results.push({
            ...result,
            visualizationType: visualizationType,
            recordIndex: i
          });
        } catch (error) {
          console.error(`❌ Error en screenshot ${i + 1}:`, error.message);
          results.push({
            success: false,
            error: error.message,
            visualizationType: visualizationType,
            recordIndex: i
          });
        }
      }
      
      res.json({
        success: true,
        message: `${results.length} screenshots generados exitosamente`,
        data: results
      });
      
    } else {
      // Para mobile, generar un solo screenshot
      console.log('📱 Generando screenshot mobile...');
      const result = await scrapeLosAndes(deviceType, capturas);
      
      res.json({
        success: true,
        message: 'Screenshot generado exitosamente',
        data: [result]
      });
    }
  } catch (error) {
    console.error('❌ Error generando screenshot:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al generar el screenshot',
      details: error.message
    });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`☁️  Almacenamiento: Google Drive (Carpeta ID: ${imagenes})`);
});
