require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { google } = require("googleapis");
const streamifier = require("streamifier");
const { scrapeLosAndes } = require("./scraper-losandes");
const { launchBrowser, configurePage } = require("./puppeteer-config");
const { getArgentinaDateString } = require("./date-utils");

const app = express();
const PORT = process.env.PORT || 3000;

// Google Drive folder IDs
const imagenes = "1bbkECY_axw5IttYjgVpRLmi6-EF80fZz";
const jsones = "1d40AKgKucYUY-CnSqcLd1v8uyXhElk33";
const capturas = "1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR";

/**
 * Autoriza y conecta con Google Drive API usando credenciales JWT
 * @returns {Promise<google.auth.JWT>} Cliente JWT autenticado
 * @throws {Error} Si las credenciales son inválidas o la autorización falla
 */
async function authorize() {
  const jwtClient = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/drive"]
  );

  await jwtClient.authorize();
  console.log("Successfully connected to Google Drive API.");
  return jwtClient;
}

// Initialize Google Drive client
let driveClient = null;

// Connect to Google Drive on startup
if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  authorize()
    .then((auth) => {
      driveClient = google.drive({ version: "v3", auth });
      console.log("✅ Google Drive API initialized");
    })
    .catch((err) => {
    });
} else {
  console.warn("⚠️  Google Drive credentials not found.");
}

/**
 * Sube un archivo a Google Drive
 * @param {string} folderId - ID de la carpeta de destino en Google Drive
 * @param {string} fileName - Nombre del archivo a crear
 * @param {Buffer} buffer - Buffer con el contenido del archivo
 * @param {string} mimeType - Tipo MIME del archivo (ej: 'image/png', 'application/json')
 * @returns {Promise<Object>} Objeto con datos del archivo subido (id, name, webViewLink, webContentLink)
 * @throws {Error} Si Google Drive no está inicializado o falla la subida
 */
