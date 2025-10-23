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

// Middleware para manejar ngrok y headers
app.use((req, res, next) => {
  // Permitir acceso desde ngrok
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use(express.static('public'));
// Servir carpeta screenshots para las imágenes de preview en el HTML
app.use('/screenshots', express.static('screenshots'));

// ============================================================
// CONFIGURACIÓN DE MULTER - ALMACENAMIENTO EN MEMORIA
// ============================================================
// IMPORTANTE: Los archivos NO se guardan en disco local.
// Se almacenan temporalmente en memoria (RAM) y se suben
// directamente a Google Drive. Después se liberan de memoria.
// ============================================================

const storage = multer.memoryStorage(); // Almacenamiento en memoria (NO en disco)

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

// Configurar multer con almacenamiento en memoria
const upload = multer({
  storage: storage, // memoryStorage: NO guarda archivos localmente
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo por archivo
  },
  fileFilter: fileFilter
});

// NOTA: Si existe una carpeta 'uploads/' con archivos, son de ejecuciones
// anteriores y pueden ser eliminados manualmente. El código actual NO
// guarda archivos en esa carpeta.

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

    // Obtener información de la carpeta seleccionada
    const selectedFolderId = req.body.selectedFolderId || null;
    const selectedFolderName = req.body.selectedFolderName || null;

    // Obtener rangos de fechas del body
    const dateRange1 = req.body.dateRange1 ? JSON.parse(req.body.dateRange1) : null;
    const dateRange2 = req.body.dateRange2 ? JSON.parse(req.body.dateRange2) : null;
    const firstLastOnly = req.body.firstLastOnly === 'true';

    // Procesar rangos de fechas y crear/actualizar archivos JSON
    const jsonResults = [];
    
    if (dateRange1 && dateRange1.start && dateRange1.end) {
      let dates1;
      
      if (firstLastOnly) {
        // Solo el primer y último día del rango
        dates1 = [dateRange1.start, dateRange1.end];
      } else {
        // Todos los días en el rango
        dates1 = generateDateRange(dateRange1.start, dateRange1.end);
      }
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
            uploadedAt: new Date(date + 'T00:00:00').toISOString() // Usar fecha de la campaña
          };
          
          // Agregar tipo_visualización si está definido (desktop: A,B,C,D / mobile: A,B,C)
          if (visualizationType) {
            imageData.tipo_visualizacion = visualizationType;
          }
          
          // Agregar información de la carpeta seleccionada
          if (selectedFolderId && selectedFolderName) {
            imageData.carpeta_id = selectedFolderId;
            imageData.carpeta_nombre = selectedFolderName;
          }
          
          // Generar campo campaña: nombreCarpeta-deviceType-variacion
          let campana = '';
          if (selectedFolderName) {
            campana = selectedFolderName;
          } else {
            campana = 'sin-carpeta';
          }
          campana += `-${deviceType}`;
          if (visualizationType) {
            campana += `-${visualizationType}`;
          }
          imageData.campana = campana;
          
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
            uploadedAt: new Date(date + 'T00:00:00').toISOString() // Usar fecha de la campaña
          };
          
          // Agregar tipo_visualización si está definido (desktop: A,B,C,D / mobile: A,B,C)
          if (visualizationType) {
            imageData.tipo_visualizacion = visualizationType;
          }
          
          // Agregar información de la carpeta seleccionada
          if (selectedFolderId && selectedFolderName) {
            imageData.carpeta_id = selectedFolderId;
            imageData.carpeta_nombre = selectedFolderName;
          }
          
          // Generar campo campaña: nombreCarpeta-deviceType-variacion
          let campana = '';
          if (selectedFolderName) {
            campana = selectedFolderName;
          } else {
            campana = 'sin-carpeta';
          }
          campana += `-${deviceType}`;
          if (visualizationType) {
            campana += `-${visualizationType}`;
          }
          imageData.campana = campana;
          
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

    // Responder con éxito
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

