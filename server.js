const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const { scrapeLosAndes } = require("./scraper-losandes");
const { getArgentinaDateString, getArgentinaISOString } = require("./date-utils");
const { navigateWithStrategies } = require("./navigation-strategies");
const storageAdapter = require("./storage-adapter");
const { insertManyCampaigns, getCampaignsByDate } = require("./mongo-campaigns");

// Manejo global de errores para evitar que el proceso se caiga por excepciones no controladas
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection en Promise:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception no manejada:", error);
});

const HTML_CAPTURE_USER_AGENTS = {
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  mobile:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
};

const app = express();
const PORT = process.env.PORT || 3000;

// Carpetas de almacenamiento local (solo para archivos binarios)
const imagenes = "imagenes_cargadas";
const capturas = "capturas";

// Inicializar almacenamiento local
storageAdapter.initializeStorage()
  .then(() => {
    const info = storageAdapter.getStorageInfo();
    console.log("✅ Almacenamiento local inicializado");
    console.log(`📁 Carpeta base: ${info.basePath}`);
    console.log(`⚙️  Configuración: ${info.configPath}`);
  })
  .catch((err) => {
    console.error("❌ Error inicializando almacenamiento local:", err);
  });

/**
 * Sube un archivo al almacenamiento local
 * @param {string} folderId - ID de la carpeta de destino
 * @param {string} fileName - Nombre del archivo a crear
 * @param {Buffer} buffer - Buffer con el contenido del archivo
 * @param {string} mimeType - Tipo MIME del archivo (ej: 'image/png', 'application/json')
 * @returns {Promise<Object>} Objeto con datos del archivo subido (id, name, webViewLink, webContentLink)
 * @throws {Error} Si falla la subida
 */
async function uploadFile(folderId, fileName, buffer, mimeType) {
  try {
    const result = await storageAdapter.uploadFile(folderId, fileName, buffer, mimeType);
    console.log(`✅ File uploaded: ${fileName} (ID: ${result.id})`);
    return result;
  } catch (error) {
    console.error("❌ Error uploading file:", error.message);
    throw error;
  }
}

/**
 * Genera un array de fechas entre dos fechas (inclusive) en formato YYYY-MM-DD.
 * IMPORTANTE: No depende de la zona horaria del servidor; opera en UTC
 * para evitar desfasajes de un día.
 * @param {string} startDate - Fecha inicial en formato YYYY-MM-DD
 * @param {string} endDate - Fecha final en formato YYYY-MM-DD
 * @returns {string[]} Array de fechas en formato YYYY-MM-DD
 * @example
 * generateDateArray('2025-10-20', '2025-10-22')
 * // Returns: ['2025-10-20', '2025-10-21', '2025-10-22']
 */
function generateDateArray(startDate, endDate) {
  const dates = [];

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  // Construir fechas en UTC para que el .toISOString() mantenga el mismo día
  let current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    // Sumar 1 día en UTC
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Verifica si una fecha es futura (en hora de Argentina)
 * @param {string} dateString - Fecha en formato YYYY-MM-DD
 * @returns {boolean} true si la fecha es futura, false si no
 */
function isFutureDate(dateString) {
  const todayArgentina = getArgentinaDateString();
  return dateString > todayArgentina;
}

// Toda la lógica de campañas pasa a MongoDB (mongo-campaigns.js).

// Middleware
app.use(cors());
app.use(express.json());

// Middleware para manejar ngrok y headers
app.use((req, res, next) => {
  // Permitir acceso desde ngrok
  res.setHeader("ngrok-skip-browser-warning", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(express.static("public"));
// Servir carpeta screenshots para las imágenes de preview en el HTML
app.use("/screenshots", express.static("screenshots"));

// ============================================================
// CONFIGURACIÓN DE MULTER - ALMACENAMIENTO EN MEMORIA
// ============================================================
// IMPORTANTE: Los archivos NO se guardan en disco local.
// Se almacenan temporalmente en memoria (RAM) y se suben
// al almacenamiento local. Después se liberan de memoria.
// ============================================================

const storage = multer.memoryStorage(); // Almacenamiento en memoria (NO en disco)

// Filtro para validar tipos de archivo
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        "Solo se permiten archivos de imagen (JPEG, JPG, PNG, GIF, WebP)"
      )
    );
  }
};

// Configurar multer con almacenamiento en memoria
const upload = multer({
  storage: storage, // memoryStorage: NO guarda archivos localmente
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo por archivo
  },
  fileFilter: fileFilter,
});

// NOTA: Si existe una carpeta 'uploads/' con archivos, son de ejecuciones
// anteriores y pueden ser eliminados manualmente. El código actual NO
// guarda archivos en esa carpeta.