async function uploadFileToDrive(folderId, fileName, buffer, mimeType) {
  if (!driveClient) {
    throw new Error("Google Drive client not initialized");
  }

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
    mimeType: mimeType,
  };

  const media = {
    mimeType: mimeType,
    body: streamifier.createReadStream(buffer),
  };

  try {
    const response = await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });
    console.log(`✅ File uploaded to Google Drive: ${fileName} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error("❌ Error uploading to Google Drive:", error.message);
    throw error;
  }
}

/**
 * Genera un array de fechas entre dos fechas (inclusive)
 * @param {string} startDate - Fecha inicial en formato YYYY-MM-DD
 * @param {string} endDate - Fecha final en formato YYYY-MM-DD
 * @returns {string[]} Array de fechas en formato YYYY-MM-DD
 * @example
 * generateDateArray('2025-10-20', '2025-10-22')
 * // Returns: ['2025-10-20', '2025-10-21', '2025-10-22']
 */
function generateDateArray(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    dates.push(new Date(currentDate).toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
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

/**
 * Busca un archivo JSON por nombre en una carpeta de Google Drive
 * @param {string} folderId - ID de la carpeta donde buscar
 * @param {string} fileName - Nombre del archivo JSON a buscar
 * @returns {Promise<Object|null>} Objeto con datos del archivo (id, name) o null si no existe
 */
async function findJsonFileByName(folderId, fileName) {
  if (!driveClient) {
    throw new Error("Google Drive client not initialized");
  }

  try {
    const response = await driveClient.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (response.data.files.length > 0) {
      return response.data.files[0];
    }
    return null;
  } catch (error) {
    console.error("Error buscando archivo JSON:", error.message);
    return null;
  }
}

/**
 * Obtiene el contenido de un archivo JSON desde Google Drive
 * @param {string} fileId - ID del archivo en Google Drive
 * @returns {Promise<Object|null>} Contenido parseado del JSON o null si falla
 */
async function getJsonFileContent(fileId) {
  if (!driveClient) {
    throw new Error("Google Drive client not initialized");
  }

  try {
    const response = await driveClient.files.get({
      fileId: fileId,
      alt: "media",
    });
    return response.data;
  } catch (error) {
    console.error("Error obteniendo contenido JSON:", error.message);
    return null;
  }
}

/**
 * Crea o actualiza un archivo JSON en Google Drive
 * @param {string} folderId - ID de la carpeta de destino
 * @param {string} fileName - Nombre del archivo JSON
 * @param {Object|Array} content - Contenido a guardar (será convertido a JSON)
 * @returns {Promise<Object>} Objeto con datos del archivo creado/actualizado
 * @throws {Error} Si Google Drive no está inicializado o falla la operación
 */
async function createOrUpdateJsonFile(folderId, fileName, content) {
  if (!driveClient) {
    throw new Error("Google Drive client not initialized");
  }

  const jsonContent = JSON.stringify(content, null, 2);
  const buffer = Buffer.from(jsonContent, "utf-8");

  // Buscar si ya existe
  const existingFile = await findJsonFileByName(folderId, fileName);

  if (existingFile) {
    // Actualizar archivo existente
    const media = {
      mimeType: "application/json",
      body: streamifier.createReadStream(buffer),
    };

    const response = await driveClient.files.update({
      fileId: existingFile.id,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    return {
      ...response.data,
      action: "updated",
    };
  } else {
    // Crear nuevo archivo
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      mimeType: "application/json",
    };

    const media = {
      mimeType: "application/json",
      body: streamifier.createReadStream(buffer),
    };

    const response = await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    return {
      ...response.data,
      action: "created",
    };
  }
}

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
// directamente a Google Drive. Después se liberan de memoria.
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
    drive: driveClient ? "connected" : "disconnected",
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

    // Verificar que Google Drive esté configurado
    if (!driveClient) {
      return res.status(500).json({
        success: false,
        error: "Google Drive no está configurado",
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
          mimetype: file.mimetype,
        };

        // Subir el archivo a Google Drive
        const drivePromise = uploadFileToDrive(
          imagenes,
          file.originalname,
          file.buffer,
          file.mimetype
        )
          .then((driveFile) => {
            uploadedFiles[fieldName].driveId = driveFile.id;
            uploadedFiles[fieldName].driveLink = driveFile.webViewLink;
            uploadedFiles[fieldName].driveContentLink =
              driveFile.webContentLink;
          })
          .catch((err) => {
            console.error(
              `Error al subir ${file.originalname} a Drive:`,
              err.message
            );
            uploadedFiles[fieldName].driveError = err.message;
          });
        driveUploadPromises.push(drivePromise);
      }
    }

    // Esperar a que todos los archivos se suban a Drive
    await Promise.all(driveUploadPromises);

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

    // Procesar rangos de fechas y crear/actualizar archivos JSON
    const jsonResults = [];

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
            imagenLateral: uploadedFiles.imagenLateral
              ? `/image/${uploadedFiles.imagenLateral.driveId}`
              : null,
            imagenAncho: uploadedFiles.imagenAncho
              ? `/image/${uploadedFiles.imagenAncho.driveId}`
              : null,
            imagenTop: uploadedFiles.imagenTop
              ? `/image/${uploadedFiles.imagenTop.driveId}`
              : null,
            itt: uploadedFiles.itt
              ? `/image/${uploadedFiles.itt.driveId}`
              : null,
            zocalo: uploadedFiles.zocalo
              ? `/image/${uploadedFiles.zocalo.driveId}`
              : null,
            deviceType: deviceType,
            uploadedAt: new Date(date + "T00:00:00").toISOString(), // Usar fecha de la campaña
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

          // Agregar al array
          jsonData.push(imageData);

          // Crear o actualizar el archivo JSON
          const result = await createOrUpdateJsonFile(
            jsones,
            jsonFileName,
            jsonData
          );
          jsonResults.push({
            date,
            fileId: result.id,
            action: existingFile ? "updated" : "created",
          });
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
          jsonResults.push({ date, error: error.message });
        }
      }
    }

    if (dateRange2 && dateRange2.start && dateRange2.end) {
      const dates2 = generateDateArray(dateRange2.start, dateRange2.end);
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
            imagenLateral: uploadedFiles.imagenLateral
              ? `/image/${uploadedFiles.imagenLateral.driveId}`
              : null,
            imagenAncho: uploadedFiles.imagenAncho
              ? `/image/${uploadedFiles.imagenAncho.driveId}`
              : null,
            imagenTop: uploadedFiles.imagenTop
              ? `/image/${uploadedFiles.imagenTop.driveId}`
              : null,
            itt: uploadedFiles.itt
              ? `/image/${uploadedFiles.itt.driveId}`
              : null,
            zocalo: uploadedFiles.zocalo
              ? `/image/${uploadedFiles.zocalo.driveId}`
              : null,
            deviceType: deviceType,
            uploadedAt: new Date(date + "T00:00:00").toISOString(), // Usar fecha de la campaña
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

          // Agregar al array
          jsonData.push(imageData);

          // Crear o actualizar el archivo JSON
          const result = await createOrUpdateJsonFile(
            jsones,
            jsonFileName,
            jsonData
          );
          jsonResults.push({
            date,
            fileId: result.id,
            action: existingFile ? "updated" : "created",
          });
        } catch (error) {
          console.error(`Error procesando fecha ${date}:`, error.message);
          jsonResults.push({ date, error: error.message });
        }
      }
    }

    // Responder con éxito
    res.json({
      success: true,
      message: "Imágenes subidas a Google Drive correctamente",
      deviceType: deviceType,
      files: uploadedFiles,
      jsonFiles: jsonResults,
      uploadedAt: new Date().toISOString(),
    });
  });
});

// Endpoint para listar archivos de Google Drive
app.get("/uploads", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  try {
    const response = await driveClient.files.list({
      q: `'${imagenes}' in parents and trashed=false and mimeType contains 'image/'`,
      fields:
        "files(id, name, size, createdTime, webViewLink, webContentLink, thumbnailLink, mimeType)",
      orderBy: "createdTime desc",
      pageSize: 100,
    });

    res.json({
      success: true,
      files: response.data.files,
    });
  } catch (error) {
    console.error("Error al listar archivos de Drive:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener archivos de Google Drive",
    });
  }
});

// Endpoint para listar carpetas de Google Drive
app.get("/folders", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  try {
    const parentId = req.query.parentId || "1norxhMEG62maIArwy-zjolxzPGsQoBzq"; // Carpeta raíz por defecto

    const response = await driveClient.files.list({
      q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id, name, mimeType, modifiedTime)",
      orderBy: "name asc",
      pageSize: 100,
    });

    // Filtrar carpetas excluidas (imagenes, jsones, screenshots)
    const excludedFolders = [
      "imagenes",
      "jsones",
      "screenshots",
      "webs_pasado",
      "config",
    ];
    const filteredFolders = response.data.files.filter(
      (folder) => !excludedFolders.includes(folder.name.toLowerCase())
    );

    res.json({
      success: true,
      folders: filteredFolders,
      parentId: parentId,
    });
  } catch (error) {
    console.error("Error al listar carpetas de Drive:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener carpetas de Google Drive",
    });
  }
});

// Endpoint para obtener información de una carpeta específica
app.get("/folder-info/:folderId", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  try {
    const folderId = req.params.folderId;

    const response = await driveClient.files.get({
      fileId: folderId,
      fields: "id, name, parents",
    });

    res.json({
      success: true,
      folder: response.data,
    });
  } catch (error) {
    console.error("Error al obtener información de carpeta:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener información de carpeta",
    });
  }
});

// Endpoint para listar archivos JSON
app.get("/json-files", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  try {
    const response = await driveClient.files.list({
      q: `'${jsones}' in parents and trashed=false and mimeType='application/json'`,
      fields:
        "files(id, name, size, createdTime, modifiedTime, webViewLink, webContentLink)",
      orderBy: "name asc",
      pageSize: 100,
    });

    res.json({
      success: true,
      files: response.data.files,
    });
  } catch (error) {
    console.error("Error al listar archivos JSON:", error.message);
    res.status(500).json({
      success: false,
      error: "Error al obtener archivos JSON de Google Drive",
    });
  }
});

// Endpoint para obtener contenido de un archivo JSON específico
app.get("/json-file/:fileId", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  const fileId = req.params.fileId;

  try {
    const content = await getJsonFileContent(fileId);
    res.json({
      success: true,
      content: content,
    });
  } catch (error) {
    console.error("Error al obtener archivo JSON:", error.message);
    res.status(404).json({
      success: false,
      error: "Archivo JSON no encontrado",
    });
  }
});

// Endpoint para servir imágenes de Google Drive (proxy)
app.get("/image/:fileId", async (req, res) => {
  if (!driveClient) {
    return res.status(500).json({
      success: false,
      error: "Google Drive no está configurado",
    });
  }

  const fileId = req.params.fileId;

  try {
    const response = await driveClient.files.get(
      { fileId: fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Establecer headers apropiados para ngrok y CORS
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/png"
    );
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache por 24 horas
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("ngrok-skip-browser-warning", "true");

    // Pipe el stream de Drive a la respuesta
    response.data.pipe(res);
  } catch (error) {
    console.error(
      `Error al obtener imagen de Drive (${fileId}):`,
      error.message
    );
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

/**
 * Captura el HTML de Los Andes (desktop y mobile) y lo guarda en Google Drive
 * Usa la fecha actual de Argentina para nombrar los archivos
 * Si el archivo ya existe, lo actualiza; si no, lo crea
 * @returns {Promise<void>}
 * @throws {Error} Si falla el lanzamiento del navegador o la captura del HTML
 */
async function captureAndSaveHTML() {
  const htmlFolderId = "1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49";
  const url = "https://www.losandes.com.ar/";
  const today = getArgentinaDateString(); // YYYY-MM-DD
  
  // Validar que no sea fecha futura
  if (isFutureDate(today)) {
    console.log(`⚠️ Fecha futura detectada (${today}), saltando captura de HTML`);
    return;
  }

  // Configuraciones para desktop y mobile
  const deviceTypes = ["desktop", "mobile"];

  for (const deviceType of deviceTypes) {
    const fileName = `${today}_${deviceType}.html`;
    
    console.log(
      `\n📱 ===== Capturando HTML ${deviceType.toUpperCase()} =====`
    );
    console.log(`📄 Archivo: ${fileName}`);

    let browser;
    try {
      console.log("🔧 Lanzando navegador Puppeteer...");
      browser = await launchBrowser(deviceType);
      console.log("✅ Navegador lanzado exitosamente");

      console.log("📄 Creando nueva página...");
      const page = await browser.newPage();
      console.log("✅ Página creada");

      // Configurar página con user agent y headers
      console.log("🔧 Configurando página...");
      await configurePage(page, deviceType);
      console.log("✅ Página configurada");

      // Navegar a la página
      console.log(`🌐 Navegando a ${url}...`);
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      console.log("✅ Página cargada exitosamente");

      // Obtener el HTML completo
      console.log("📝 Obteniendo contenido HTML...");
      const html = await page.content();
      console.log(`✅ HTML obtenido (${html.length} caracteres)`);

      // Convertir HTML a buffer
      const htmlBuffer = Buffer.from(html, "utf-8");
      console.log(`💾 Buffer creado (${htmlBuffer.length} bytes)`);

      // Subir a Google Drive
      const fileMetadata = {
        name: fileName,
        parents: [htmlFolderId],
        mimeType: "text/html",
      };

      const media = {
        mimeType: "text/html",
        body: require("stream").Readable.from(htmlBuffer),
      };

      // Buscar si ya existe un archivo con ese nombre
      console.log(`🔍 Buscando archivo existente: ${fileName}...`);
      const existingFiles = await driveClient.files.list({
        q: `name='${fileName}' and '${htmlFolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (existingFiles.data.files.length > 0) {
        // Actualizar archivo existente
        const fileId = existingFiles.data.files[0].id;
        console.log(
          `📝 Archivo existente encontrado (ID: ${fileId}), actualizando...`
        );
        await driveClient.files.update({
          fileId: fileId,
          media: media,
        });
        console.log(`✅ HTML ${deviceType} actualizado: ${fileName}`);
      } else {
        // Crear nuevo archivo
        console.log("📝 Archivo no existe, creando nuevo...");
        await driveClient.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id, name, webViewLink",
        });
        console.log(`✅ HTML ${deviceType} creado: ${fileName}`);
      }
    } catch (error) {
      console.error(`❌ Error capturando HTML ${deviceType}:`, error.message);
      console.error("Stack:", error.stack);
      throw error;
    } finally {
      if (browser) {
        console.log("🔒 Cerrando navegador...");
        await browser.close();
        console.log("✅ Navegador cerrado");
      }
    }
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

      const jsonFileName = `${dateToProcess}.json`;
      const existingFile = await findJsonFileByName(jsones, jsonFileName);

      if (!existingFile) {
        console.log(
          `⚠️ No se encontró JSON para ${dateToProcess}, saltando...`
        );
        continue;
      }

      const jsonContent = await getJsonFileContent(existingFile.id);
      const jsonData = Array.isArray(jsonContent) ? jsonContent : [];
      const desktopRecords = jsonData.filter(
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

          const result = await scrapeLosAndes(
            "desktop",
            targetFolderId,
            visualizationType,
            jsonDataForScraper,
            targetDate
          );
          allResults.desktop.push({
            ...result,
            visualizationType,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "desktop",
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

      const jsonFileName = `${dateToProcess}.json`;
      const existingFile = await findJsonFileByName(jsones, jsonFileName);

      if (!existingFile) {
        console.log(
          `⚠️ No se encontró JSON para ${dateToProcess}, saltando...`
        );
        continue;
      }

      const jsonContent = await getJsonFileContent(existingFile.id);
      const jsonData = Array.isArray(jsonContent) ? jsonContent : [];
      const mobileRecords = jsonData.filter(
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

          const result = await scrapeLosAndes(
            "mobile",
            targetFolderId,
            visualizationType,
            jsonDataForScraper,
            targetDate
          );
          allResults.mobile.push({
            ...result,
            recordIndex: i,
            date: dateToProcess,
            deviceType: "mobile",
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
    // CAPTURAR HTML (solo si se procesaron screenshots de fecha actual)
    // ============================================================
    const currentDate = getArgentinaDateString();
    
    console.log(`\n🔍 Verificando captura de HTML...`);
    console.log(`📅 Fecha actual (Argentina): ${currentDate}`);
    console.log(`📊 Total screenshots desktop: ${allResults.desktop.length}`);
    console.log(`📊 Total screenshots mobile: ${allResults.mobile.length}`);
    
    // Verificar si se procesaron screenshots exitosos para la fecha actual
    const hasCurrentDateScreenshots = 
      allResults.desktop.some(r => r.success && r.date === currentDate) ||
      allResults.mobile.some(r => r.success && r.date === currentDate);

    console.log(`✅ ¿Hay screenshots de fecha actual?: ${hasCurrentDateScreenshots}`);

    if (hasCurrentDateScreenshots) {
      console.log(
        "\n📄 Capturando HTML de Los Andes (screenshots de fecha actual generados)..."
      );
      try {
        await captureAndSaveHTML();
        console.log("✅ HTML capturado y guardado exitosamente");
      } catch (htmlError) {
        console.error("⚠️ Error al capturar HTML:", htmlError.message);
      }
    } else {
      console.log(
        "\n⏭️ Saltando captura de HTML (no se generaron screenshots para fecha actual)"
      );
    }

    // ============================================================
    // RESPUESTA FINAL
    // ============================================================
    const totalScreenshots =
      allResults.desktop.length + allResults.mobile.length;

    res.json({
      success: true,
      message: `${totalScreenshots} screenshots generados exitosamente (${allResults.desktop.length} desktop, ${allResults.mobile.length} mobile) para ${datesToProcess.length} fecha(s)`,
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
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`☁️  Almacenamiento: Google Drive (Carpeta ID: ${imagenes})`);
  console.log(`🌎 Zona horaria: America/Argentina/Buenos_Aires (UTC-3)`);
  console.log(`📅 Fecha actual (Argentina): ${getArgentinaDateString()}`);
});