// Endpoint para listar carpetas de Google Drive
app.get('/folders', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  try {
    const parentId = req.query.parentId || '1itJ-0q38UJ1hQTbck-qL7du9f-qnLm4z'; // Carpeta raíz por defecto
    
    const response = await driveClient.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'name asc',
      pageSize: 100
    });

    // Filtrar carpetas excluidas (imagenes, jsones, screenshots)
    const excludedFolders = ['imagenes', 'jsones', 'screenshots', 'webs_pasado','config'];
    const filteredFolders = response.data.files.filter(folder => 
      !excludedFolders.includes(folder.name.toLowerCase())
    );

    res.json({
      success: true,
      folders: filteredFolders,
      parentId: parentId
    });
  } catch (error) {
    console.error('Error al listar carpetas de Drive:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener carpetas de Google Drive'
    });
  }
});

// Endpoint para obtener información de una carpeta específica
app.get('/folder-info/:folderId', async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: 'Google Drive no está configurado'
    });
  }

  try {
    const folderId = req.params.folderId;
    
    const response = await driveClient.files.get({
      fileId: folderId,
      fields: 'id, name, parents'
    });

    res.json({
      success: true,
      folder: response.data
    });
  } catch (error) {
    console.error('Error al obtener información de carpeta:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información de carpeta'
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

    // Establecer headers apropiados para ngrok y CORS
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache por 24 horas
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('ngrok-skip-browser-warning', 'true');

    // Pipe el stream de Drive a la respuesta
    response.data.pipe(res);
  } catch (error) {
    console.error(`Error al obtener imagen de Drive (${fileId}):`, error.message);
    // Enviar una imagen transparente 1x1 en caso de error
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(transparentPixel);
  }
});