// Definir los campos de archivo esperados
const uploadFields = upload.fields([
  { name: "imagenLateral", maxCount: 1 },
  { name: "imagenAncho", maxCount: 1 },
  { name: "imagenTop", maxCount: 1 },
  { name: "itt", maxCount: 1 },
  { name: "zocalo", maxCount: 1 },
]);

// Health check endpoint (para Docker y monitoreo)
app.get("/health", (req, res) => {
  const argentinaDate = getArgentinaDateString();
  console.log(`📅 Fecha actual (Argentina): ${argentinaDate}`);
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    argentinaDate: argentinaDate,
    uptime: process.uptime(),
    storage: "local",
  });
});

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint para subir imágenes
app.post("/upload", async (req, res) => {
  uploadFields(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: "Error al subir archivo: " + err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    // Verificar si se subieron archivos
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No se subieron archivos",
      });
    }

    // Obtener información de los archivos subidos y subirlos al almacenamiento local
    const uploadedFiles = {};
    const uploadPromises = [];

    for (const fieldName in req.files) {
      if (req.files[fieldName] && req.files[fieldName][0]) {
        const file = req.files[fieldName][0];
        uploadedFiles[fieldName] = {
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        };

        // Subir el archivo al almacenamiento local
        const uploadPromise = uploadFile(
          imagenes,
          file.originalname,
          file.buffer,
          file.mimetype
        )
          .then((uploadedFile) => {
            uploadedFiles[fieldName].fileId = uploadedFile.id;
            uploadedFiles[fieldName].fileLink = uploadedFile.webViewLink;
            uploadedFiles[fieldName].fileContentLink =
              uploadedFile.webContentLink;
          })
          .catch((err) => {
            console.error(
              `Error al subir ${file.originalname}:`,
              err.message
            );
            uploadedFiles[fieldName].uploadError = err.message;
          });
        uploadPromises.push(uploadPromise);
      }
    }

    // Esperar a que todos los archivos se suban
    await Promise.all(uploadPromises);

    // Obtener el tipo de dispositivo del body
    const deviceType = req.body.deviceType || "desktop";

    // Obtener el tipo de visualización (solo para desktop)
    const visualizationType = req.body.visualizationType || null;

    // Obtener información de la carpeta seleccionada
    const selectedFolderId = req.body.selectedFolderId || null;
    const selectedFolderName = req.body.selectedFolderName || null;

    // Obtener rangos de fechas del body
    const dateRange1 = req.body.dateRange1
      ? JSON.parse(req.body.dateRange1)
      : null;
    const dateRange2 = req.body.dateRange2
      ? JSON.parse(req.body.dateRange2)
      : null;
    const firstLastOnly = req.body.firstLastOnly === "true";

    // Procesar rangos de fechas y guardar campañas en MongoDB
    const campaignsToInsert = [];

    if (dateRange1 && dateRange1.start && dateRange1.end) {
      let dates1;

      if (firstLastOnly) {
        // Solo el primer y último día del rango
        dates1 = [dateRange1.start, dateRange1.end];
      } else {
        // Todos los días en el rango
        dates1 = generateDateArray(dateRange1.start, dateRange1.end);
      }
      for (const date of dates1) {
        try {
          // Crear objeto con la información de las imágenes/campaña
          const imageData = {
            imagenLateral: uploadedFiles.imagenLateral
              ? `/image/${uploadedFiles.imagenLateral.fileId}`
              : null,
            imagenAncho: uploadedFiles.imagenAncho
              ? `/image/${uploadedFiles.imagenAncho.fileId}`
              : null,
            imagenTop: uploadedFiles.imagenTop
              ? `/image/${uploadedFiles.imagenTop.fileId}`
              : null,
            itt: uploadedFiles.itt
              ? `/image/${uploadedFiles.itt.fileId}`
              : null,
            zocalo: uploadedFiles.zocalo
              ? `/image/${uploadedFiles.zocalo.fileId}`
              : null,
            deviceType: deviceType,
            campaignDate: date, // Fecha de la campaña (día seleccionado, YYYY-MM-DD)
            uploadedAt: new Date().toISOString(), // Timestamp real de cuando se subió
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
          let campana = "";
          if (selectedFolderName) {
            campana = selectedFolderName;
          } else {
            campana = "sin-carpeta";
          }
          campana += `-${deviceType}`;
          if (visualizationType) {
            campana += `-${visualizationType}`;
          }
          imageData.campana = campana;

          // Agregar al array de campañas a insertar en MongoDB
          campaignsToInsert.push(imageData);
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
        }
      }
    }

    if (dateRange2 && dateRange2.start && dateRange2.end) {
      const dates2 = generateDateArray(dateRange2.start, dateRange2.end);
      for (const date of dates2) {
        try {
          // Crear objeto con la información de las imágenes/campaña
          const imageData = {
            imagenLateral: uploadedFiles.imagenLateral
              ? `/image/${uploadedFiles.imagenLateral.fileId}`
              : null,
            imagenAncho: uploadedFiles.imagenAncho
              ? `/image/${uploadedFiles.imagenAncho.fileId}`
              : null,
            imagenTop: uploadedFiles.imagenTop
              ? `/image/${uploadedFiles.imagenTop.fileId}`
              : null,
            itt: uploadedFiles.itt
              ? `/image/${uploadedFiles.itt.fileId}`
              : null,
            zocalo: uploadedFiles.zocalo
              ? `/image/${uploadedFiles.zocalo.fileId}`
              : null,
            deviceType: deviceType,
            campaignDate: date, // Fecha de la campaña (día seleccionado, YYYY-MM-DD)
            uploadedAt: new Date().toISOString(), // Timestamp real de cuando se subió
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
          let campana = "";
          if (selectedFolderName) {
            campana = selectedFolderName;
          } else {
            campana = "sin-carpeta";
          }
          campana += `-${deviceType}`;
          if (visualizationType) {
            campana += `-${visualizationType}`;
          }
          imageData.campana = campana;

          // Agregar al array de campañas a insertar en MongoDB
          campaignsToInsert.push(imageData);
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
        }
      }
    }

    // Guardar todas las campañas en MongoDB
    if (campaignsToInsert.length > 0) {
      console.log(`💾 Guardando ${campaignsToInsert.length} campañas en MongoDB...`);
      await insertManyCampaigns(campaignsToInsert);
      console.log("✅ Campañas guardadas en MongoDB");
    } else {
      console.log("ℹ️ No se generaron campañas para guardar en MongoDB");
    }

    // Responder con éxito
    res.json({
      success: true,
      message: "Imágenes subidas correctamente",
      deviceType: deviceType,
      files: uploadedFiles,
      campaignsInserted: campaignsToInsert.length,
      uploadedAt: new Date().toISOString(),
    });
  });
});

