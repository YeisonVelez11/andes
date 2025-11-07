/**
 * Sistema de almacenamiento local que replica la funcionalidad de Google Drive
 * Mantiene la misma estructura de carpetas y API para compatibilidad total
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Rutas base para almacenamiento local
const BASE_DIR = path.join(__dirname, 'navegacion');
const CONFIG_DIR = path.join(__dirname, 'config_local');

// IDs de carpetas "virtuales" que mapean a directorios locales
const FOLDER_MAP = {
  // Carpetas de configuración (config_local)
  '1bbkECY_axw5IttYjgVpRLmi6-EF80fZz': path.join(CONFIG_DIR, 'imagenes_cargadas'), // Imágenes subidas
  '1d40AKgKucYUY-CnSqcLd1v8uyXhElk33': path.join(CONFIG_DIR, 'jsones'),            // JSONs
  '1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49': path.join(CONFIG_DIR, 'html'),              // HTML
  '1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR': path.join(CONFIG_DIR, 'capturas'),          // Capturas
  
  // Carpeta raíz de navegación
  '1norxhMEG62maIArwy-zjolxzPGsQoBzq': BASE_DIR
};

/**
 * Inicializa el sistema de almacenamiento local
 * Crea las carpetas necesarias
 */
async function initializeLocalStorage() {
  try {
    // Crear carpeta base de navegación
    await fs.mkdir(BASE_DIR, { recursive: true });
    
    // Crear carpetas de configuración
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'imagenes_cargadas'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'jsones'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'html'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'capturas'), { recursive: true });
    
    console.log('✅ Almacenamiento local inicializado');
  } catch (error) {
    console.error('❌ Error inicializando almacenamiento local:', error);
    throw error;
  }
}

/**
 * Genera un ID único basado en la ruta del archivo
 */
function generateFileId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

/**
 * Genera un ID único para archivos/carpetas (simula IDs de Google Drive)
 */
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Obtiene la ruta real de una carpeta dado su ID virtual
 */
function getFolderPath(folderId) {
  // Si es un ID conocido, usar el mapeo
  if (FOLDER_MAP[folderId]) {
    return FOLDER_MAP[folderId];
  }
  
  // Si no, es una subcarpeta en navegacion
  return path.join(BASE_DIR, folderId);
}

/**
 * Sube un archivo al almacenamiento local
 * Replica la API de uploadFileToDrive
 */
async function uploadFileToLocal(folderId, fileName, buffer, mimeType) {
  try {
    const folderPath = getFolderPath(folderId);
    await fs.mkdir(folderPath, { recursive: true });
    
    const filePath = path.join(folderPath, fileName);
    await fs.writeFile(filePath, buffer);
    
    // Generar ID único para el archivo
    const fileId = generateId();
    
    // Guardar metadatos
    const metadata = await readMetadata();
    metadata.files[fileId] = {
      id: fileId,
      name: fileName,
      mimeType: mimeType,
      folderId: folderId,
      path: filePath,
      createdTime: new Date().toISOString(),
      size: buffer.length
    };
    await saveMetadata(metadata);
    
    // Retornar en formato compatible con Google Drive
    return {
      id: fileId,
      name: fileName,
      webViewLink: `/local-files/${fileId}`,
      webContentLink: `/local-files/${fileId}/download`,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error subiendo archivo local:', error);
    throw error;
  }
}

/**
 * Lista archivos en una carpeta
 * Replica la API de listFiles de Google Drive
 */
async function listFilesInLocal(folderId, query = {}) {
  try {
    const folderPath = getFolderPath(folderId);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(folderPath);
    } catch {
      return { files: [] };
    }
    
    const files = await fs.readdir(folderPath, { withFileTypes: true });
    const metadata = await readMetadata();
    
    const fileList = [];
    
    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(folderPath, file.name);
        const stats = await fs.stat(filePath);
        
        // Buscar en metadatos o crear entrada temporal
        let fileMetadata = Object.values(metadata.files).find(f => f.path === filePath);
        
        if (!fileMetadata) {
          fileMetadata = {
            id: generateId(),
            name: file.name,
            mimeType: getMimeType(file.name),
            folderId: folderId,
            path: filePath,
            createdTime: stats.birthtime.toISOString(),
            modifiedTime: stats.mtime.toISOString(),
            size: stats.size
          };
        }
        
        // Aplicar filtros de query si existen
        if (query.name && !file.name.includes(query.name)) {
          continue;
        }
        
        fileList.push({
          id: fileMetadata.id,
          name: file.name,
          mimeType: fileMetadata.mimeType,
          createdTime: fileMetadata.createdTime,
          modifiedTime: fileMetadata.modifiedTime || fileMetadata.createdTime,
          size: stats.size,
          webViewLink: `/local-files/${fileMetadata.id}`,
          webContentLink: `/local-files/${fileMetadata.id}/download`
        });
      }
    }
    
    return { files: fileList };
  } catch (error) {
    console.error('Error listando archivos locales:', error);
    return { files: [] };
  }
}