// Función para capturar y guardar HTML de Los Andes
async function captureAndSaveHTML() {
  const puppeteer = require('puppeteer');
  const htmlFolderId = '1oxJv2q0M8vwvbmVErg95BjNO2fu2dKN9';
  const url = 'https://www.losandes.com.ar/';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Configuraciones para desktop y mobile
  const configs = [
    {
      name: 'desktop',
      fileName: `${today}_desktop.html`,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    {
      name: 'mobile',
      fileName: `${today}_mobile.html`,
      viewport: { width: 400, height: 824 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      isMobile: true
    }
  ];
  
  for (const config of configs) {
    console.log(`📱 Capturando HTML ${config.name}...`);
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      
      // Configurar viewport con opciones mobile si aplica
      if (config.isMobile) {
        await page.setViewport({
          width: config.viewport.width,
          height: config.viewport.height,
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          isLandscape: false
        });
      } else {
        await page.setViewport(config.viewport);
      }
      
      // Configurar user agent
      await page.setUserAgent(config.userAgent);
      
      // Navegar a la página
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Obtener el HTML completo
      const html = await page.content();
      
      // Convertir HTML a buffer
      const htmlBuffer = Buffer.from(html, 'utf-8');
      
      // Subir a Google Drive
      const fileMetadata = {
        name: config.fileName,
        parents: [htmlFolderId],
        mimeType: 'text/html'
      };
      
      const media = {
        mimeType: 'text/html',
        body: require('stream').Readable.from(htmlBuffer)
      };
      
      // Buscar si ya existe un archivo con ese nombre
      const existingFiles = await driveClient.files.list({
        q: `name='${config.fileName}' and '${htmlFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      if (existingFiles.data.files.length > 0) {
        // Actualizar archivo existente
        const fileId = existingFiles.data.files[0].id;
        await driveClient.files.update({
          fileId: fileId,
          media: media
        });
        console.log(`✅ HTML ${config.name} actualizado: ${config.fileName}`);
      } else {
        // Crear nuevo archivo
        await driveClient.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink'
        });
        console.log(`✅ HTML ${config.name} creado: ${config.fileName}`);
      }
      
    } catch (error) {
      console.error(`❌ Error capturando HTML ${config.name}:`, error.message);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

// Endpoint para generar screenshot de Los Andes
app.post('/generate-screenshot', async (req, res) => {
  try {
    console.log('🚀 Generando screenshots de Los Andes...');
    
    const targetDates = req.body.targetDates || []; // Array de fechas a procesar
    
    // Si no se especificaron fechas, usar el día actual
    const datesToProcess = targetDates.length > 0 
      ? targetDates 
      : [new Date().toISOString().split('T')[0]];
    
    console.log(`📅 Fechas a procesar: ${datesToProcess.join(', ')}`);
    console.log(`📱 Generando screenshots para DESKTOP y MOBILE`);
    
    const allResults = {
      desktop: [],
      mobile: []
    };
    
    // ============================================================
    // PROCESAR DESKTOP
    // ============================================================
    console.log('\n🖥️ ===== PROCESANDO DESKTOP =====');
    
    for (const dateToProcess of datesToProcess) {
      console.log(`\n📆 Procesando fecha DESKTOP: ${dateToProcess}`);
      
      const jsonFileName = `${dateToProcess}.json`;
      const existingFile = await findJsonFileByName(jsones, jsonFileName);
      
      if (!existingFile) {
        console.log(`⚠️ No se encontró JSON para ${dateToProcess}, saltando...`);
        continue;
      }
      
      const jsonContent = await getJsonFileContent(existingFile.id);
      const jsonData = Array.isArray(jsonContent) ? jsonContent : [];
      const desktopRecords = jsonData.filter(record => record.deviceType === 'desktop');
      
      if (desktopRecords.length === 0) {
        console.log(`⚠️ No se encontraron registros desktop para ${dateToProcess}, saltando...`);
        continue;
      }
      
      console.log(`📊 Se encontraron ${desktopRecords.length} registros desktop para ${dateToProcess}`);
      
      for (let i = 0; i < desktopRecords.length; i++) {
        const record = desktopRecords[i];
        const visualizationType = record.tipo_visualizacion || 'A';
        const targetFolderId = record.carpeta_id || capturas;
        const targetFolderName = record.carpeta_nombre || 'capturas (default)';
        
        console.log(`\n🎬 Generando screenshot DESKTOP ${i + 1}/${desktopRecords.length} - Tipo: ${visualizationType}`);
        console.log(`📁 Carpeta destino: ${targetFolderName} (ID: ${targetFolderId})`);
        
        try {
          const forwardedHost = req.get('x-forwarded-host');
          const forwardedProto = req.get('x-forwarded-proto');
          const host = forwardedHost || req.get('host');
          const protocol = forwardedProto || req.protocol;
          const baseUrl = `${protocol}://${host}`;
          
          const jsonDataForScraper = {
            imagenLateral: record.imagenLateral ? `${baseUrl}${record.imagenLateral}` : null,
            imagenAncho: record.imagenAncho ? `${baseUrl}${record.imagenAncho}` : null,
            imagenTop: record.imagenTop ? `${baseUrl}${record.imagenTop}` : null,
            itt: record.itt ? `${baseUrl}${record.itt}` : null,
            zocalo: record.zocalo ? `${baseUrl}${record.zocalo}` : null
          };
          
          const currentDate = new Date().toISOString().split('T')[0];
          const targetDate = (dateToProcess < currentDate) ? dateToProcess : null;
          
          const result = await scrapeLosAndes('desktop', targetFolderId, visualizationType, jsonDataForScraper, targetDate);
          allResults.desktop.push({
            ...result,
            visualizationType,
            recordIndex: i,
            date: dateToProcess,
            deviceType: 'desktop'
          });
        } catch (error) {
          console.error(`❌ Error en screenshot DESKTOP ${i + 1}:`, error.message);
          allResults.desktop.push({
            success: false,
            error: error.message,
            visualizationType,
            recordIndex: i,
            date: dateToProcess,
            deviceType: 'desktop'
          });
        }
      }
    }
    
    // ============================================================
    // PROCESAR MOBILE
    // ============================================================
    console.log('\n📱 ===== PROCESANDO MOBILE =====');
    
    for (const dateToProcess of datesToProcess) {
      console.log(`\n📆 Procesando fecha MOBILE: ${dateToProcess}`);
      
      const jsonFileName = `${dateToProcess}.json`;
      const existingFile = await findJsonFileByName(jsones, jsonFileName);
      
      if (!existingFile) {
        console.log(`⚠️ No se encontró JSON para ${dateToProcess}, saltando...`);
        continue;
      }
      
      const jsonContent = await getJsonFileContent(existingFile.id);
      const jsonData = Array.isArray(jsonContent) ? jsonContent : [];
      const mobileRecords = jsonData.filter(record => record.deviceType === 'mobile');
      
      if (mobileRecords.length === 0) {
        console.log(`⚠️ No se encontraron registros mobile para ${dateToProcess}, saltando...`);
        continue;
      }
      
      console.log(`📊 Se encontraron ${mobileRecords.length} registros mobile para ${dateToProcess}`);
      
      for (let i = 0; i < mobileRecords.length; i++) {
        const record = mobileRecords[i];
        const targetFolderId = record.carpeta_id || capturas;
        const targetFolderName = record.carpeta_nombre || 'capturas (default)';
        
        console.log(`\n🎬 Generando screenshot MOBILE ${i + 1}/${mobileRecords.length}`);
        console.log(`📁 Carpeta destino: ${targetFolderName} (ID: ${targetFolderId})`);
        
        try {
          const forwardedHost = req.get('x-forwarded-host');
          const forwardedProto = req.get('x-forwarded-proto');
          const host = forwardedHost || req.get('host');
          const protocol = forwardedProto || req.protocol;
          const baseUrl = `${protocol}://${host}`;
          
          const jsonDataForScraper = {
            imagenLateral: record.imagenLateral ? `${baseUrl}${record.imagenLateral}` : null,
            imagenAncho: record.imagenAncho ? `${baseUrl}${record.imagenAncho}` : null,
            imagenTop: record.imagenTop ? `${baseUrl}${record.imagenTop}` : null,
            itt: null,
            zocalo: record.zocalo ? `${baseUrl}${record.zocalo}` : null
          };
          
          const currentDate = new Date().toISOString().split('T')[0];
          const targetDate = (dateToProcess < currentDate) ? dateToProcess : null;
          
          // Obtener tipo de visualización del record (A, B, C para mobile)
          const visualizationType = record.tipo_visualizacion || null;
          
          const result = await scrapeLosAndes('mobile', targetFolderId, visualizationType, jsonDataForScraper, targetDate);
          allResults.mobile.push({
            ...result,
            recordIndex: i,
            date: dateToProcess,
            deviceType: 'mobile'
          });
        } catch (error) {
          console.error(`❌ Error en screenshot MOBILE ${i + 1}:`, error.message);
          allResults.mobile.push({
            success: false,
            error: error.message,
            recordIndex: i,
            date: dateToProcess,
            deviceType: 'mobile'
          });
        }
      }
    }
    
    // ============================================================
    // CAPTURAR HTML (solo si hay fecha actual)
    // ============================================================
    const currentDate = new Date().toISOString().split('T')[0];
    const hasCurrentDate = datesToProcess.includes(currentDate);
    
    if (hasCurrentDate) {
      console.log('\n📄 Capturando HTML de Los Andes (fecha actual detectada)...');
      try {
        await captureAndSaveHTML();
        console.log('✅ HTML capturado y guardado exitosamente');
      } catch (htmlError) {
        console.error('⚠️ Error al capturar HTML:', htmlError.message);
      }
    } else {
      console.log('\n⏭️ Saltando captura de HTML (solo fechas pasadas procesadas)');
    }
    
    // ============================================================
    // RESPUESTA FINAL
    // ============================================================
    const totalScreenshots = allResults.desktop.length + allResults.mobile.length;
    
    res.json({
      success: true,
      message: `${totalScreenshots} screenshots generados exitosamente (${allResults.desktop.length} desktop, ${allResults.mobile.length} mobile) para ${datesToProcess.length} fecha(s)`,
      data: allResults
    });
    
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