// Endpoint para listar carpetas
app.get("/folders", async (req, res) => {
  try {
    const parentId = req.query.parentId || "root"; // Carpeta raíz por defecto

    const result = await storageAdapter.listFolders(parentId);

    console.log(`📊 Carpetas encontradas antes de filtrar: ${result.folders.length}`);
    result.folders.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));

    // Filtrar carpetas excluidas (imagenes, jsones, screenshots)
    const excludedFolders = [
      "imagenes",
      "jsones",
      "screenshots",
      "webs_pasado",
      "config",
      "imagenes_cargadas",
      "html",
      "capturas",
      "config_local"
    ];
    const filteredFolders = result.folders.filter(
      (folder) => !excludedFolders.includes(folder.name.toLowerCase())
    );

    console.log(`📊 Carpetas después de filtrar: ${filteredFolders.length}`);
    filteredFolders.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));

    res.json({
      success: true,
      folders: filteredFolders,
      parentId: parentId,
    });
  } catch (error) {
    console.error("Error al listar carpetas:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener carpetas",
    });
  }
});

// ============================================================
// NUEVO ENDPOINT /campaigns - API moderna basada en MongoDB
// Obtiene campañas por fecha o rango de fechas
// ============================================================

app.get("/campaigns", async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: "Parámetros 'start' y 'end' son requeridos (YYYY-MM-DD)",
      });
    }

    const db = await require("./mongo").getDb();
    const collection = db.collection("campaigns");

    // Obtener todas las campañas en el rango [start, end]
    const campaigns = await collection
      .find({ campaignDate: { $gte: start, $lte: end } })
      .sort({ campaignDate: 1, uploadedAt: 1 })
      .toArray();

    // Agrupar por fecha
    const grouped = {};
    for (const c of campaigns) {
      if (!grouped[c.campaignDate]) {
        grouped[c.campaignDate] = [];
      }
      grouped[c.campaignDate].push(c);
    }

    // Convertir a array de fechas
    const dates = Object.keys(grouped).sort();
    const result = dates.map((date) => ({
      date,
      campaigns: grouped[date],
    }));

    res.json({
      success: true,
      dates: result,
    });
  } catch (error) {
    console.error("Error en /campaigns:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener campañas",
    });
  }
});

// Endpoint para obtener información de una carpeta específica
app.get("/folder-info/:folderId", async (req, res) => {
  try {
    const folderId = req.params.folderId;

    const folderInfo = await storageAdapter.getFolderInfo(folderId);

    res.json({
      success: true,
      folder: folderInfo,
    });
  } catch (error) {
    console.error("Error al obtener información de carpeta:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener información de carpeta",
    });
  }
});

// Endpoints legacy /json-files y /json-file eliminados: el frontend usa /campaigns