/**
 * Lista carpetas (subcarpetas en navegacion)
 * Replica la funcionalidad de listar carpetas de Google Drive
 */
async function listFoldersInLocal(parentId) {
  try {
    const parentPath = getFolderPath(parentId);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(parentPath);
    } catch {
      return { folders: [] };
    }
    
    const items = await fs.readdir(parentPath, { withFileTypes: true });
    const metadata = await readMetadata();
    
    const folderList = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const folderPath = path.join(parentPath, item.name);
        const stats = await fs.stat(folderPath);
        
        // Generar o recuperar ID de carpeta
        let folderId = Object.keys(metadata.folders).find(id => metadata.folders[id].path === folderPath);
        
        if (!folderId) {
          folderId = generateId();
          metadata.folders[folderId] = {
            id: folderId,
            name: item.name,
            path: folderPath,
            parentId: parentId,
            createdTime: stats.birthtime.toISOString()
          };
          await saveMetadata(metadata);
        }
        
        folderList.push({
          id: folderId,
          name: item.name,
          mimeType: 'application/vnd.google-apps.folder',
          createdTime: metadata.folders[folderId].createdTime,
          webViewLink: `/local-folders/${folderId}`
        });
      }
    }
    
    return { folders: folderList };
  } catch (error) {
    console.error('Error listando carpetas locales:', error);
    return { folders: [] };
  }
}

/**
 * Crea una nueva carpeta
 * Replica la API de createFolder de Google Drive
 */
async function createFolderInLocal(parentId, folderName) {
  try {
    const parentPath = getFolderPath(parentId);
    const newFolderPath = path.join(parentPath, folderName);
    
    await fs.mkdir(newFolderPath, { recursive: true });
    
    // Generar ID y guardar metadatos
    const folderId = generateId();
    const metadata = await readMetadata();
    
    metadata.folders[folderId] = {
      id: folderId,
      name: folderName,
      path: newFolderPath,
      parentId: parentId,
      createdTime: new Date().toISOString()
    };
    
    await saveMetadata(metadata);
    
    return {
      id: folderId,
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: `/local-folders/${folderId}`
    };
  } catch (error) {
    console.error('Error creando carpeta local:', error);
    throw error;
  }
}

/**
 * Lee un archivo del almacenamiento local
 */
async function readFileFromLocal(fileId) {
  try {
    const metadata = await readMetadata();
    const fileMetadata = metadata.files[fileId];
    
    if (!fileMetadata) {
      throw new Error('Archivo no encontrado');
    }
    
    const content = await fs.readFile(fileMetadata.path);
    return {
      data: content,
      metadata: fileMetadata
    };
  } catch (error) {
    console.error('Error leyendo archivo local:', error);
    throw error;
  }
}

/**
 * Elimina un archivo del almacenamiento local
 */
async function deleteFileFromLocal(fileId) {
  try {
    const metadata = await readMetadata();
    const fileMetadata = metadata.files[fileId];
    
    if (!fileMetadata) {
      throw new Error('Archivo no encontrado');
    }
    
    // Eliminar archivo físico
    await fs.unlink(fileMetadata.path);
    
    // Eliminar de metadatos
    delete metadata.files[fileId];
    await saveMetadata(metadata);
    
    return { success: true };
  } catch (error) {
    console.error('Error eliminando archivo local:', error);
    throw error;
  }
}

/**
 * Obtiene el MIME type basado en la extensión del archivo
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
  initializeLocalStorage,
  uploadFileToLocal,
  listFilesInLocal,
  listFoldersInLocal,
  createFolderInLocal,
  readFileFromLocal,
  deleteFileFromLocal,
  getFolderPath,
  FOLDER_MAP,
  BASE_DIR,
  CONFIG_DIR
};