// Endpoint para servir imágenes
app.get("/image/:fileId", async (req, res) => {
  const fileId = req.params.fileId;
  console.log(`🖼️ Solicitud de imagen: ${fileId}`);

  try {
    // Leer archivo del almacenamiento local
    const fileData = await storageAdapter.readFile(fileId);
    console.log(`✅ Imagen encontrada: ${fileData.metadata.name} (${fileData.metadata.size} bytes)`);
    
    // Establecer headers apropiados
    res.setHeader(
      "Content-Type",
      fileData.metadata.mimeType || "image/png"
    );
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache por 24 horas
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("ngrok-skip-browser-warning", "true");
    
    // Enviar el buffer
    res.send(fileData.data);
  } catch (error) {
    console.error(
      `❌ Error al obtener imagen (${fileId}):`,
      error.message
    );
    console.error(`❌ Stack:`, error.stack);
    // Enviar una imagen transparente 1x1 en caso de error
    const transparentPixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(transparentPixel);
  }
});

// Endpoint para servir archivos locales
app.get("/local-files/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  try {
    const fileData = await storageAdapter.readFile(fileId);
    
    console.log(`📥 Sirviendo archivo local: ${fileData.metadata.name} (${fileData.metadata.size} bytes)`);
    
    // Establecer headers apropiados
    res.setHeader(
      "Content-Type",
      fileData.metadata.mimeType || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileData.metadata.name}"`
    );
    res.setHeader("Content-Length", fileData.metadata.size);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("ngrok-skip-browser-warning", "true");
    
    // Enviar el archivo
    res.send(fileData.data);
  } catch (error) {
    console.error(`❌ Error al obtener archivo local (${fileId}):`, error.message);
    console.error(`📍 Stack:`, error.stack);
    res.status(404).json({
      success: false,
      error: "Archivo no encontrado",
    });
  }
});


/**
 * Convierte URLs de imágenes locales a base64 para uso en Puppeteer
 * @param {Object} jsonData - Datos JSON con URLs de imágenes
 * @returns {Promise<Object>} Objeto con las mismas claves pero valores como data:image URLs base64
 */
async function convertImagesToFilePaths(jsonData) {
  if (!jsonData) return null;
  
  const result = {};
  const imageKeys = ['imagenLateral', 'imagenAncho', 'imagenTop', 'itt', 'zocalo'];
  
  for (const key of imageKeys) {
    if (jsonData[key]) {
      try {
        // Extraer el fileId de la URL /image/:fileId
        const match = jsonData[key].match(/\/image\/([a-f0-9]+)/);
        if (match) {
          const fileId = match[1];
          console.log(`🔄 Convirtiendo ${key} a base64 (${fileId})...`);
          
          // Buscar el archivo en el sistema
          const filePath = await storageAdapter.findFileById(fileId);
          
          if (filePath) {
            // Leer el archivo y convertirlo a base64
            const fileBuffer = fs.readFileSync(filePath);
            
            // Detectar el tipo MIME basado en la extensión
            const ext = path.extname(filePath).toLowerCase();
            let mimeType = 'image/png'; // default
            if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.gif') mimeType = 'image/gif';
            else if (ext === '.webp') mimeType = 'image/webp';
            else if (ext === '.svg') mimeType = 'image/svg+xml';
            
            // Convertir a data URL base64
            const base64 = fileBuffer.toString('base64');
            result[key] = `data:${mimeType};base64,${base64}`;
            console.log(`✅ ${key} → base64 (${mimeType}, ${Math.round(base64.length / 1024)}KB)`);
          } else {
            console.error(`❌ Archivo no encontrado para ${key} (${fileId})`);
            result[key] = jsonData[key];
          }
        } else {
          // Si no es una URL local, mantener la original
          result[key] = jsonData[key];
        }
      } catch (error) {
        console.error(`❌ Error resolviendo ${key}:`, error.message);
        result[key] = jsonData[key];
      }
    }
  }
  
  return result;
}

/**
 * Ejecuta scrapeLosAndes con reintentos agresivos y múltiples estrategias
 * @param {string} deviceType - Tipo de dispositivo
 * @param {string} targetFolderId - ID de carpeta destino
 * @param {string} visualizationType - Tipo de visualización
 * @param {Object} jsonData - Datos JSON con URLs de imágenes
 * @param {string|null} targetDate - Fecha objetivo o null
 * @param {number} maxRetries - Número máximo de reintentos (default: 5)
 * @returns {Promise<Object>} Resultado del scraping
 */
async function scrapeLosAndesWithRetry(deviceType, targetFolderId, visualizationType, jsonData, targetDate, maxRetries = 5) {
  // Convertir URLs de imágenes a rutas de archivo para que Puppeteer pueda cargarlas
  const jsonDataWithFilePaths = await convertImagesToFilePaths(jsonData);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Intento ${attempt}/${maxRetries} para screenshot ${deviceType}`);
      
      // Llamar a scrapeLosAndes con las rutas de archivo
      const result = await scrapeLosAndes(deviceType, targetFolderId, visualizationType, jsonDataWithFilePaths, targetDate, attempt, maxRetries);
      console.log(`✅ Screenshot ${deviceType} exitoso en intento ${attempt}`);
      return result;
    } catch (error) {
      console.log(`⚠️ Intento ${attempt}/${maxRetries} falló: ${error.message}`);
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 15000; // 15s, 30s, 45s, 60s
        console.log(`⏳ Esperando ${waitTime/1000} segundos antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log(`❌ Todos los intentos fallaron para screenshot ${deviceType}`);
        throw error;
      }
    }
  }
}

/**
 * Captura el HTML de Los Andes (desktop y mobile) y lo guarda en almacenamiento local
 * Usa la fecha actual de Argentina para nombrar los archivos
 * Si el archivo ya existe, lo actualiza; si no, lo crea
 * @returns {Promise<void>}
 * @throws {Error} Si falla el lanzamiento del navegador o la captura del HTML
 */
async function captureAndSaveHTML() {
  const htmlFolderId = "html";
  const url = "https://www.losandes.com.ar/";
  const today = getArgentinaDateString(); // YYYY-MM-DD
  
  // Validar que no sea fecha futura
  if (isFutureDate(today)) {
    console.log(`⚠️ Fecha futura detectada (${today}), saltando captura de HTML`);
    return;
  }

  // Configuraciones para desktop y mobile
  const deviceTypes = ["desktop", "mobile"];
  const results = { desktop: false, mobile: false };

  for (const deviceType of deviceTypes) {
    const fileName = `${today}_${deviceType}.html`;
    
    console.log(
      `\n📱 ===== Capturando HTML ${deviceType.toUpperCase()} =====`
    );
    console.log(`📄 Archivo: ${fileName}`);

    try {
      console.log("🌐 Descargando HTML vía HTTP (sin Puppeteer)...");
      let finalHtml = "";

      // Primer intento con user agent específico del dispositivo
      const primaryUserAgent =
        HTML_CAPTURE_USER_AGENTS[deviceType] || HTML_CAPTURE_USER_AGENTS.desktop;

      try {
        const primaryResponse = await axios.get(url, {
          headers: {
            "User-Agent": primaryUserAgent,
            "ngrok-skip-browser-warning": "true",
          },
          timeout: 30000,
        });

        finalHtml =
          typeof primaryResponse.data === "string"
            ? primaryResponse.data
            : String(primaryResponse.data || "");
      } catch (primaryError) {
        console.error(
          `❌ Error capturando HTML ${deviceType} con UA primario:`,
          primaryError.message
        );

        // Fallback: si es mobile, reintentar una vez con user agent de desktop
        if (deviceType === "mobile") {
          console.log(
            "🔁 Fallback: reintentando captura HTML mobile con user agent de desktop..."
          );
          const fallbackUserAgent = HTML_CAPTURE_USER_AGENTS.desktop;

          const fallbackResponse = await axios.get(url, {
            headers: {
              "User-Agent": fallbackUserAgent,
              "ngrok-skip-browser-warning": "true",
            },
            timeout: 30000,
          });

          finalHtml =
            typeof fallbackResponse.data === "string"
              ? fallbackResponse.data
              : String(fallbackResponse.data || "");
        } else {
          throw primaryError;
        }
      }

      const html = finalHtml;
      if (!html) {
        throw new Error("HTML vacío devuelto por el servidor");
      }
      console.log(`✅ HTML obtenido (${html.length} caracteres)`);

      const htmlBuffer = Buffer.from(html, "utf-8");
      console.log(`💾 Buffer creado (${htmlBuffer.length} bytes)`);

      // Buscar si ya existe un archivo con ese nombre usando el adaptador
      console.log(`🔍 Buscando archivo existente: ${fileName}...`);
      const existingFiles = await storageAdapter.listFiles(
        htmlFolderId,
        { name: fileName }
      );
      console.log(`✅ Búsqueda completada: ${existingFiles.files.length} archivo(s) encontrado(s)`);

      if (existingFiles.files.length > 0) {
        // Eliminar archivo existente y crear uno nuevo (más simple que actualizar)
        const fileId = existingFiles.files[0].id;
        console.log(
          `📝 Archivo existente encontrado (ID: ${fileId}), eliminando...`
        );
        await storageAdapter.deleteFile(fileId);
        console.log(`✅ Archivo anterior eliminado`);
      } else {
        console.log(`ℹ️ No hay archivo anterior, se creará uno nuevo`);
      }

      // Crear nuevo archivo usando el adaptador
      console.log(`📝 Creando archivo HTML (${htmlBuffer.length} bytes)...`);
      const result = await storageAdapter.uploadFile(
        htmlFolderId,
        fileName,
        htmlBuffer,
        "text/html"
      );
      console.log(`✅ Archivo creado con ID: ${result.id}`);
      const storageMode = storageAdapter.isLocalMode() ? 'Local' : 'Google Drive';
      console.log(`✅ HTML ${deviceType} guardado en ${storageMode}: ${fileName}`);
      results[deviceType] = true;
    } catch (error) {
      console.error(`❌ Error capturando HTML ${deviceType}:`, error.message);
      console.error(`❌ Stack trace:`, error.stack);
      console.log(`⚠️ Continuando con el siguiente dispositivo...`);
      results[deviceType] = false;
    }
    
    // Esperar un poco entre desktop y mobile para liberar recursos
    if (deviceType === 'desktop') {
      console.log("⏳ Esperando 5 segundos antes de capturar mobile...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Resumen final
  console.log("\n📊 ===== RESUMEN DE CAPTURA DE HTML =====");
  console.log(`Desktop: ${results.desktop ? '✅ Exitoso' : '❌ Falló'}`);
  console.log(`Mobile: ${results.mobile ? '✅ Exitoso' : '❌ Falló'}`);
  
  if (results.desktop && results.mobile) {
    console.log("\n🎉 Ambos HTMLs capturados exitosamente");
  } else if (!results.desktop && !results.mobile) {
    console.log("\n❌ CRÍTICO: No se pudo capturar ningún HTML");
    console.log("❌ Posibles causas:");
    console.log("   - Los Andes está bloqueando la IP del servidor");
    console.log("   - Problemas de conectividad del servidor");
    console.log("   - Firewall bloqueando conexiones salientes");
    throw new Error("No se pudo capturar HTML para ningún dispositivo después de múltiples intentos");
  } else {
    console.log("\n⚠️ ADVERTENCIA: Solo se capturó HTML para uno de los dispositivos");
    const failed = results.desktop ? 'Mobile' : 'Desktop';
    console.log(`⚠️ Falló: ${failed}`);
  }
}

// Endpoint GET que llama al POST de generate-screenshot (simplificado)
app.get("/generate-screenshot", async (req, res) => {
  try {
    console.log(
      "🚀 GET /generate-screenshot - Llamando a POST internamente..."
    );

    // Usar fecha actual por defecto
    const currentDate = getArgentinaDateString();

    // Construir URL del servidor
    const protocol = req.protocol;
    const host = req.get("host");
    const baseUrl = `${protocol}://${host}`;

    // Llamar al endpoint POST internamente
    const axios = require("axios");
    const response = await axios.post(
      `${baseUrl}/generate-screenshot`,
      {
        targetDates: [currentDate],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Retornar la respuesta del POST
    res.json(response.data);
  } catch (error) {
    console.error("❌ Error en GET /generate-screenshot:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al generar screenshots",
      details: error.message,
    });
  }
});

// Endpoint para generar screenshot de Los Andes
app.post("/generate-screenshot", async (req, res) => {
  try {
    console.log("🚀 Generando screenshots de Los Andes...");

    const targetDates = req.body.targetDates || []; // Array de fechas a procesar

    // Si no se especificaron fechas, usar el día actual
    const datesToProcess =
      targetDates.length > 0 ? targetDates : [getArgentinaDateString()];

    console.log(`📅 Fechas a procesar: ${datesToProcess.join(", ")}`);
    console.log(`📱 Generando screenshots para DESKTOP y MOBILE`);

    const allResults = {
      desktop: [],
      mobile: [],
    };

    // ============================================================
    // PROCESAR DESKTOP
    // ============================================================
    console.log("\n🖥️ ===== PROCESANDO DESKTOP =====");

    for (const dateToProcess of datesToProcess) {
      console.log(`\n📆 Procesando fecha DESKTOP: ${dateToProcess}`);

      // Validar que la fecha no sea futura
      if (isFutureDate(dateToProcess)) {
        console.log(
          `⏭️ Saltando fecha futura DESKTOP: ${dateToProcess} (no se pueden generar screenshots para fechas futuras)`
        );
        continue;
      }

      // Obtener campañas desde MongoDB para esta fecha
      const campaignsForDate = await getCampaignsByDate(dateToProcess);
      const desktopRecords = campaignsForDate.filter(
        (record) => record.deviceType === "desktop"
      );

      if (desktopRecords.length === 0) {
        console.log(
          `⚠️ No se encontraron registros desktop para ${dateToProcess}, saltando...`
        );
        continue;
      }

      console.log(
        `📊 Se encontraron ${desktopRecords.length} registros desktop para ${dateToProcess}`
      );

      for (let i = 0; i < desktopRecords.length; i++) {
        const record = desktopRecords[i];
        const visualizationType = record.tipo_visualizacion || "A";
        const targetFolderId = record.carpeta_id || capturas;
        const targetFolderName = record.carpeta_nombre || "capturas (default)";
        
        // Formatear fecha de creación de la campaña
        const uploadedAt = record.uploadedAt ? new Date(record.uploadedAt).toLocaleString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : dateToProcess;

        console.log(
          `\n🎬 Generando screenshot DESKTOP ${i + 1}/${
            desktopRecords.length
          } - Tipo: ${visualizationType}`
        );
        console.log(
          `📁 Carpeta destino: ${targetFolderName} (ID: ${targetFolderId})`
        );

        try {
          const forwardedHost = req.get("x-forwarded-host");
          const forwardedProto = req.get("x-forwarded-proto");
          const host = forwardedHost || req.get("host");
          const protocol = forwardedProto || req.protocol;
          const baseUrl = `${protocol}://${host}`;

          const jsonDataForScraper = {
            imagenLateral: record.imagenLateral
              ? `${baseUrl}${record.imagenLateral}`
              : null,
            imagenAncho: record.imagenAncho
              ? `${baseUrl}${record.imagenAncho}`
              : null,
            imagenTop: record.imagenTop
              ? `${baseUrl}${record.imagenTop}`
              : null,
            itt: record.itt ? `${baseUrl}${record.itt}` : null,
            zocalo: record.zocalo ? `${baseUrl}${record.zocalo}` : null,
          };

          const currentDate = getArgentinaDateString();
          const targetDate = dateToProcess < currentDate ? dateToProcess : null;
          
          console.log(`🔍 DESKTOP - dateToProcess: ${dateToProcess}, currentDate: ${currentDate}, targetDate: ${targetDate}`);

          const result = await scrapeLosAndesWithRetry(
            "desktop",
            targetFolderId,
            visualizationType,
            jsonDataForScraper,
            targetDate,
            5 // 5 intentos con estrategias diferentes
          );
          allResults.desktop.push({
            ...result,
            visualizationType,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "desktop",
            campana: `${targetFolderName}-desktop-${visualizationType} (${uploadedAt})`,
          });
        } catch (error) {
          console.error(
            `❌ Error en screenshot DESKTOP ${i + 1}:`,
            error.message
          );
          allResults.desktop.push({
            success: false,
            error: error.message,
            visualizationType,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "desktop",
          });
        }
      }
    }

    // ============================================================
    // PROCESAR MOBILE
    // ============================================================
    console.log("\n📱 ===== PROCESANDO MOBILE =====");

    for (const dateToProcess of datesToProcess) {
      console.log(`\n📆 Procesando fecha MOBILE: ${dateToProcess}`);

      // Validar que la fecha no sea futura
      if (isFutureDate(dateToProcess)) {
        console.log(
          `⏭️ Saltando fecha futura MOBILE: ${dateToProcess} (no se pueden generar screenshots para fechas futuras)`
        );
        continue;
      }

      // Obtener campañas desde MongoDB para esta fecha
      const campaignsForDate = await getCampaignsByDate(dateToProcess);
      const mobileRecords = campaignsForDate.filter(
        (record) => record.deviceType === "mobile"
      );

      if (mobileRecords.length === 0) {
        console.log(
          `⚠️ No se encontraron registros mobile para ${dateToProcess}, saltando...`
        );
        continue;
      }

      console.log(
        `📊 Se encontraron ${mobileRecords.length} registros mobile para ${dateToProcess}`
      );

      for (let i = 0; i < mobileRecords.length; i++) {
        const record = mobileRecords[i];
        const targetFolderId = record.carpeta_id || capturas;
        const targetFolderName = record.carpeta_nombre || "capturas (default)";
        
        // Formatear fecha de creación de la campaña
        const uploadedAt = record.uploadedAt ? new Date(record.uploadedAt).toLocaleString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : dateToProcess;

        console.log(
          `\n🎬 Generando screenshot MOBILE ${i + 1}/${mobileRecords.length}`
        );
        console.log(
          `📁 Carpeta destino: ${targetFolderName} (ID: ${targetFolderId})`
        );

        try {
          const forwardedHost = req.get("x-forwarded-host");
          const forwardedProto = req.get("x-forwarded-proto");
          const host = forwardedHost || req.get("host");
          const protocol = forwardedProto || req.protocol;
          const baseUrl = `${protocol}://${host}`;

          const jsonDataForScraper = {
            imagenLateral: record.imagenLateral
              ? `${baseUrl}${record.imagenLateral}`
              : null,
            imagenAncho: record.imagenAncho
              ? `${baseUrl}${record.imagenAncho}`
              : null,
            imagenTop: record.imagenTop
              ? `${baseUrl}${record.imagenTop}`
              : null,
            itt: record.itt ? `${baseUrl}${record.itt}` : null,
            zocalo: record.zocalo ? `${baseUrl}${record.zocalo}` : null,
          };

          const currentDate = getArgentinaDateString();
          const targetDate = dateToProcess < currentDate ? dateToProcess : null;
          
          console.log(`🔍 MOBILE - dateToProcess: ${dateToProcess}, currentDate: ${currentDate}, targetDate: ${targetDate}`);

          // Obtener tipo de visualización del record (A, B, C para mobile)
          const visualizationType = record.tipo_visualizacion || null;

          const result = await scrapeLosAndesWithRetry(
            "mobile",
            targetFolderId,
            visualizationType,
            jsonDataForScraper,
            targetDate,
            5 // 5 intentos con estrategias diferentes
          );
          allResults.mobile.push({
            ...result,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "mobile",
            campana: visualizationType ? `${targetFolderName}-mobile-${visualizationType} (${uploadedAt})` : `${targetFolderName}-mobile (${uploadedAt})`,
          });
        } catch (error) {
          console.error(
            `❌ Error en screenshot MOBILE ${i + 1}:`,
            error.message
          );
          allResults.mobile.push({
            success: false,
            error: error.message,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "mobile",
          });
        }
      }
    }

    // ============================================================
    // RESUMEN DE SCREENSHOTS
    // ============================================================
    const currentDate = getArgentinaDateString();
    const successfulDesktop = allResults.desktop.filter(r => r.success).length;
    const successfulMobile = allResults.mobile.filter(r => r.success).length;
    const failedDesktop = allResults.desktop.filter(r => !r.success).length;
    const failedMobile = allResults.mobile.filter(r => !r.success).length;
    
    console.log(`\n📊 ===== RESUMEN DE SCREENSHOTS =====`);
    console.log(`Desktop: ${successfulDesktop} exitosos, ${failedDesktop} fallidos`);
    console.log(`Mobile: ${successfulMobile} exitosos, ${failedMobile} fallidos`);
    console.log(`Total: ${successfulDesktop + successfulMobile} exitosos de ${allResults.desktop.length + allResults.mobile.length} intentos`);
    
    // Verificar si todos los screenshots fallaron (solo si se intentaron generar)
    if (successfulDesktop === 0 && successfulMobile === 0 && (allResults.desktop.length > 0 || allResults.mobile.length > 0)) {
      console.log(`\n⚠️ ADVERTENCIA: Todos los screenshots fallaron`);
      console.log("⚠️ Posibles causas:");
      console.log("   - Los Andes está bloqueando la IP del servidor");
      console.log("   - Problemas de conectividad del servidor");
      console.log("   - Error en la configuración de Puppeteer");
      // No lanzar error, solo advertir - permitir que continúe con la captura de HTML
    }
    
    // ============================================================
    // CAPTURAR HTML (SIEMPRE para la fecha actual)
    // ============================================================
    console.log(`\n🔍 Verificando captura de HTML...`);
    console.log(`📅 Fecha actual (Argentina): ${currentDate}`);
    
    // Verificar si la fecha actual está en las fechas procesadas
    const isProcessingCurrentDate = datesToProcess.includes(currentDate);
    
    console.log(`✅ ¿Se está procesando la fecha actual?: ${isProcessingCurrentDate}`);

    if (isProcessingCurrentDate) {
      console.log(
        "\n📄 Capturando HTML de Los Andes (SIEMPRE para fecha actual, incluso sin campañas)..."
      );
      try {
        await captureAndSaveHTML();
        console.log("✅ HTML capturado y guardado exitosamente");
      } catch (htmlError) {
        console.error("⚠️ Error al capturar HTML:", htmlError.message);
      }
    } else {
      console.log(
        "\n⏭️ Saltando captura de HTML (no se está procesando la fecha actual)"
      );
    }

    // ============================================================
    // RESPUESTA FINAL
    // ============================================================
    const totalScreenshots =
      allResults.desktop.length + allResults.mobile.length;
    
    let message;
    if (totalScreenshots === 0) {
      message = `No se encontraron campañas para procesar. HTML capturado para fecha actual: ${currentDate}`;
    } else {
      message = `${totalScreenshots} screenshots generados (${successfulDesktop} desktop, ${successfulMobile} mobile exitosos) para ${datesToProcess.length} fecha(s). HTML capturado para fecha actual.`;
    }

    res.json({
      success: true,
      message: message,
      data: allResults,
    });
  } catch (error) {
    console.error("❌ Error generando screenshot:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al generar el screenshot",
      details: error.message,
    });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💾 Almacenamiento: LOCAL (Sistema de archivos)`);
  console.log(`🌎 Zona horaria: America/Argentina/Buenos_Aires (UTC-3)`);
  console.log(`📅 Fecha actual (Argentina): ${getArgentinaDateString()}`);
});

// Manejar errores de puerto ocupado
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Error: El puerto ${PORT} ya está en uso`);
    console.error('');
    console.error('💡 Soluciones:');
    console.error('   1. Detener el proceso que usa el puerto:');
    console.error(`      lsof -ti:${PORT} | xargs kill -9`);
    console.error('');
    console.error('   2. Reiniciar PM2:');
    console.error('      pm2 restart andes-server');
    process.exit(1);
  } else {
    console.error('❌ Error al iniciar servidor:', err);
    process.exit(1);
  }
});

// Manejar cierre graceful
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT recibido (Ctrl+C), cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});
